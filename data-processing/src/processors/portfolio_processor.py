"""
Portfolio data processing and analytics module
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal

from ..services.database_service import DatabaseService
from ..services.cache_service import CacheService, CacheKeys
from ..models.portfolio_models import Portfolio, Position, Transaction, TransactionType
from ..models.crypto_models import CryptoCurrency, PriceData
from ..utils.logger import setup_logger
from ..utils.helpers import calculate_percentage_change, safe_divide

logger = setup_logger(__name__)

class PortfolioProcessor:
    """
    Processor for portfolio analytics and performance calculations
    """
    
    def __init__(self, db_service: DatabaseService, cache_service: CacheService):
        self.db_service = db_service
        self.cache_service = cache_service
    
    async def update_portfolio_values(self, portfolio_id: Optional[int] = None) -> int:
        """
        Update portfolio values and P&L calculations
        
        Args:
            portfolio_id: Specific portfolio ID to update (None for all)
            
        Returns:
            Number of portfolios updated
        """
        logger.info(f"Updating portfolio values (portfolio_id: {portfolio_id})")
        
        try:
            # Get portfolios to update
            if portfolio_id:
                with self.db_service.get_session() as session:
                    portfolios = session.query(Portfolio)\
                                      .filter(Portfolio.id == portfolio_id)\
                                      .filter(Portfolio.is_active == True)\
                                      .all()
            else:
                portfolios = self.db_service.get_all_portfolios(active_only=True)
            
            updated_count = 0
            
            for portfolio in portfolios:
                try:
                    # Calculate portfolio metrics
                    metrics = await self._calculate_portfolio_metrics(portfolio.id)
                    
                    if metrics:
                        # Update portfolio with calculated values
                        self.db_service.update_portfolio_value(
                            portfolio.id,
                            metrics['total_value'],
                            metrics['total_pnl']
                        )
                        
                        # Cache portfolio metrics
                        cache_key = CacheKeys.portfolio_value(portfolio.id)
                        self.cache_service.set(cache_key, metrics, ttl=300)  # 5 minutes
                        
                        updated_count += 1
                        logger.debug(f"Updated portfolio {portfolio.id}: ${metrics['total_value']:.2f}")
                
                except Exception as e:
                    logger.error(f"Error updating portfolio {portfolio.id}: {str(e)}")
                    continue
            
            logger.info(f"Successfully updated {updated_count} portfolios")
            return updated_count
            
        except Exception as e:
            logger.error(f"Error updating portfolio values: {str(e)}")
            return 0
    
    async def _calculate_portfolio_metrics(self, portfolio_id: int) -> Optional[Dict[str, Any]]:
        """
        Calculate comprehensive portfolio metrics
        
        Args:
            portfolio_id: Portfolio ID
            
        Returns:
            Dictionary with portfolio metrics or None if error
        """
        try:
            with self.db_service.get_session() as session:
                # Get all positions for the portfolio
                positions = session.query(Position, CryptoCurrency)\
                                 .join(CryptoCurrency)\
                                 .filter(Position.portfolio_id == portfolio_id)\
                                 .filter(Position.is_active == True)\
                                 .filter(Position.quantity > 0)\
                                 .all()
                
                if not positions:
                    return {
                        'total_value': 0,
                        'total_cost_basis': 0,
                        'total_pnl': 0,
                        'total_pnl_percentage': 0,
                        'positions_count': 0,
                        'top_holdings': []
                    }
                
                total_value = Decimal('0')
                total_cost_basis = Decimal('0')
                position_metrics = []
                
                for position, crypto in positions:
                    # Get latest price for the cryptocurrency
                    latest_price = self.db_service.get_latest_price_data(crypto.id)
                    
                    if latest_price:
                        current_price = latest_price.price_usd
                        position_value = position.quantity * current_price
                        position_cost = position.quantity * position.average_cost
                        position_pnl = position_value - position_cost
                        position_pnl_pct = calculate_percentage_change(
                            float(position_cost), float(position_value)
                        ) or 0
                        
                        # Update position with current values
                        position.current_price = current_price
                        position.current_value = position_value
                        position.unrealized_pnl = position_pnl
                        position.unrealized_pnl_percentage = Decimal(str(position_pnl_pct))
                        
                        total_value += position_value
                        total_cost_basis += position_cost
                        
                        position_metrics.append({
                            'symbol': crypto.symbol,
                            'name': crypto.name,
                            'quantity': float(position.quantity),
                            'current_price': float(current_price),
                            'value': float(position_value),
                            'cost_basis': float(position_cost),
                            'pnl': float(position_pnl),
                            'pnl_percentage': position_pnl_pct,
                            'weight': 0  # Will be calculated below
                        })
                
                session.commit()
                
                # Calculate position weights
                if total_value > 0:
                    for pos_metric in position_metrics:
                        pos_metric['weight'] = (pos_metric['value'] / float(total_value)) * 100
                
                # Sort positions by value (top holdings)
                position_metrics.sort(key=lambda x: x['value'], reverse=True)
                
                # Calculate overall P&L
                total_pnl = total_value - total_cost_basis
                total_pnl_percentage = calculate_percentage_change(
                    float(total_cost_basis), float(total_value)
                ) or 0
                
                return {
                    'total_value': float(total_value),
                    'total_cost_basis': float(total_cost_basis),
                    'total_pnl': float(total_pnl),
                    'total_pnl_percentage': total_pnl_percentage,
                    'positions_count': len(position_metrics),
                    'top_holdings': position_metrics[:10],  # Top 10 holdings
                    'updated_at': datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error calculating portfolio metrics for {portfolio_id}: {str(e)}")
            return None
    
    async def add_transaction(self, transaction_data: Dict[str, Any]) -> Optional[Transaction]:
        """
        Add a new transaction and update portfolio positions
        
        Args:
            transaction_data: Transaction data dictionary
            
        Returns:
            Created Transaction object or None if error
        """
        try:
            logger.info(f"Adding transaction: {transaction_data.get('transaction_type')} "
                       f"{transaction_data.get('quantity')} {transaction_data.get('symbol', 'N/A')}")
            
            # Get cryptocurrency
            crypto = self.db_service.get_cryptocurrency_by_symbol(
                transaction_data.get('symbol', '')
            )
            if not crypto:
                logger.error(f"Cryptocurrency not found: {transaction_data.get('symbol')}")
                return None
            
            with self.db_service.get_session() as session:
                # Create transaction
                transaction = Transaction(
                    portfolio_id=transaction_data['portfolio_id'],
                    cryptocurrency_id=crypto.id,
                    transaction_type=TransactionType(transaction_data['transaction_type']),
                    quantity=Decimal(str(transaction_data['quantity'])),
                    price=Decimal(str(transaction_data['price'])),
                    total_value=Decimal(str(transaction_data['quantity'])) * Decimal(str(transaction_data['price'])),
                    fee=Decimal(str(transaction_data.get('fee', 0))),
                    executed_at=transaction_data.get('executed_at', datetime.utcnow()),
                    exchange=transaction_data.get('exchange'),
                    notes=transaction_data.get('notes')
                )
                
                session.add(transaction)
                session.flush()
                
                # Update or create position
                await self._update_position_from_transaction(session, transaction)
                
                session.commit()
                session.refresh(transaction)
                
                # Invalidate portfolio cache
                cache_key = CacheKeys.portfolio_value(transaction.portfolio_id)
                self.cache_service.delete(cache_key)
                
                logger.info(f"Successfully added transaction {transaction.id}")
                return transaction
                
        except Exception as e:
            logger.error(f"Error adding transaction: {str(e)}")
            return None
    
    async def _update_position_from_transaction(self, session, transaction: Transaction):
        """
        Update portfolio position based on transaction
        
        Args:
            session: Database session
            transaction: Transaction object
        """
        # Get existing position
        position = session.query(Position)\
                         .filter(Position.portfolio_id == transaction.portfolio_id)\
                         .filter(Position.cryptocurrency_id == transaction.cryptocurrency_id)\
                         .first()
        
        if not position:
            # Create new position
            position = Position(
                portfolio_id=transaction.portfolio_id,
                cryptocurrency_id=transaction.cryptocurrency_id,
                quantity=Decimal('0'),
                average_cost=Decimal('0'),
                total_cost_basis=Decimal('0')
            )
            session.add(position)
        
        # Update position based on transaction type
        if transaction.transaction_type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
            # Add to position
            old_quantity = position.quantity
            old_cost_basis = position.total_cost_basis
            
            new_quantity = old_quantity + transaction.quantity
            new_cost_basis = old_cost_basis + transaction.total_value
            
            position.quantity = new_quantity
            position.total_cost_basis = new_cost_basis
            
            if new_quantity > 0:
                position.average_cost = new_cost_basis / new_quantity
            
        elif transaction.transaction_type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
            # Remove from position
            if position.quantity >= transaction.quantity:
                # Calculate realized P&L
                avg_cost_sold = position.average_cost * transaction.quantity
                realized_pnl = transaction.total_value - avg_cost_sold
                position.realized_pnl = (position.realized_pnl or Decimal('0')) + realized_pnl
                
                # Update position
                position.quantity -= transaction.quantity
                position.total_cost_basis -= avg_cost_sold
                
                # Deactivate position if quantity is zero
                if position.quantity == 0:
                    position.is_active = False
            else:
                logger.warning(f"Insufficient quantity for transaction {transaction.id}")
    
    async def calculate_portfolio_performance(self, portfolio_id: int, 
                                            days: int = 30) -> Optional[Dict[str, Any]]:
        """
        Calculate portfolio performance metrics over time period
        
        Args:
            portfolio_id: Portfolio ID
            days: Number of days to analyze
            
        Returns:
            Performance metrics dictionary or None if error
        """
        try:
            with self.db_service.get_session() as session:
                # Get portfolio transactions in the period
                start_date = datetime.utcnow() - timedelta(days=days)
                
                transactions = session.query(Transaction)\
                                    .filter(Transaction.portfolio_id == portfolio_id)\
                                    .filter(Transaction.executed_at >= start_date)\
                                    .order_by(Transaction.executed_at)\
                                    .all()
                
                if not transactions:
                    return None
                
                # Calculate metrics
                total_invested = sum(
                    float(t.total_value) for t in transactions 
                    if t.transaction_type in [TransactionType.BUY, TransactionType.TRANSFER_IN]
                )
                
                total_withdrawn = sum(
                    float(t.total_value) for t in transactions 
                    if t.transaction_type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]
                )
                
                net_invested = total_invested - total_withdrawn
                
                # Get current portfolio value
                current_metrics = await self._calculate_portfolio_metrics(portfolio_id)
                current_value = current_metrics['total_value'] if current_metrics else 0
                
                # Calculate returns
                if net_invested > 0:
                    total_return = current_value - net_invested
                    total_return_pct = (total_return / net_invested) * 100
                else:
                    total_return = 0
                    total_return_pct = 0
                
                # Calculate transaction statistics
                buy_transactions = [t for t in transactions if t.transaction_type == TransactionType.BUY]
                sell_transactions = [t for t in transactions if t.transaction_type == TransactionType.SELL]
                
                performance_metrics = {
                    'period_days': days,
                    'total_invested': total_invested,
                    'total_withdrawn': total_withdrawn,
                    'net_invested': net_invested,
                    'current_value': current_value,
                    'total_return': total_return,
                    'total_return_percentage': round(total_return_pct, 2),
                    'transaction_count': len(transactions),
                    'buy_count': len(buy_transactions),
                    'sell_count': len(sell_transactions),
                    'avg_buy_size': safe_divide(total_invested, len(buy_transactions)) if buy_transactions else 0,
                    'avg_sell_size': safe_divide(total_withdrawn, len(sell_transactions)) if sell_transactions else 0,
                    'calculated_at': datetime.utcnow().isoformat()
                }
                
                return performance_metrics
                
        except Exception as e:
            logger.error(f"Error calculating portfolio performance for {portfolio_id}: {str(e)}")
            return None
    
    async def get_portfolio_allocation(self, portfolio_id: int) -> Optional[Dict[str, Any]]:
        """
        Get portfolio asset allocation breakdown
        
        Args:
            portfolio_id: Portfolio ID
            
        Returns:
            Allocation breakdown or None if error
        """
        try:
            metrics = await self._calculate_portfolio_metrics(portfolio_id)
            
            if not metrics or metrics['total_value'] == 0:
                return None
            
            # Group by categories (simplified categorization)
            categories = {
                'Bitcoin': ['BTC'],
                'Ethereum': ['ETH'],
                'Layer 2': ['MATIC', 'ARB', 'OP', 'STRK'],
                'DeFi': ['UNI', 'AAVE', 'COMP', 'MKR', 'SNX'],
                'Stablecoins': ['USDT', 'USDC', 'DAI', 'BUSD'],
                'Other': []
            }
            
            allocation = {}
            uncategorized_value = 0
            
            for holding in metrics['top_holdings']:
                symbol = holding['symbol']
                value = holding['value']
                weight = holding['weight']
                
                categorized = False
                for category, symbols in categories.items():
                    if symbol in symbols:
                        if category not in allocation:
                            allocation[category] = {'value': 0, 'weight': 0, 'assets': []}
                        
                        allocation[category]['value'] += value
                        allocation[category]['weight'] += weight
                        allocation[category]['assets'].append({
                            'symbol': symbol,
                            'value': value,
                            'weight': weight
                        })
                        categorized = True
                        break
                
                if not categorized:
                    uncategorized_value += value
            
            # Add uncategorized assets to "Other"
            if uncategorized_value > 0:
                allocation['Other'] = {
                    'value': uncategorized_value,
                    'weight': (uncategorized_value / metrics['total_value']) * 100,
                    'assets': [
                        {
                            'symbol': h['symbol'],
                            'value': h['value'],
                            'weight': h['weight']
                        }
                        for h in metrics['top_holdings']
                        if not any(h['symbol'] in symbols for symbols in categories.values() if symbols)
                    ]
                }
            
            return {
                'portfolio_id': portfolio_id,
                'total_value': metrics['total_value'],
                'allocation': allocation,
                'diversification_score': self._calculate_diversification_score(allocation),
                'calculated_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting portfolio allocation for {portfolio_id}: {str(e)}")
            return None
    
    def _calculate_diversification_score(self, allocation: Dict[str, Any]) -> float:
        """
        Calculate portfolio diversification score (0-100)
        
        Args:
            allocation: Portfolio allocation data
            
        Returns:
            Diversification score
        """
        try:
            if not allocation:
                return 0
            
            # Calculate Herfindahl-Hirschman Index (HHI)
            weights = [cat_data['weight'] for cat_data in allocation.values()]
            hhi = sum((w/100) ** 2 for w in weights)
            
            # Convert to diversification score (inverse of concentration)
            # HHI ranges from 1/n to 1, where n is number of categories
            # Lower HHI = more diversified
            max_hhi = 1.0
            min_hhi = 1.0 / len(allocation) if allocation else 1.0
            
            # Normalize to 0-100 scale (100 = most diversified)
            if max_hhi > min_hhi:
                diversification_score = ((max_hhi - hhi) / (max_hhi - min_hhi)) * 100
            else:
                diversification_score = 100
            
            return round(diversification_score, 2)
            
        except Exception as e:
            logger.error(f"Error calculating diversification score: {str(e)}")
            return 0
    
    async def calculate_performance(self, portfolio_id: int, days: int = 30) -> Dict[str, Any]:
        """Calculate portfolio performance"""
        logger.info(f"Calculating performance for portfolio {portfolio_id}")
        
        # Dummy implementation
        return {
            "portfolio_id": portfolio_id,
            "period_days": days,
            "total_return": 8.5,
            "sharpe_ratio": 1.2,
            "max_drawdown": -5.2
        }
