"""
Portfolio Reporting and Visualization Engine

This module provides comprehensive reporting and visualization capabilities including:
- Portfolio performance reports
- Risk analysis reports
- Interactive visualizations
- Export capabilities (PDF, Excel, JSON)
- Dashboard data preparation
- Automated report generation
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from typing import Dict, List, Optional, Union, Any
from datetime import datetime, timedelta
import json
import base64
import io
from dataclasses import dataclass
import warnings

warnings.filterwarnings('ignore')


@dataclass
class ReportConfig:
    """Report configuration"""
    report_type: str = 'comprehensive'  # 'comprehensive', 'risk', 'performance', 'summary'
    include_charts: bool = True
    chart_format: str = 'plotly'  # 'plotly', 'matplotlib'
    export_format: str = 'json'  # 'json', 'pdf', 'excel', 'html'
    time_period: str = 'all'  # 'all', '1y', '6m', '3m', '1m'
    benchmark_comparison: bool = True
    include_stress_tests: bool = True
    include_optimization: bool = True


class PortfolioReportGenerator:
    """
    Comprehensive portfolio reporting and visualization engine
    """
    
    def __init__(self):
        """Initialize report generator"""
        # Set plotting style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
    
    def generate_comprehensive_report(self, 
                                    analysis_results: Dict,
                                    config: ReportConfig = None) -> Dict:
        """
        Generate comprehensive portfolio report
        
        Args:
            analysis_results: Results from portfolio analytics engine
            config: Report configuration
            
        Returns:
            Complete report with data and visualizations
        """
        if config is None:
            config = ReportConfig()
        
        report = {
            'metadata': {
                'portfolio_id': analysis_results.get('portfolio_id', 'Unknown'),
                'generated_at': datetime.utcnow().isoformat(),
                'report_type': config.report_type,
                'data_period': analysis_results.get('data_period', {}),
                'config': config.__dict__
            }
        }
        
        # Executive Summary
        report['executive_summary'] = self._generate_executive_summary(analysis_results)
        
        # Performance Analysis
        if config.report_type in ['comprehensive', 'performance']:
            report['performance_analysis'] = self._generate_performance_section(
                analysis_results, config
            )
        
        # Risk Analysis
        if config.report_type in ['comprehensive', 'risk']:
            report['risk_analysis'] = self._generate_risk_section(
                analysis_results, config
            )
        
        # Diversification Analysis
        if config.report_type == 'comprehensive':
            report['diversification_analysis'] = self._generate_diversification_section(
                analysis_results, config
            )
        
        # Stress Testing Results
        if config.include_stress_tests and config.report_type in ['comprehensive', 'risk']:
            report['stress_testing'] = self._generate_stress_testing_section(
                analysis_results, config
            )
        
        # Optimization Suggestions
        if config.include_optimization and config.report_type == 'comprehensive':
            report['optimization_suggestions'] = self._generate_optimization_section(
                analysis_results, config
            )
        
        # Charts and Visualizations
        if config.include_charts:
            report['visualizations'] = self._generate_visualizations(
                analysis_results, config
            )
        
        # Alerts and Recommendations
        report['alerts_and_recommendations'] = self._generate_alerts_section(
            analysis_results
        )
        
        return report
    
    def _generate_executive_summary(self, analysis_results: Dict) -> Dict:
        """Generate executive summary section"""
        risk_metrics = analysis_results.get('risk_metrics', {})
        performance_metrics = analysis_results.get('performance_metrics', {})
        diversification_score = analysis_results.get('diversification_score', 0)
        
        # Key performance indicators
        kpis = {
            'total_return': performance_metrics.get('total_return', 0),
            'annualized_return': performance_metrics.get('annualized_return', 0),
            'volatility': performance_metrics.get('volatility', 0),
            'sharpe_ratio': performance_metrics.get('sharpe_ratio', 0),
            'sortino_ratio': performance_metrics.get('sortino_ratio', 0),
            'max_drawdown': risk_metrics.get('max_drawdown', 0),
            'var_95': risk_metrics.get('var_historical_95', 0),
            'diversification_score': diversification_score
        }
        
        # Portfolio health assessment
        health_score = self._calculate_health_score(kpis)
        risk_level = self._assess_risk_level(risk_metrics)
        performance_rating = self._assess_performance_rating(performance_metrics)
        
        # Key insights
        insights = self._generate_key_insights(analysis_results)
        
        return {
            'key_performance_indicators': kpis,
            'portfolio_health_score': health_score,
            'risk_level': risk_level,
            'performance_rating': performance_rating,
            'key_insights': insights,
            'summary_text': self._generate_summary_text(kpis, health_score, risk_level)
        }
    
    def _generate_performance_section(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Generate performance analysis section"""
        performance_metrics = analysis_results.get('performance_metrics', {})
        
        # Performance metrics table
        metrics_table = {
            'Returns': {
                'Total Return': f"{performance_metrics.get('total_return', 0):.2%}",
                'Annualized Return': f"{performance_metrics.get('annualized_return', 0):.2%}",
                'Best Day': f"{performance_metrics.get('best_day', 0):.2%}",
                'Worst Day': f"{performance_metrics.get('worst_day', 0):.2%}"
            },
            'Risk-Adjusted Metrics': {
                'Sharpe Ratio': f"{performance_metrics.get('sharpe_ratio', 0):.2f}",
                'Sortino Ratio': f"{performance_metrics.get('sortino_ratio', 0):.2f}",
                'Calmar Ratio': f"{performance_metrics.get('calmar_ratio', 0):.2f}",
                'Omega Ratio': f"{performance_metrics.get('omega_ratio', 0):.2f}"
            },
            'Activity Metrics': {
                'Win Rate': f"{performance_metrics.get('win_rate', 0):.1%}",
                'Profit Factor': f"{performance_metrics.get('profit_factor', 0):.2f}",
                'Average Win': f"{performance_metrics.get('avg_win', 0):.2%}",
                'Average Loss': f"{performance_metrics.get('avg_loss', 0):.2%}"
            }
        }
        
        # Rolling performance analysis
        rolling_metrics = {
            'rolling_sharpe_30d': performance_metrics.get('rolling_sharpe_30d_current', 0),
            'rolling_sharpe_90d': performance_metrics.get('rolling_sharpe_90d_current', 0),
            'rolling_vol_30d': performance_metrics.get('rolling_vol_30d_current', 0),
            'rolling_return_30d': performance_metrics.get('rolling_return_30d_current', 0)
        }
        
        # Benchmark comparison (if available)
        benchmark_comparison = None
        if 'alpha' in performance_metrics:
            benchmark_comparison = {
                'alpha': performance_metrics.get('alpha', 0),
                'beta': performance_metrics.get('beta', 0),
                'information_ratio': performance_metrics.get('information_ratio', 0),
                'tracking_error': performance_metrics.get('tracking_error', 0),
                'correlation': performance_metrics.get('correlation', 0),
                'up_capture_ratio': performance_metrics.get('up_capture_ratio', 0),
                'down_capture_ratio': performance_metrics.get('down_capture_ratio', 0)
            }
        
        return {
            'metrics_table': metrics_table,
            'rolling_performance': rolling_metrics,
            'benchmark_comparison': benchmark_comparison,
            'performance_commentary': self._generate_performance_commentary(performance_metrics)
        }
    
    def _generate_risk_section(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Generate risk analysis section"""
        risk_metrics = analysis_results.get('risk_metrics', {})
        
        # Risk metrics table
        risk_table = {
            'Value at Risk': {
                'VaR 95% (Historical)': f"{risk_metrics.get('var_historical_95', 0):.2%}",
                'VaR 99% (Historical)': f"{risk_metrics.get('var_historical_99', 0):.2%}",
                'CVaR 95%': f"{risk_metrics.get('cvar_95', 0):.2%}",
                'CVaR 99%': f"{risk_metrics.get('cvar_99', 0):.2%}"
            },
            'Drawdown Analysis': {
                'Maximum Drawdown': f"{risk_metrics.get('max_drawdown', 0):.2%}",
                'Average Drawdown': f"{risk_metrics.get('avg_drawdown', 0):.2%}",
                'Current Drawdown': f"{risk_metrics.get('current_drawdown', 0):.2%}",
                'Recovery Factor': f"{risk_metrics.get('recovery_factor', 0):.2f}"
            },
            'Volatility Metrics': {
                'Daily Volatility': f"{risk_metrics.get('volatility_daily', 0):.2%}",
                'Annualized Volatility': f"{risk_metrics.get('volatility_annualized', 0):.2%}",
                'Downside Deviation': f"{risk_metrics.get('downside_deviation', 0):.2%}",
                'Volatility Clustering': f"{risk_metrics.get('volatility_clustering', 0):.3f}"
            },
            'Distribution Metrics': {
                'Skewness': f"{risk_metrics.get('skewness', 0):.3f}",
                'Kurtosis': f"{risk_metrics.get('kurtosis', 0):.3f}",
                'Tail Ratio': f"{risk_metrics.get('tail_ratio', 0):.2f}",
                'Pain Index': f"{risk_metrics.get('pain_index', 0):.4f}"
            }
        }
        
        # Risk alerts
        risk_alerts = []
        if risk_metrics.get('var_historical_95', 0) < -0.05:
            risk_alerts.append("High VaR: Daily VaR exceeds 5% threshold")
        if risk_metrics.get('max_drawdown', 0) < -0.15:
            risk_alerts.append("High Drawdown: Maximum drawdown exceeds 15% threshold")
        if risk_metrics.get('volatility_annualized', 0) > 0.25:
            risk_alerts.append("High Volatility: Annualized volatility exceeds 25%")
        
        return {
            'risk_metrics_table': risk_table,
            'risk_alerts': risk_alerts,
            'risk_commentary': self._generate_risk_commentary(risk_metrics)
        }
    
    def _generate_diversification_section(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Generate diversification analysis section"""
        div_metrics = analysis_results.get('diversification_metrics', {})
        div_score = analysis_results.get('diversification_score', 0)
        
        # Diversification metrics table
        div_table = {
            'Concentration Metrics': {
                'Herfindahl Index': f"{div_metrics.get('herfindahl_index', 0):.3f}",
                'Effective Number of Assets': f"{div_metrics.get('effective_num_assets', 0):.1f}",
                'Top 3 Concentration': f"{div_metrics.get('top_3_concentration', 0):.1%}",
                'Maximum Weight': f"{div_metrics.get('max_weight', 0):.1%}"
            },
            'Correlation Metrics': {
                'Average Correlation': f"{div_metrics.get('avg_correlation', 0):.3f}",
                'Weighted Avg Correlation': f"{div_metrics.get('weighted_avg_correlation', 0):.3f}",
                'Max Correlation': f"{div_metrics.get('max_correlation', 0):.3f}",
                'Min Correlation': f"{div_metrics.get('min_correlation', 0):.3f}"
            },
            'Diversification Ratios': {
                'Diversification Ratio': f"{div_metrics.get('diversification_ratio', 0):.2f}",
                'Risk Reduction': f"{div_metrics.get('risk_reduction', 0):.1%}",
                'Effective Risk Contributors': f"{div_metrics.get('effective_risk_contributors', 0):.1f}"
            }
        }
        
        # Diversification assessment
        div_rating = self._assess_diversification_rating(div_score)
        
        return {
            'diversification_score': div_score,
            'diversification_rating': div_rating,
            'diversification_table': div_table,
            'diversification_commentary': self._generate_diversification_commentary(div_metrics, div_score)
        }

    def _generate_stress_testing_section(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Generate stress testing section"""
        stress_results = analysis_results.get('stress_test_results', {})

        if not stress_results:
            return {'message': 'No stress test results available'}

        summary = stress_results.get('summary', {})
        detailed_results = stress_results.get('detailed_results', [])

        # Stress test summary
        stress_summary = {
            'total_scenarios': summary.get('total_scenarios_tested', 0),
            'worst_case_loss': f"{summary.get('worst_case_loss', 0):.1%}",
            'average_loss': f"{summary.get('average_loss', 0):.1%}",
            'scenarios_over_10pct_loss': summary.get('scenarios_with_loss_over_10pct', 0),
            'scenarios_over_20pct_loss': summary.get('scenarios_with_loss_over_20pct', 0)
        }

        # Top worst scenarios
        worst_scenarios = sorted(detailed_results, key=lambda x: x['loss_percentage'], reverse=True)[:5]

        return {
            'stress_test_summary': stress_summary,
            'worst_scenarios': worst_scenarios,
            'stress_test_commentary': self._generate_stress_test_commentary(stress_results)
        }

    def _generate_optimization_section(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Generate optimization suggestions section"""
        opt_suggestions = analysis_results.get('optimization_suggestions', {})

        if not opt_suggestions:
            return {'message': 'No optimization suggestions available'}

        # Format optimization results
        formatted_suggestions = {}
        for strategy, data in opt_suggestions.items():
            formatted_suggestions[strategy] = {
                'expected_return': f"{data.get('expected_return', 0):.2%}",
                'volatility': f"{data.get('volatility', 0):.2%}",
                'sharpe_ratio': f"{data.get('sharpe_ratio', 0):.2f}",
                'top_holdings': self._get_top_holdings(data.get('weights', {}))
            }

        return {
            'optimization_strategies': formatted_suggestions,
            'optimization_commentary': self._generate_optimization_commentary(opt_suggestions)
        }

    def _generate_visualizations(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Generate visualizations for the report"""
        visualizations = {}

        # Performance chart
        if 'performance_metrics' in analysis_results:
            visualizations['performance_chart'] = self._create_performance_chart(analysis_results, config)

        # Risk metrics chart
        if 'risk_metrics' in analysis_results:
            visualizations['risk_chart'] = self._create_risk_chart(analysis_results, config)

        # Diversification chart
        if 'diversification_metrics' in analysis_results:
            visualizations['diversification_chart'] = self._create_diversification_chart(analysis_results, config)

        return visualizations

    def _generate_alerts_section(self, analysis_results: Dict) -> Dict:
        """Generate alerts and recommendations section"""
        risk_alerts = analysis_results.get('risk_alerts', [])

        # Generate recommendations based on analysis
        recommendations = self._generate_recommendations(analysis_results)

        return {
            'risk_alerts': risk_alerts,
            'recommendations': recommendations,
            'action_items': self._generate_action_items(analysis_results)
        }

    # Helper methods for calculations and assessments
    def _calculate_health_score(self, kpis: Dict) -> float:
        """Calculate overall portfolio health score"""
        scores = []

        # Performance score (40 points max)
        sharpe_ratio = kpis.get('sharpe_ratio', 0)
        performance_score = min(40, max(0, sharpe_ratio * 20))
        scores.append(performance_score)

        # Risk score (30 points max)
        max_drawdown = abs(kpis.get('max_drawdown', 0))
        risk_score = max(0, 30 - max_drawdown * 100)
        scores.append(risk_score)

        # Diversification score (30 points max)
        div_score = kpis.get('diversification_score', 0)
        scores.append(min(30, div_score * 0.3))

        return sum(scores)

    def _assess_risk_level(self, risk_metrics: Dict) -> str:
        """Assess portfolio risk level"""
        var_95 = abs(risk_metrics.get('var_historical_95', 0))
        max_drawdown = abs(risk_metrics.get('max_drawdown', 0))

        if var_95 > 0.08 or max_drawdown > 0.25:
            return 'High'
        elif var_95 > 0.04 or max_drawdown > 0.15:
            return 'Medium'
        else:
            return 'Low'

    def _assess_performance_rating(self, performance_metrics: Dict) -> str:
        """Assess portfolio performance rating"""
        sharpe_ratio = performance_metrics.get('sharpe_ratio', 0)

        if sharpe_ratio > 1.5:
            return 'Excellent'
        elif sharpe_ratio > 1.0:
            return 'Good'
        elif sharpe_ratio > 0.5:
            return 'Fair'
        else:
            return 'Poor'

    def _assess_diversification_rating(self, div_score: float) -> str:
        """Assess diversification rating"""
        if div_score > 80:
            return 'Excellent'
        elif div_score > 60:
            return 'Good'
        elif div_score > 40:
            return 'Fair'
        else:
            return 'Poor'

    # Commentary generation methods
    def _generate_performance_commentary(self, performance_metrics: Dict) -> str:
        """Generate performance commentary"""
        sharpe_ratio = performance_metrics.get('sharpe_ratio', 0)
        total_return = performance_metrics.get('total_return', 0)
        volatility = performance_metrics.get('volatility', 0)

        commentary = f"The portfolio achieved a total return of {total_return:.1%} with an annualized volatility of {volatility:.1%}. "

        if sharpe_ratio > 1.5:
            commentary += "The Sharpe ratio indicates excellent risk-adjusted performance."
        elif sharpe_ratio > 1.0:
            commentary += "The Sharpe ratio shows good risk-adjusted returns."
        else:
            commentary += "The Sharpe ratio suggests room for improvement in risk-adjusted performance."

        return commentary

    def _generate_risk_commentary(self, risk_metrics: Dict) -> str:
        """Generate risk commentary"""
        var_95 = risk_metrics.get('var_historical_95', 0)
        max_drawdown = risk_metrics.get('max_drawdown', 0)

        commentary = f"The portfolio's 95% VaR is {var_95:.1%}, indicating potential daily losses. "
        commentary += f"The maximum drawdown of {max_drawdown:.1%} shows the worst peak-to-trough decline experienced."

        return commentary

    def _generate_diversification_commentary(self, div_metrics: Dict, div_score: float) -> str:
        """Generate diversification commentary"""
        effective_assets = div_metrics.get('effective_num_assets', 0)
        div_ratio = div_metrics.get('diversification_ratio', 1)

        commentary = f"The portfolio has an effective number of {effective_assets:.1f} assets with a diversification ratio of {div_ratio:.2f}. "

        if div_score > 70:
            commentary += "The portfolio demonstrates strong diversification."
        elif div_score > 50:
            commentary += "The portfolio shows moderate diversification with room for improvement."
        else:
            commentary += "The portfolio lacks adequate diversification and may benefit from broader allocation."

        return commentary

    def _generate_stress_test_commentary(self, stress_results: Dict) -> str:
        """Generate stress test commentary"""
        summary = stress_results.get('summary', {})
        worst_loss = summary.get('worst_case_loss', 0)
        avg_loss = summary.get('average_loss', 0)

        commentary = f"Stress testing reveals a worst-case scenario loss of {worst_loss:.1%} with an average loss of {avg_loss:.1%} across all scenarios. "

        if worst_loss > 0.3:
            commentary += "The portfolio shows high vulnerability to extreme market conditions."
        elif worst_loss > 0.2:
            commentary += "The portfolio demonstrates moderate resilience to stress scenarios."
        else:
            commentary += "The portfolio appears well-positioned to weather market stress."

        return commentary

    def _generate_optimization_commentary(self, opt_suggestions: Dict) -> str:
        """Generate optimization commentary"""
        if not opt_suggestions:
            return "No optimization suggestions available."

        commentary = "Portfolio optimization analysis suggests several potential improvements: "

        if 'max_sharpe' in opt_suggestions:
            sharpe = opt_suggestions['max_sharpe'].get('sharpe_ratio', 0)
            commentary += f"Maximum Sharpe ratio strategy could achieve {sharpe:.2f} Sharpe ratio. "

        if 'min_variance' in opt_suggestions:
            vol = opt_suggestions['min_variance'].get('volatility', 0)
            commentary += f"Minimum variance approach could reduce volatility to {vol:.1%}."

        return commentary

    def _generate_recommendations(self, analysis_results: Dict) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        performance_metrics = analysis_results.get('performance_metrics', {})
        risk_metrics = analysis_results.get('risk_metrics', {})
        div_score = analysis_results.get('diversification_score', 0)

        # Performance recommendations
        sharpe_ratio = performance_metrics.get('sharpe_ratio', 0)
        if sharpe_ratio < 0.5:
            recommendations.append("Consider portfolio optimization to improve risk-adjusted returns")

        # Risk recommendations
        max_drawdown = risk_metrics.get('max_drawdown', 0)
        if max_drawdown < -0.20:
            recommendations.append("Implement stronger risk management measures to limit drawdowns")

        # Diversification recommendations
        if div_score < 50:
            recommendations.append("Increase portfolio diversification across assets and sectors")

        # Stress test recommendations
        stress_results = analysis_results.get('stress_test_results', {})
        if stress_results:
            worst_loss = stress_results.get('summary', {}).get('worst_case_loss', 0)
            if worst_loss > 0.25:
                recommendations.append("Consider hedging strategies to protect against extreme market events")

        return recommendations

    def _generate_action_items(self, analysis_results: Dict) -> List[str]:
        """Generate specific action items"""
        action_items = []

        # Check for immediate actions needed
        risk_alerts = analysis_results.get('risk_alerts', [])
        if risk_alerts:
            action_items.append("Review and address current risk alerts")

        # Optimization actions
        opt_suggestions = analysis_results.get('optimization_suggestions', {})
        if opt_suggestions:
            action_items.append("Evaluate portfolio optimization strategies")

        # Regular monitoring actions
        action_items.extend([
            "Monitor portfolio performance against benchmarks",
            "Review and update risk limits quarterly",
            "Conduct stress testing on a regular basis"
        ])

        return action_items

    def _get_top_holdings(self, weights: Dict, top_n: int = 5) -> List[Dict]:
        """Get top N holdings from weights dictionary"""
        if not weights:
            return []

        sorted_weights = sorted(weights.items(), key=lambda x: x[1], reverse=True)
        return [{'asset': asset, 'weight': f"{weight:.1%}"} for asset, weight in sorted_weights[:top_n]]

    # Visualization methods (simplified for now)
    def _create_performance_chart(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Create performance visualization"""
        return {
            'chart_type': 'performance_summary',
            'data': analysis_results.get('performance_metrics', {}),
            'format': config.chart_format
        }

    def _create_risk_chart(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Create risk visualization"""
        return {
            'chart_type': 'risk_summary',
            'data': analysis_results.get('risk_metrics', {}),
            'format': config.chart_format
        }

    def _create_diversification_chart(self, analysis_results: Dict, config: ReportConfig) -> Dict:
        """Create diversification visualization"""
        return {
            'chart_type': 'diversification_summary',
            'data': analysis_results.get('diversification_metrics', {}),
            'format': config.chart_format
        }
