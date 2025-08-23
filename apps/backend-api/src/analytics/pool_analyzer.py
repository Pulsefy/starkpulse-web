import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from dataclasses import dataclass
import statistics
from core.protocol_base import LiquidityPool, TokenInfo
from api.price_feeds import PriceFeedManager

logger = logging.getLogger(__name__)

@dataclass
class PoolMetrics:
    """Comprehensive pool performance metrics"""
    pool_address: str
    protocol_name: str
    token_pair: str
    
    # Basic metrics
    tvl_usd: Decimal
    volume_24h: Decimal
    volume_7d: Decimal
    volume_30d: Decimal
    fees_24h: Decimal
    fees_7d: Decimal
    fees_30d: Decimal
    
    # Performance metrics
    apr: Decimal
    apy: Decimal
    fee_apr: Decimal
    volume_to_tvl_ratio: Decimal
    
    # Risk metrics
    impermanent_loss_risk: str  # LOW, MEDIUM, HIGH
    volatility_score: Decimal
    liquidity_depth_score: Decimal
    
    # Efficiency metrics
    capital_efficiency: Decimal
    price_impact_1k: Decimal  # Price impact for $1k trade
    price_impact_10k: Decimal  # Price impact for $10k trade
    price_impact_100k: Decimal  # Price impact for $100k trade
    
    # Historical data
    price_change_24h: Decimal
    price_change_7d: Decimal
    tvl_change_24h: Decimal
    tvl_change_7d: Decimal
    
    # Health score (0-100)
    overall_health_score: Decimal
    
    # Timestamps
    calculated_at: datetime
    last_updated: datetime

@dataclass
class ImpermanentLossAnalysis:
    """Impermanent loss analysis for a pool"""
    pool_address: str
    token0_symbol: str
    token1_symbol: str
    
    # Current state
    current_price_ratio: Decimal
    entry_price_ratio: Decimal
    
    # IL calculations
    impermanent_loss_percentage: Decimal
    impermanent_loss_usd: Decimal
    
    # Scenarios
    il_at_2x_price: Decimal
    il_at_5x_price: Decimal
    il_at_10x_price: Decimal
    il_at_half_price: Decimal
    
    # Risk assessment
    risk_level: str
    recommendation: str

class PoolAnalyzer:
    """Advanced liquidity pool analytics and performance tracking"""
    
    def __init__(self, price_feed_manager: PriceFeedManager):
        self.price_feed = price_feed_manager
        self.historical_data: Dict[str, List[Dict]] = {}
        self.pool_metrics_cache: Dict[str, PoolMetrics] = {}
        
    async def analyze_pool(self, pool: LiquidityPool, protocol_name: str) -> PoolMetrics:
        """Perform comprehensive analysis of a liquidity pool"""
        try:
            logger.info(f"Analyzing pool {pool.address} ({pool.token0.symbol}/{pool.token1.symbol})")
            
            # Get current token prices
            token_prices = await self.price_feed.get_multiple_prices([
                pool.token0.symbol, 
                pool.token1.symbol
            ])
            
            # Update token prices in pool
            if pool.token0.symbol in token_prices:
                pool.token0.price_usd = token_prices[pool.token0.symbol]
            if pool.token1.symbol in token_prices:
                pool.token1.price_usd = token_prices[pool.token1.symbol]
            
            # Calculate basic metrics
            tvl_usd = await self._calculate_tvl(pool)
            volume_metrics = await self._calculate_volume_metrics(pool.address)
            fee_metrics = await self._calculate_fee_metrics(pool, volume_metrics)
            
            # Calculate performance metrics
            apr = await self._calculate_apr(pool, fee_metrics["fees_24h"], tvl_usd)
            apy = await self._calculate_apy(apr)
            fee_apr = await self._calculate_fee_apr(fee_metrics["fees_24h"], tvl_usd)
            
            # Calculate risk metrics
            risk_metrics = await self._calculate_risk_metrics(pool)
            
            # Calculate efficiency metrics
            efficiency_metrics = await self._calculate_efficiency_metrics(pool)
            
            # Calculate historical changes
            historical_metrics = await self._calculate_historical_changes(pool.address)
            
            # Calculate overall health score
            health_score = await self._calculate_health_score(
                pool, tvl_usd, volume_metrics, risk_metrics, efficiency_metrics
            )
            
            # Create comprehensive metrics object
            metrics = PoolMetrics(
                pool_address=pool.address,
                protocol_name=protocol_name,
                token_pair=f"{pool.token0.symbol}/{pool.token1.symbol}",
                
                # Basic metrics
                tvl_usd=tvl_usd,
                volume_24h=volume_metrics["volume_24h"],
                volume_7d=volume_metrics["volume_7d"],
                volume_30d=volume_metrics["volume_30d"],
                fees_24h=fee_metrics["fees_24h"],
                fees_7d=fee_metrics["fees_7d"],
                fees_30d=fee_metrics["fees_30d"],
                
                # Performance metrics
                apr=apr,
                apy=apy,
                fee_apr=fee_apr,
                volume_to_tvl_ratio=volume_metrics["volume_24h"] / tvl_usd if tvl_usd > 0 else Decimal('0'),
                
                # Risk metrics
                impermanent_loss_risk=risk_metrics["il_risk"],
                volatility_score=risk_metrics["volatility"],
                liquidity_depth_score=risk_metrics["liquidity_depth"],
                
                # Efficiency metrics
                capital_efficiency=efficiency_metrics["capital_efficiency"],
                price_impact_1k=efficiency_metrics["price_impact_1k"],
                price_impact_10k=efficiency_metrics["price_impact_10k"],
                price_impact_100k=efficiency_metrics["price_impact_100k"],
                
                # Historical data
                price_change_24h=historical_metrics["price_change_24h"],
                price_change_7d=historical_metrics["price_change_7d"],
                tvl_change_24h=historical_metrics["tvl_change_24h"],
                tvl_change_7d=historical_metrics["tvl_change_7d"],
                
                # Health score
                overall_health_score=health_score,
                
                # Timestamps
                calculated_at=datetime.utcnow(),
                last_updated=datetime.utcnow()
            )
            
            # Cache the metrics
            self.pool_metrics_cache[pool.address] = metrics
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error analyzing pool {pool.address}: {e}")
            raise
    
    async def calculate_impermanent_loss(
        self, 
        pool: LiquidityPool, 
        entry_price_ratio: Optional[Decimal] = None
    ) -> ImpermanentLossAnalysis:
        """Calculate impermanent loss for a liquidity position"""
        try:
            # Get current prices
            token_prices = await self.price_feed.get_multiple_prices([
                pool.token0.symbol, 
                pool.token1.symbol
            ])
            
            if not all(symbol in token_prices for symbol in [pool.token0.symbol, pool.token1.symbol]):
                raise ValueError("Unable to get token prices for IL calculation")
            
            # Calculate current price ratio
            current_price_ratio = token_prices[pool.token1.symbol] / token_prices[pool.token0.symbol]
            
            # Use entry price ratio or assume current ratio as entry
            if entry_price_ratio is None:
                entry_price_ratio = current_price_ratio
            
            # Calculate impermanent loss
            price_ratio_change = current_price_ratio / entry_price_ratio
            
            # IL formula: IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
            il_multiplier = (2 * (price_ratio_change ** Decimal('0.5'))) / (1 + price_ratio_change) - 1
            il_percentage = il_multiplier * 100
            
            # Calculate IL in USD (assuming $1000 initial position)
            initial_position_value = Decimal('1000')
            il_usd = initial_position_value * abs(il_multiplier)
            
            # Calculate IL at different price scenarios
            scenarios = {
                "2x": Decimal('2'),
                "5x": Decimal('5'),
                "10x": Decimal('10'),
                "0.5x": Decimal('0.5')
            }
            
            il_scenarios = {}
            for scenario, multiplier in scenarios.items():
                scenario_ratio = entry_price_ratio * multiplier
                scenario_change = scenario_ratio / entry_price_ratio
                scenario_il = ((2 * (scenario_change ** Decimal('0.5'))) / (1 + scenario_change) - 1) * 100
                il_scenarios[f"il_at_{scenario}_price"] = scenario_il
            
            # Determine risk level
            risk_level = self._determine_il_risk_level(abs(il_percentage))
            recommendation = self._get_il_recommendation(risk_level, il_percentage)
            
            return ImpermanentLossAnalysis(
                pool_address=pool.address,
                token0_symbol=pool.token0.symbol,
                token1_symbol=pool.token1.symbol,
                current_price_ratio=current_price_ratio,
                entry_price_ratio=entry_price_ratio,
                impermanent_loss_percentage=il_percentage,
                impermanent_loss_usd=il_usd,
                il_at_2x_price=il_scenarios["il_at_2x_price"],
                il_at_5x_price=il_scenarios["il_at_5x_price"],
                il_at_10x_price=il_scenarios["il_at_10x_price"],
                il_at_half_price=il_scenarios["il_at_0.5x_price"],
                risk_level=risk_level,
                recommendation=recommendation
            )
            
        except Exception as e:
            logger.error(f"Error calculating impermanent loss for pool {pool.address}: {e}")
            raise
    
    async def compare_pools(self, pools: List[Tuple[LiquidityPool, str]]) -> Dict[str, Any]:
        """Compare multiple pools across various metrics"""
        try:
            logger.info(f"Comparing {len(pools)} pools")
            
            pool_analyses = []
            for pool, protocol_name in pools:
                try:
                    metrics = await self.analyze_pool(pool, protocol_name)
                    pool_analyses.append(metrics)
                except Exception as e:
                    logger.warning(f"Error analyzing pool {pool.address}: {e}")
                    continue
            
            if not pool_analyses:
                return {"error": "No pools could be analyzed"}
            
            # Sort pools by different metrics
            comparison = {
                "total_pools": len(pool_analyses),
                "best_apr": max(pool_analyses, key=lambda x: x.apr),
                "highest_tvl": max(pool_analyses, key=lambda x: x.tvl_usd),
                "highest_volume": max(pool_analyses, key=lambda x: x.volume_24h),
                "lowest_risk": min(pool_analyses, key=lambda x: x.volatility_score),
                "best_efficiency": max(pool_analyses, key=lambda x: x.capital_efficiency),
                "healthiest": max(pool_analyses, key=lambda x: x.overall_health_score),
                
                # Summary statistics
                "avg_apr": statistics.mean([p.apr for p in pool_analyses]),
                "avg_tvl": statistics.mean([p.tvl_usd for p in pool_analyses]),
                "total_tvl": sum([p.tvl_usd for p in pool_analyses]),
                "total_volume_24h": sum([p.volume_24h for p in pool_analyses]),
                
                # All pool data
                "all_pools": pool_analyses
            }
            
            return comparison
            
        except Exception as e:
            logger.error(f"Error comparing pools: {e}")
            return {"error": str(e)}
    
    async def get_pool_recommendations(
        self, 
        risk_tolerance: str = "medium",  # low, medium, high
        min_tvl: Decimal = Decimal('10000'),
        preferred_tokens: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Get pool recommendations based on user preferences"""
        try:
            recommendations = []
            
            # Filter pools based on criteria
            for pool_address, metrics in self.pool_metrics_cache.items():
                if metrics.tvl_usd < min_tvl:
                    continue
                
                # Check token preferences
                if preferred_tokens:
                    token_pair = metrics.token_pair.split('/')
                    if not any(token in preferred_tokens for token in token_pair):
                        continue
                
                # Risk tolerance filtering
                risk_score = self._calculate_risk_score(metrics)
                
                if risk_tolerance == "low" and risk_score > 3:
                    continue
                elif risk_tolerance == "medium" and risk_score > 6:
                    continue
                # High risk tolerance accepts all
                
                # Calculate recommendation score
                rec_score = self._calculate_recommendation_score(metrics, risk_tolerance)
                
                recommendations.append({
                    "pool_address": pool_address,
                    "metrics": metrics,
                    "recommendation_score": rec_score,
                    "risk_score": risk_score,
                    "reasons": self._get_recommendation_reasons(metrics, risk_tolerance)
                })
            
            # Sort by recommendation score
            recommendations.sort(key=lambda x: x["recommendation_score"], reverse=True)
            
            return recommendations[:10]  # Top 10 recommendations
            
        except Exception as e:
            logger.error(f"Error getting pool recommendations: {e}")
            return []
    
    async def _calculate_tvl(self, pool: LiquidityPool) -> Decimal:
        """Calculate Total Value Locked in USD"""
        try:
            if not pool.token0.price_usd or not pool.token1.price_usd:
                return Decimal('0')
            
            tvl = (
                pool.reserve0 * pool.token0.price_usd +
                pool.reserve1 * pool.token1.price_usd
            )
            return tvl.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
        except Exception as e:
            logger.error(f"Error calculating TVL: {e}")
            return Decimal('0')
    
    async def _calculate_volume_metrics(self, pool_address: str) -> Dict[str, Decimal]:
        """Calculate volume metrics for different time periods"""
        try:
            # In a real implementation, this would query historical transaction data
            # For demo, return mock values based on pool activity
            
            base_volume = Decimal('50000')  # Base daily volume
            
            return {
                "volume_24h": base_volume,
                "volume_7d": base_volume * 7,
                "volume_30d": base_volume * 30
            }
            
        except Exception as e:
            logger.error(f"Error calculating volume metrics: {e}")
            return {
                "volume_24h": Decimal('0'),
                "volume_7d": Decimal('0'),
                "volume_30d": Decimal('0')
            }
    
    async def _calculate_fee_metrics(self, pool: LiquidityPool, volume_metrics: Dict) -> Dict[str, Decimal]:
        """Calculate fee earnings for different time periods"""
        try:
            fee_rate = pool.fee_tier  # e.g., 0.003 for 0.3%
            
            return {
                "fees_24h": volume_metrics["volume_24h"] * fee_rate,
                "fees_7d": volume_metrics["volume_7d"] * fee_rate,
                "fees_30d": volume_metrics["volume_30d"] * fee_rate
            }
            
        except Exception as e:
            logger.error(f"Error calculating fee metrics: {e}")
            return {
                "fees_24h": Decimal('0'),
                "fees_7d": Decimal('0'),
                "fees_30d": Decimal('0')
            }
    
    async def _calculate_apr(self, pool: LiquidityPool, daily_fees: Decimal, tvl: Decimal) -> Decimal:
        """Calculate Annual Percentage Rate"""
        try:
            if tvl == 0:
                return Decimal('0')
            
            # APR = (daily_fees * 365) / TVL * 100
            apr = (daily_fees * 365) / tvl * 100
            return apr.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
        except Exception as e:
            logger.error(f"Error calculating APR: {e}")
            return Decimal('0')
    
    async def _calculate_apy(self, apr: Decimal) -> Decimal:
        """Calculate Annual Percentage Yield (compound interest)"""
        try:
            # APY = (1 + APR/365)^365 - 1
            # Simplified calculation for daily compounding
            daily_rate = apr / 100 / 365
            apy = ((1 + daily_rate) ** 365 - 1) * 100
            return Decimal(str(apy)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
        except Exception as e:
            logger.error(f"Error calculating APY: {e}")
            return apr  # Fallback to APR
    
    async def _calculate_fee_apr(self, daily_fees: Decimal, tvl: Decimal) -> Decimal:
        """Calculate APR from fees only (excluding token rewards)"""
        return await self._calculate_apr(None, daily_fees, tvl)
    
    async def _calculate_risk_metrics(self, pool: LiquidityPool) -> Dict[str, Any]:
        """Calculate various risk metrics for the pool"""
        try:
            # Get token price volatility (simplified)
            volatility = await self._calculate_token_volatility(pool)
            
            # Determine IL risk based on token correlation
            il_risk = self._determine_il_risk(pool)
            
            # Calculate liquidity depth score
            liquidity_depth = self._calculate_liquidity_depth_score(pool)
            
            return {
                "volatility": volatility,
                "il_risk": il_risk,
                "liquidity_depth": liquidity_depth
            }
            
        except Exception as e:
            logger.error(f"Error calculating risk metrics: {e}")
            return {
                "volatility": Decimal('5'),
                "il_risk": "MEDIUM",
                "liquidity_depth": Decimal('5')
            }
    
    async def _calculate_efficiency_metrics(self, pool: LiquidityPool) -> Dict[str, Decimal]:
        """Calculate capital efficiency metrics"""
        try:
            # Calculate price impact for different trade sizes
            price_impacts = {}
            trade_sizes = [1000, 10000, 100000]  # $1k, $10k, $100k
            
            for size in trade_sizes:
                impact = self._calculate_price_impact_for_trade(pool, Decimal(str(size)))
                price_impacts[f"price_impact_{size//1000}k"] = impact
            
            # Calculate capital efficiency (volume/TVL ratio)
            tvl = await self._calculate_tvl(pool)
            volume_24h = Decimal('50000')  # Mock volume
            
            capital_efficiency = volume_24h / tvl if tvl > 0 else Decimal('0')
            
            return {
                "capital_efficiency": capital_efficiency,
                **price_impacts
            }
            
        except Exception as e:
            logger.error(f"Error calculating efficiency metrics: {e}")
            return {
                "capital_efficiency": Decimal('0'),
                "price_impact_1k": Decimal('0'),
                "price_impact_10k": Decimal('0'),
                "price_impact_100k": Decimal('0')
            }
    
    async def _calculate_historical_changes(self, pool_address: str) -> Dict[str, Decimal]:
        """Calculate historical price and TVL changes"""
        try:
            # In a real implementation, this would query historical data
            # For demo, return mock values
            
            return {
                "price_change_24h": Decimal('2.5'),   # +2.5%
                "price_change_7d": Decimal('-1.2'),   # -1.2%
                "tvl_change_24h": Decimal('5.8'),     # +5.8%
                "tvl_change_7d": Decimal('12.3')      # +12.3%
            }
            
        except Exception as e:
            logger.error(f"Error calculating historical changes: {e}")
            return {
                "price_change_24h": Decimal('0'),
                "price_change_7d": Decimal('0'),
                "tvl_change_24h": Decimal('0'),
                "tvl_change_7d": Decimal('0')
            }
    
    async def _calculate_health_score(
        self, 
        pool: LiquidityPool, 
        tvl: Decimal, 
        volume_metrics: Dict, 
        risk_metrics: Dict, 
        efficiency_metrics: Dict
    ) -> Decimal:
        """Calculate overall pool health score (0-100)"""
        try:
            score = Decimal('0')
            
            # TVL score (0-25 points)
            if tvl > 1000000:  # >$1M
                score += Decimal('25')
            elif tvl > 100000:  # >$100k
                score += Decimal('20')
            elif tvl > 10000:   # >$10k
                score += Decimal('15')
            else:
                score += Decimal('5')
            
            # Volume score (0-25 points)
            volume_to_tvl = volume_metrics["volume_24h"] / tvl if tvl > 0 else Decimal('0')
            if volume_to_tvl > Decimal('1'):  # >100% daily turnover
                score += Decimal('25')
            elif volume_to_tvl > Decimal('0.5'):  # >50%
                score += Decimal('20')
            elif volume_to_tvl > Decimal('0.1'):  # >10%
                score += Decimal('15')
            else:
                score += Decimal('5')
            
            # Risk score (0-25 points) - lower risk = higher score
            volatility = risk_metrics["volatility"]
            if volatility < 3:
                score += Decimal('25')
            elif volatility < 5:
                score += Decimal('20')
            elif volatility < 7:
                score += Decimal('15')
            else:
                score += Decimal('5')
            
            # Efficiency score (0-25 points)
            capital_eff = efficiency_metrics["capital_efficiency"]
            if capital_eff > Decimal('2'):
                score += Decimal('25')
            elif capital_eff > Decimal('1'):
                score += Decimal('20')
            elif capital_eff > Decimal('0.5'):
                score += Decimal('15')
            else:
                score += Decimal('5')
            
            return score.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
            
        except Exception as e:
            logger.error(f"Error calculating health score: {e}")
            return Decimal('50')  # Default middle score
    
    def _calculate_price_impact_for_trade(self, pool: LiquidityPool, trade_size_usd: Decimal) -> Decimal:
        """Calculate price impact for a specific trade size"""
        try:
            # Simplified price impact calculation
            # In reality, this would use the constant product formula
            
            tvl = pool.reserve0 * (pool.token0.price_usd or Decimal('1')) + \
                  pool.reserve1 * (pool.token1.price_usd or Decimal('1'))
            
            if tvl == 0:
                return Decimal('100')  # 100% impact if no liquidity
            
            # Simple approximation: impact = (trade_size / tvl) * 100
            impact = (trade_size_usd / tvl) * 100
            
            # Cap at 100%
            return min(impact, Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
        except Exception as e:
            logger.error(f"Error calculating price impact: {e}")
            return Decimal('10')  # Default 10% impact
    
    async def _calculate_token_volatility(self, pool: LiquidityPool) -> Decimal:
        """Calculate token pair volatility score (0-10)"""
        try:
            # Simplified volatility calculation based on token types
            stable_tokens = ["USDC", "USDT", "DAI", "FRAX"]
            
            token0_stable = pool.token0.symbol in stable_tokens
            token1_stable = pool.token1.symbol in stable_tokens
            
            if token0_stable and token1_stable:
                return Decimal('1')  # Very low volatility
            elif token0_stable or token1_stable:
                return Decimal('4')  # Medium volatility
            else:
                return Decimal('7')  # High volatility
                
        except Exception as e:
            logger.error(f"Error calculating volatility: {e}")
            return Decimal('5')  # Default medium volatility
    
    def _determine_il_risk(self, pool: LiquidityPool) -> str:
        """Determine impermanent loss risk level"""
        try:
            stable_tokens = ["USDC", "USDT", "DAI", "FRAX"]
            correlated_pairs = [
                ("ETH", "WETH"),
                ("USDC", "USDT"),
                ("USDC", "DAI")
            ]
            
            token0 = pool.token0.symbol
            token1 = pool.token1.symbol
            
            # Check if both tokens are stablecoins
            if token0 in stable_tokens and token1 in stable_tokens:
                return "LOW"
            
            # Check if tokens are highly correlated
            for pair in correlated_pairs:
                if (token0 in pair and token1 in pair):
                    return "LOW"
            
            # Check if one token is stable
            if token0 in stable_tokens or token1 in stable_tokens:
                return "MEDIUM"
            
            # Both tokens are volatile
            return "HIGH"
            
        except Exception as e:
            logger.error(f"Error determining IL risk: {e}")
            return "MEDIUM"
    
    def _calculate_liquidity_depth_score(self, pool: LiquidityPool) -> Decimal:
        """Calculate liquidity depth score (0-10)"""
        try:
            # Based on total reserves value
            total_reserves_usd = (
                pool.reserve0 * (pool.token0.price_usd or Decimal('1')) +
                pool.reserve1 * (pool.token1.price_usd or Decimal('1'))
            )
            
            if total_reserves_usd > 10000000:  # >$10M
                return Decimal('10')
            elif total_reserves_usd > 1000000:  # >$1M
                return Decimal('8')
            elif total_reserves_usd > 100000:   # >$100k
                return Decimal('6')
            elif total_reserves_usd > 10000:    # >$10k
                return Decimal('4')
            else:
                return Decimal('2')
                
        except Exception as e:
            logger.error(f"Error calculating liquidity depth: {e}")
            return Decimal('5')
    
    def _determine_il_risk_level(self, il_percentage: Decimal) -> str:
        """Determine IL risk level based on percentage"""
        if il_percentage < 1:
            return "LOW"
        elif il_percentage < 5:
            return "MEDIUM"
        else:
            return "HIGH"
    
    def _get_il_recommendation(self, risk_level: str, il_percentage: Decimal) -> str:
        """Get recommendation based on IL analysis"""
        if risk_level == "LOW":
            return "Safe for long-term liquidity provision"
        elif risk_level == "MEDIUM":
            return "Monitor price movements, consider shorter timeframes"
        else:
            return "High IL risk - only suitable for experienced LPs or short-term positions"
    
    def _calculate_risk_score(self, metrics: PoolMetrics) -> int:
        """Calculate overall risk score (0-10)"""
        score = 0
        
        # Volatility contribution
        score += int(metrics.volatility_score)
        
        # IL risk contribution
        if metrics.impermanent_loss_risk == "HIGH":
            score += 3
        elif metrics.impermanent_loss_risk == "MEDIUM":
            score += 2
        else:
            score += 1
        
        # Liquidity depth (inverse - lower depth = higher risk)
        score += max(0, 5 - int(metrics.liquidity_depth_score // 2))
        
        return min(score, 10)
    
    def _calculate_recommendation_score(self, metrics: PoolMetrics, risk_tolerance: str) -> Decimal:
        """Calculate recommendation score based on metrics and user preferences"""
        score = Decimal('0')
        
        # APR contribution (0-40 points)
        apr_score = min(metrics.apr / 2, Decimal('40'))  # Cap at 40 points
        score += apr_score
        
        # TVL contribution (0-20 points)
        if metrics.tvl_usd > 1000000:
            score += Decimal('20')
        elif metrics.tvl_usd > 100000:
            score += Decimal('15')
        else:
            score += Decimal('10')
        
        # Volume contribution (0-20 points)
        volume_score = min(metrics.volume_to_tvl_ratio * 20, Decimal('20'))
        score += volume_score
        
        # Risk adjustment based on tolerance
        risk_penalty = Decimal('0')
        if risk_tolerance == "low":
            if metrics.impermanent_loss_risk == "HIGH":
                risk_penalty = Decimal('30')
            elif metrics.impermanent_loss_risk == "MEDIUM":
                risk_penalty = Decimal('10')
        elif risk_tolerance == "medium":
            if metrics.impermanent_loss_risk == "HIGH":
                risk_penalty = Decimal('15')
        
        score -= risk_penalty
        
        # Health score contribution (0-20 points)
        health_contribution = metrics.overall_health_score / 5  # Scale to 20 points
        score += health_contribution
        
        return max(score, Decimal('0'))
    
    def _get_recommendation_reasons(self, metrics: PoolMetrics, risk_tolerance: str) -> List[str]:
        """Get reasons for recommendation"""
        reasons = []
        
        if metrics.apr > 20:
            reasons.append(f"High APR of {metrics.apr:.1f}%")
        
        if metrics.tvl_usd > 1000000:
            reasons.append("High liquidity with >$1M TVL")
        
        if metrics.volume_to_tvl_ratio > 1:
            reasons.append("Excellent trading activity")
        
        if metrics.impermanent_loss_risk == "LOW":
            reasons.append("Low impermanent loss risk")
        
        if metrics.overall_health_score > 80:
            reasons.append("Excellent overall pool health")
        
        return reasons
