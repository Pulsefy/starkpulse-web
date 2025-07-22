"""
Portfolio Optimization Engine

This module provides comprehensive portfolio optimization capabilities including:
- Modern Portfolio Theory (MPT) optimization
- Efficient frontier calculation
- Risk parity and equal risk contribution portfolios
- Black-Litterman model implementation
- Robust optimization techniques
- Multi-objective optimization
"""

import numpy as np
import pandas as pd
from scipy.optimize import minimize, differential_evolution
from scipy import linalg
from typing import Dict, List, Optional, Tuple, Union, Callable
import warnings
from datetime import datetime
import cvxpy as cp

warnings.filterwarnings('ignore')


class PortfolioOptimizer:
    """
    Comprehensive portfolio optimization engine implementing various optimization strategies
    """
    
    def __init__(self, risk_free_rate: float = 0.02):
        """
        Initialize portfolio optimizer
        
        Args:
            risk_free_rate: Annual risk-free rate
        """
        self.risk_free_rate = risk_free_rate
        self.daily_rf_rate = risk_free_rate / 252
    
    def optimize_portfolio(self, 
                          expected_returns: pd.Series,
                          covariance_matrix: pd.DataFrame,
                          optimization_method: str = 'max_sharpe',
                          constraints: Dict = None,
                          target_return: float = None,
                          target_risk: float = None) -> Dict:
        """
        Optimize portfolio using specified method
        
        Args:
            expected_returns: Expected returns for each asset
            covariance_matrix: Covariance matrix of asset returns
            optimization_method: Optimization objective ('max_sharpe', 'min_variance', 'max_return', 'risk_parity')
            constraints: Additional constraints dictionary
            target_return: Target return for efficient frontier point
            target_risk: Target risk for efficient frontier point
            
        Returns:
            Dictionary containing optimal weights and portfolio metrics
        """
        n_assets = len(expected_returns)
        
        # Default constraints
        if constraints is None:
            constraints = {
                'weight_bounds': (0, 1),  # Long-only by default
                'sum_weights': 1.0
            }
        
        # Choose optimization method
        if optimization_method == 'max_sharpe':
            result = self._optimize_max_sharpe(expected_returns, covariance_matrix, constraints)
        elif optimization_method == 'min_variance':
            result = self._optimize_min_variance(expected_returns, covariance_matrix, constraints)
        elif optimization_method == 'max_return':
            result = self._optimize_max_return(expected_returns, covariance_matrix, constraints)
        elif optimization_method == 'risk_parity':
            result = self._optimize_risk_parity(expected_returns, covariance_matrix, constraints)
        elif optimization_method == 'target_return':
            if target_return is None:
                raise ValueError("target_return must be specified for target_return optimization")
            result = self._optimize_target_return(expected_returns, covariance_matrix, target_return, constraints)
        elif optimization_method == 'target_risk':
            if target_risk is None:
                raise ValueError("target_risk must be specified for target_risk optimization")
            result = self._optimize_target_risk(expected_returns, covariance_matrix, target_risk, constraints)
        else:
            raise ValueError(f"Unknown optimization method: {optimization_method}")
        
        # Calculate portfolio metrics
        if result['success']:
            weights = result['weights']
            portfolio_metrics = self._calculate_portfolio_metrics(weights, expected_returns, covariance_matrix)
            result.update(portfolio_metrics)
        
        return result
    
    def calculate_efficient_frontier(self, 
                                   expected_returns: pd.Series,
                                   covariance_matrix: pd.DataFrame,
                                   num_points: int = 100,
                                   constraints: Dict = None) -> pd.DataFrame:
        """
        Calculate efficient frontier
        
        Args:
            expected_returns: Expected returns for each asset
            covariance_matrix: Covariance matrix of asset returns
            num_points: Number of points on the efficient frontier
            constraints: Portfolio constraints
            
        Returns:
            DataFrame with efficient frontier points
        """
        if constraints is None:
            constraints = {'weight_bounds': (0, 1), 'sum_weights': 1.0}
        
        # Calculate minimum variance portfolio
        min_var_result = self._optimize_min_variance(expected_returns, covariance_matrix, constraints)
        min_return = min_var_result['expected_return']
        
        # Calculate maximum return portfolio
        max_ret_result = self._optimize_max_return(expected_returns, covariance_matrix, constraints)
        max_return = max_ret_result['expected_return']
        
        # Generate target returns
        target_returns = np.linspace(min_return, max_return, num_points)
        
        frontier_points = []
        
        for target_return in target_returns:
            try:
                result = self._optimize_target_return(expected_returns, covariance_matrix, target_return, constraints)
                if result['success']:
                    frontier_points.append({
                        'target_return': target_return,
                        'expected_return': result['expected_return'],
                        'volatility': result['volatility'],
                        'sharpe_ratio': result['sharpe_ratio'],
                        'weights': result['weights']
                    })
            except:
                continue
        
        return pd.DataFrame(frontier_points)
    
    def optimize_black_litterman(self,
                               market_caps: pd.Series,
                               expected_returns: pd.Series,
                               covariance_matrix: pd.DataFrame,
                               views_matrix: np.ndarray = None,
                               views_returns: np.ndarray = None,
                               views_uncertainty: np.ndarray = None,
                               tau: float = 0.025,
                               risk_aversion: float = 3.0) -> Dict:
        """
        Implement Black-Litterman portfolio optimization
        
        Args:
            market_caps: Market capitalizations for each asset
            expected_returns: Historical expected returns
            covariance_matrix: Covariance matrix of asset returns
            views_matrix: Matrix linking views to assets
            views_returns: Expected returns from views
            views_uncertainty: Uncertainty matrix for views
            tau: Scaling factor for uncertainty
            risk_aversion: Risk aversion parameter
            
        Returns:
            Dictionary containing Black-Litterman optimal portfolio
        """
        # Market capitalization weights (equilibrium portfolio)
        w_market = market_caps / market_caps.sum()
        
        # Implied equilibrium returns
        pi = risk_aversion * covariance_matrix.dot(w_market)
        
        # If no views provided, return market portfolio
        if views_matrix is None:
            weights = w_market
        else:
            # Black-Litterman calculation
            tau_sigma = tau * covariance_matrix
            
            if views_uncertainty is None:
                # Default uncertainty based on view confidence
                views_uncertainty = np.diag(np.diag(views_matrix.dot(tau_sigma).dot(views_matrix.T)))
            
            # Calculate new expected returns
            M1 = linalg.inv(tau_sigma)
            M2 = views_matrix.T.dot(linalg.inv(views_uncertainty)).dot(views_matrix)
            M3 = linalg.inv(tau_sigma).dot(pi) + views_matrix.T.dot(linalg.inv(views_uncertainty)).dot(views_returns)
            
            mu_bl = linalg.inv(M1 + M2).dot(M3)
            
            # Calculate new covariance matrix
            cov_bl = linalg.inv(M1 + M2)
            
            # Optimize portfolio with Black-Litterman inputs
            weights = linalg.inv(risk_aversion * cov_bl).dot(mu_bl)
            weights = weights / weights.sum()  # Normalize
        
        # Calculate portfolio metrics
        portfolio_metrics = self._calculate_portfolio_metrics(weights, expected_returns, covariance_matrix)
        
        return {
            'weights': pd.Series(weights, index=expected_returns.index),
            'success': True,
            **portfolio_metrics
        }
    
    def optimize_risk_parity(self,
                           expected_returns: pd.Series,
                           covariance_matrix: pd.DataFrame,
                           constraints: Dict = None) -> Dict:
        """
        Optimize for risk parity (equal risk contribution) portfolio
        """
        return self._optimize_risk_parity(expected_returns, covariance_matrix, constraints)

    # Private optimization methods
    def _optimize_max_sharpe(self, expected_returns: pd.Series, covariance_matrix: pd.DataFrame, constraints: Dict) -> Dict:
        """Optimize for maximum Sharpe ratio"""
        n_assets = len(expected_returns)

        def objective(weights):
            portfolio_return = np.dot(weights, expected_returns)
            portfolio_variance = np.dot(weights.T, np.dot(covariance_matrix, weights))
            portfolio_std = np.sqrt(portfolio_variance)
            sharpe_ratio = (portfolio_return - self.daily_rf_rate * 252) / portfolio_std
            return -sharpe_ratio  # Minimize negative Sharpe ratio

        # Constraints
        cons = [{'type': 'eq', 'fun': lambda x: np.sum(x) - constraints['sum_weights']}]

        # Bounds
        bounds = tuple([constraints['weight_bounds']] * n_assets)

        # Initial guess
        x0 = np.array([1/n_assets] * n_assets)

        # Optimize
        result = minimize(objective, x0, method='SLSQP', bounds=bounds, constraints=cons)

        return {
            'weights': pd.Series(result.x, index=expected_returns.index),
            'success': result.success,
            'message': result.message
        }

    def _optimize_min_variance(self, expected_returns: pd.Series, covariance_matrix: pd.DataFrame, constraints: Dict) -> Dict:
        """Optimize for minimum variance"""
        n_assets = len(expected_returns)

        def objective(weights):
            return np.dot(weights.T, np.dot(covariance_matrix, weights))

        # Constraints
        cons = [{'type': 'eq', 'fun': lambda x: np.sum(x) - constraints['sum_weights']}]

        # Bounds
        bounds = tuple([constraints['weight_bounds']] * n_assets)

        # Initial guess
        x0 = np.array([1/n_assets] * n_assets)

        # Optimize
        result = minimize(objective, x0, method='SLSQP', bounds=bounds, constraints=cons)

        return {
            'weights': pd.Series(result.x, index=expected_returns.index),
            'success': result.success,
            'message': result.message
        }

    def _optimize_max_return(self, expected_returns: pd.Series, covariance_matrix: pd.DataFrame, constraints: Dict) -> Dict:
        """Optimize for maximum return"""
        n_assets = len(expected_returns)

        def objective(weights):
            return -np.dot(weights, expected_returns)  # Minimize negative return

        # Constraints
        cons = [{'type': 'eq', 'fun': lambda x: np.sum(x) - constraints['sum_weights']}]

        # Bounds
        bounds = tuple([constraints['weight_bounds']] * n_assets)

        # Initial guess
        x0 = np.array([1/n_assets] * n_assets)

        # Optimize
        result = minimize(objective, x0, method='SLSQP', bounds=bounds, constraints=cons)

        return {
            'weights': pd.Series(result.x, index=expected_returns.index),
            'success': result.success,
            'message': result.message
        }

    def _optimize_target_return(self, expected_returns: pd.Series, covariance_matrix: pd.DataFrame,
                              target_return: float, constraints: Dict) -> Dict:
        """Optimize for target return with minimum risk"""
        n_assets = len(expected_returns)

        def objective(weights):
            return np.dot(weights.T, np.dot(covariance_matrix, weights))

        # Constraints
        cons = [
            {'type': 'eq', 'fun': lambda x: np.sum(x) - constraints['sum_weights']},
            {'type': 'eq', 'fun': lambda x: np.dot(x, expected_returns) - target_return}
        ]

        # Bounds
        bounds = tuple([constraints['weight_bounds']] * n_assets)

        # Initial guess
        x0 = np.array([1/n_assets] * n_assets)

        # Optimize
        result = minimize(objective, x0, method='SLSQP', bounds=bounds, constraints=cons)

        return {
            'weights': pd.Series(result.x, index=expected_returns.index),
            'success': result.success,
            'message': result.message
        }

    def _optimize_target_risk(self, expected_returns: pd.Series, covariance_matrix: pd.DataFrame,
                            target_risk: float, constraints: Dict) -> Dict:
        """Optimize for target risk with maximum return"""
        n_assets = len(expected_returns)

        def objective(weights):
            return -np.dot(weights, expected_returns)  # Minimize negative return

        # Constraints
        cons = [
            {'type': 'eq', 'fun': lambda x: np.sum(x) - constraints['sum_weights']},
            {'type': 'eq', 'fun': lambda x: np.sqrt(np.dot(x.T, np.dot(covariance_matrix, x))) - target_risk}
        ]

        # Bounds
        bounds = tuple([constraints['weight_bounds']] * n_assets)

        # Initial guess
        x0 = np.array([1/n_assets] * n_assets)

        # Optimize
        result = minimize(objective, x0, method='SLSQP', bounds=bounds, constraints=cons)

        return {
            'weights': pd.Series(result.x, index=expected_returns.index),
            'success': result.success,
            'message': result.message
        }

    def _optimize_risk_parity(self, expected_returns: pd.Series, covariance_matrix: pd.DataFrame, constraints: Dict) -> Dict:
        """Optimize for risk parity (equal risk contribution)"""
        n_assets = len(expected_returns)

        def risk_budget_objective(weights):
            """
            Objective function for risk parity optimization
            Minimizes the sum of squared differences between risk contributions
            """
            weights = np.array(weights)
            portfolio_variance = np.dot(weights.T, np.dot(covariance_matrix, weights))

            # Marginal risk contributions
            marginal_contrib = np.dot(covariance_matrix, weights)

            # Risk contributions
            risk_contrib = weights * marginal_contrib / portfolio_variance

            # Target risk contribution (equal for all assets)
            target_risk_contrib = 1.0 / n_assets

            # Sum of squared deviations from target
            return np.sum((risk_contrib - target_risk_contrib) ** 2)

        # Constraints
        cons = [{'type': 'eq', 'fun': lambda x: np.sum(x) - constraints['sum_weights']}]

        # Bounds
        bounds = tuple([constraints['weight_bounds']] * n_assets)

        # Initial guess
        x0 = np.array([1/n_assets] * n_assets)

        # Optimize
        result = minimize(risk_budget_objective, x0, method='SLSQP', bounds=bounds, constraints=cons)

        return {
            'weights': pd.Series(result.x, index=expected_returns.index),
            'success': result.success,
            'message': result.message
        }

    def _calculate_portfolio_metrics(self, weights: Union[np.ndarray, pd.Series],
                                   expected_returns: pd.Series,
                                   covariance_matrix: pd.DataFrame) -> Dict:
        """Calculate portfolio performance metrics"""
        if isinstance(weights, pd.Series):
            weights = weights.values

        # Portfolio return
        portfolio_return = np.dot(weights, expected_returns)

        # Portfolio variance and volatility
        portfolio_variance = np.dot(weights.T, np.dot(covariance_matrix, weights))
        portfolio_volatility = np.sqrt(portfolio_variance)

        # Sharpe ratio
        sharpe_ratio = (portfolio_return - self.daily_rf_rate * 252) / portfolio_volatility if portfolio_volatility != 0 else 0

        # Risk contributions
        marginal_contrib = np.dot(covariance_matrix, weights)
        risk_contrib = weights * marginal_contrib / portfolio_variance if portfolio_variance != 0 else np.zeros_like(weights)

        return {
            'expected_return': portfolio_return,
            'volatility': portfolio_volatility,
            'variance': portfolio_variance,
            'sharpe_ratio': sharpe_ratio,
            'risk_contributions': pd.Series(risk_contrib, index=expected_returns.index)
        }


class RobustOptimizer:
    """
    Robust portfolio optimization techniques for handling estimation uncertainty
    """

    def __init__(self, risk_free_rate: float = 0.02):
        self.risk_free_rate = risk_free_rate
        self.daily_rf_rate = risk_free_rate / 252

    def optimize_robust_mvo(self,
                           expected_returns: pd.Series,
                           covariance_matrix: pd.DataFrame,
                           uncertainty_set: str = 'box',
                           confidence_level: float = 0.95) -> Dict:
        """
        Robust mean-variance optimization accounting for parameter uncertainty

        Args:
            expected_returns: Expected returns
            covariance_matrix: Covariance matrix
            uncertainty_set: Type of uncertainty set ('box', 'ellipsoidal')
            confidence_level: Confidence level for robust optimization

        Returns:
            Robust optimal portfolio
        """
        n_assets = len(expected_returns)

        # Define optimization variables
        w = cp.Variable(n_assets)

        # Portfolio return and risk
        portfolio_return = expected_returns.values @ w
        portfolio_risk = cp.quad_form(w, covariance_matrix.values)

        # Robust constraints based on uncertainty set
        if uncertainty_set == 'box':
            # Box uncertainty set
            uncertainty_level = 0.1  # 10% uncertainty
            robust_return = portfolio_return - uncertainty_level * cp.norm(w, 1)
        else:  # ellipsoidal
            # Ellipsoidal uncertainty set
            uncertainty_matrix = 0.1 * np.eye(n_assets)  # Simplified uncertainty
            robust_return = portfolio_return - cp.sqrt(confidence_level) * cp.quad_form(w, uncertainty_matrix)

        # Objective: maximize robust Sharpe ratio (approximated)
        objective = cp.Maximize(robust_return - self.daily_rf_rate * 252)

        # Constraints
        constraints = [
            cp.sum(w) == 1,  # Weights sum to 1
            w >= 0,  # Long-only
            portfolio_risk <= 0.25  # Maximum 25% volatility
        ]

        # Solve
        problem = cp.Problem(objective, constraints)
        problem.solve()

        if problem.status == cp.OPTIMAL:
            weights = pd.Series(w.value, index=expected_returns.index)
            return {
                'weights': weights,
                'success': True,
                'expected_return': expected_returns @ weights,
                'volatility': np.sqrt(weights @ covariance_matrix @ weights)
            }
        else:
            return {'success': False, 'message': f"Optimization failed: {problem.status}"}
