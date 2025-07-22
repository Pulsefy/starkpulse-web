"""
Stress Testing and Scenario Analysis Module

This module provides comprehensive stress testing capabilities including:
- Historical scenario analysis
- Monte Carlo stress testing
- Hypothetical scenario modeling
- Tail risk analysis
- Crisis period simulation
- Factor shock analysis
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import warnings

warnings.filterwarnings('ignore')


class ScenarioType(Enum):
    """Types of stress test scenarios"""
    HISTORICAL = "historical"
    MONTE_CARLO = "monte_carlo"
    HYPOTHETICAL = "hypothetical"
    FACTOR_SHOCK = "factor_shock"
    TAIL_RISK = "tail_risk"


@dataclass
class StressScenario:
    """Stress test scenario definition"""
    name: str
    scenario_type: ScenarioType
    description: str
    parameters: Dict
    probability: Optional[float] = None


@dataclass
class StressTestResult:
    """Stress test result"""
    scenario_name: str
    portfolio_id: str
    initial_value: float
    stressed_value: float
    loss_amount: float
    loss_percentage: float
    var_impact: float
    duration_days: int
    recovery_time: Optional[int] = None


class StressTester:
    """
    Comprehensive stress testing and scenario analysis engine
    """
    
    def __init__(self):
        """Initialize stress tester"""
        self.historical_scenarios = self._define_historical_scenarios()
        self.factor_scenarios = self._define_factor_scenarios()
    
    def run_comprehensive_stress_test(self, 
                                    portfolio_returns: pd.Series,
                                    portfolio_weights: pd.Series,
                                    asset_returns: pd.DataFrame,
                                    scenarios: List[StressScenario] = None) -> Dict[str, StressTestResult]:
        """
        Run comprehensive stress test across multiple scenarios
        
        Args:
            portfolio_returns: Historical portfolio returns
            portfolio_weights: Current portfolio weights
            asset_returns: Historical asset returns matrix
            scenarios: Custom scenarios to test (optional)
            
        Returns:
            Dictionary of stress test results by scenario name
        """
        if scenarios is None:
            scenarios = self._get_default_scenarios()
        
        results = {}
        initial_value = 100000  # Assume $100k portfolio for calculations
        
        for scenario in scenarios:
            try:
                if scenario.scenario_type == ScenarioType.HISTORICAL:
                    result = self._run_historical_scenario(
                        portfolio_returns, portfolio_weights, asset_returns, scenario, initial_value
                    )
                elif scenario.scenario_type == ScenarioType.MONTE_CARLO:
                    result = self._run_monte_carlo_scenario(
                        portfolio_returns, portfolio_weights, asset_returns, scenario, initial_value
                    )
                elif scenario.scenario_type == ScenarioType.HYPOTHETICAL:
                    result = self._run_hypothetical_scenario(
                        portfolio_weights, asset_returns, scenario, initial_value
                    )
                elif scenario.scenario_type == ScenarioType.FACTOR_SHOCK:
                    result = self._run_factor_shock_scenario(
                        portfolio_weights, asset_returns, scenario, initial_value
                    )
                elif scenario.scenario_type == ScenarioType.TAIL_RISK:
                    result = self._run_tail_risk_scenario(
                        portfolio_returns, scenario, initial_value
                    )
                else:
                    continue
                
                results[scenario.name] = result
                
            except Exception as e:
                print(f"Error running scenario {scenario.name}: {str(e)}")
                continue
        
        return results
    
    def _run_historical_scenario(self, 
                                portfolio_returns: pd.Series,
                                portfolio_weights: pd.Series,
                                asset_returns: pd.DataFrame,
                                scenario: StressScenario,
                                initial_value: float) -> StressTestResult:
        """Run historical scenario stress test"""
        start_date = scenario.parameters['start_date']
        end_date = scenario.parameters['end_date']
        
        # Filter returns for the historical period
        period_mask = (asset_returns.index >= start_date) & (asset_returns.index <= end_date)
        period_returns = asset_returns[period_mask]
        
        if len(period_returns) == 0:
            raise ValueError(f"No data found for period {start_date} to {end_date}")
        
        # Calculate portfolio returns during the crisis period
        portfolio_period_returns = (period_returns * portfolio_weights).sum(axis=1)
        
        # Calculate cumulative impact
        cumulative_return = (1 + portfolio_period_returns).prod() - 1
        stressed_value = initial_value * (1 + cumulative_return)
        loss_amount = initial_value - stressed_value
        loss_percentage = loss_amount / initial_value
        
        # Calculate maximum drawdown during period
        cumulative_values = initial_value * (1 + portfolio_period_returns).cumprod()
        running_max = cumulative_values.cummax()
        drawdown = (cumulative_values - running_max) / running_max
        max_drawdown = drawdown.min()
        
        return StressTestResult(
            scenario_name=scenario.name,
            portfolio_id="test_portfolio",
            initial_value=initial_value,
            stressed_value=stressed_value,
            loss_amount=loss_amount,
            loss_percentage=loss_percentage,
            var_impact=max_drawdown,
            duration_days=len(period_returns),
            recovery_time=self._calculate_recovery_time(cumulative_values)
        )
    
    def _run_monte_carlo_scenario(self,
                                portfolio_returns: pd.Series,
                                portfolio_weights: pd.Series,
                                asset_returns: pd.DataFrame,
                                scenario: StressScenario,
                                initial_value: float) -> StressTestResult:
        """Run Monte Carlo stress test"""
        num_simulations = scenario.parameters.get('num_simulations', 10000)
        time_horizon = scenario.parameters.get('time_horizon_days', 252)
        confidence_level = scenario.parameters.get('confidence_level', 0.01)
        
        # Calculate asset return statistics
        mean_returns = asset_returns.mean()
        cov_matrix = asset_returns.cov()
        
        # Generate random scenarios
        np.random.seed(42)  # For reproducibility
        simulated_returns = np.random.multivariate_normal(
            mean_returns, cov_matrix, (num_simulations, time_horizon)
        )
        
        # Calculate portfolio returns for each simulation
        portfolio_simulations = []
        for sim in simulated_returns:
            sim_df = pd.DataFrame(sim, columns=asset_returns.columns)
            portfolio_sim_returns = (sim_df * portfolio_weights).sum(axis=1)
            final_value = initial_value * (1 + portfolio_sim_returns).prod()
            portfolio_simulations.append(final_value)
        
        portfolio_simulations = np.array(portfolio_simulations)
        
        # Calculate stress metrics
        worst_case_value = np.percentile(portfolio_simulations, confidence_level * 100)
        loss_amount = initial_value - worst_case_value
        loss_percentage = loss_amount / initial_value
        
        return StressTestResult(
            scenario_name=scenario.name,
            portfolio_id="test_portfolio",
            initial_value=initial_value,
            stressed_value=worst_case_value,
            loss_amount=loss_amount,
            loss_percentage=loss_percentage,
            var_impact=loss_percentage,
            duration_days=time_horizon
        )
    
    def _run_hypothetical_scenario(self,
                                 portfolio_weights: pd.Series,
                                 asset_returns: pd.DataFrame,
                                 scenario: StressScenario,
                                 initial_value: float) -> StressTestResult:
        """Run hypothetical scenario stress test"""
        shock_returns = scenario.parameters['shock_returns']
        
        # Apply shocks to portfolio
        portfolio_shock_return = sum(
            portfolio_weights[asset] * shock_returns.get(asset, 0)
            for asset in portfolio_weights.index
            if asset in shock_returns
        )
        
        stressed_value = initial_value * (1 + portfolio_shock_return)
        loss_amount = initial_value - stressed_value
        loss_percentage = loss_amount / initial_value
        
        return StressTestResult(
            scenario_name=scenario.name,
            portfolio_id="test_portfolio",
            initial_value=initial_value,
            stressed_value=stressed_value,
            loss_amount=loss_amount,
            loss_percentage=loss_percentage,
            var_impact=loss_percentage,
            duration_days=1  # Instantaneous shock
        )
    
    def _run_factor_shock_scenario(self,
                                 portfolio_weights: pd.Series,
                                 asset_returns: pd.DataFrame,
                                 scenario: StressScenario,
                                 initial_value: float) -> StressTestResult:
        """Run factor shock scenario"""
        factor_shocks = scenario.parameters['factor_shocks']
        factor_loadings = scenario.parameters.get('factor_loadings', {})
        
        # Calculate impact based on factor loadings
        total_shock = 0
        for factor, shock_value in factor_shocks.items():
            if factor in factor_loadings:
                factor_impact = sum(
                    portfolio_weights[asset] * factor_loadings[factor].get(asset, 0) * shock_value
                    for asset in portfolio_weights.index
                )
                total_shock += factor_impact
        
        stressed_value = initial_value * (1 + total_shock)
        loss_amount = initial_value - stressed_value
        loss_percentage = loss_amount / initial_value
        
        return StressTestResult(
            scenario_name=scenario.name,
            portfolio_id="test_portfolio",
            initial_value=initial_value,
            stressed_value=stressed_value,
            loss_amount=loss_amount,
            loss_percentage=loss_percentage,
            var_impact=loss_percentage,
            duration_days=1
        )

    def _run_tail_risk_scenario(self,
                              portfolio_returns: pd.Series,
                              scenario: StressScenario,
                              initial_value: float) -> StressTestResult:
        """Run tail risk scenario"""
        percentile = scenario.parameters.get('percentile', 1)  # 1st percentile
        time_horizon = scenario.parameters.get('time_horizon_days', 1)

        # Calculate tail risk
        tail_return = np.percentile(portfolio_returns.dropna(), percentile)

        # Apply over time horizon
        if time_horizon > 1:
            # Compound the tail return over the time horizon
            compound_return = (1 + tail_return) ** time_horizon - 1
        else:
            compound_return = tail_return

        stressed_value = initial_value * (1 + compound_return)
        loss_amount = initial_value - stressed_value
        loss_percentage = loss_amount / initial_value

        return StressTestResult(
            scenario_name=scenario.name,
            portfolio_id="test_portfolio",
            initial_value=initial_value,
            stressed_value=stressed_value,
            loss_amount=loss_amount,
            loss_percentage=loss_percentage,
            var_impact=loss_percentage,
            duration_days=time_horizon
        )

    def _calculate_recovery_time(self, cumulative_values: pd.Series) -> Optional[int]:
        """Calculate recovery time from maximum drawdown"""
        running_max = cumulative_values.cummax()
        drawdown = (cumulative_values - running_max) / running_max

        # Find the point of maximum drawdown
        max_dd_idx = drawdown.idxmin()
        max_dd_value = running_max.loc[max_dd_idx]

        # Find when portfolio recovers to pre-drawdown level
        recovery_mask = (cumulative_values.index > max_dd_idx) & (cumulative_values >= max_dd_value)

        if recovery_mask.any():
            recovery_idx = cumulative_values[recovery_mask].index[0]
            recovery_time = (recovery_idx - max_dd_idx).days
            return recovery_time

        return None  # No recovery within the period

    def _define_historical_scenarios(self) -> List[StressScenario]:
        """Define historical crisis scenarios"""
        return [
            StressScenario(
                name="2008 Financial Crisis",
                scenario_type=ScenarioType.HISTORICAL,
                description="Global financial crisis of 2008-2009",
                parameters={
                    'start_date': '2008-09-01',
                    'end_date': '2009-03-31'
                },
                probability=0.02
            ),
            StressScenario(
                name="COVID-19 Market Crash",
                scenario_type=ScenarioType.HISTORICAL,
                description="COVID-19 pandemic market crash in March 2020",
                parameters={
                    'start_date': '2020-02-20',
                    'end_date': '2020-04-30'
                },
                probability=0.01
            ),
            StressScenario(
                name="Dot-com Bubble Burst",
                scenario_type=ScenarioType.HISTORICAL,
                description="Technology bubble burst of 2000-2002",
                parameters={
                    'start_date': '2000-03-01',
                    'end_date': '2002-10-31'
                },
                probability=0.015
            )
        ]

    def _define_factor_scenarios(self) -> List[StressScenario]:
        """Define factor-based stress scenarios"""
        return [
            StressScenario(
                name="Interest Rate Shock",
                scenario_type=ScenarioType.FACTOR_SHOCK,
                description="Sudden 200 basis point increase in interest rates",
                parameters={
                    'factor_shocks': {'interest_rate': 0.02},
                    'factor_loadings': {
                        'interest_rate': {
                            'bonds': -0.8,
                            'stocks': -0.3,
                            'real_estate': -0.5
                        }
                    }
                }
            )
        ]

    def _get_default_scenarios(self) -> List[StressScenario]:
        """Get default set of stress test scenarios"""
        scenarios = []
        scenarios.extend(self.historical_scenarios)

        # Add Monte Carlo scenario
        scenarios.append(
            StressScenario(
                name="Monte Carlo 1% VaR",
                scenario_type=ScenarioType.MONTE_CARLO,
                description="Monte Carlo simulation for 1% VaR over 1 year",
                parameters={
                    'num_simulations': 10000,
                    'time_horizon_days': 252,
                    'confidence_level': 0.01
                }
            )
        )

        return scenarios
