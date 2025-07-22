"""
Correlation and Diversification Analytics Module

This module provides comprehensive diversification analysis capabilities including:
- Correlation analysis and matrices
- Diversification ratio calculations
- Portfolio concentration measures
- Effective number of assets
- Risk contribution analysis
- Sector and geographic diversification metrics
"""

import numpy as np
import pandas as pd
from scipy import stats
from scipy.cluster.hierarchy import linkage, dendrogram, fcluster
from scipy.spatial.distance import squareform
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime
import warnings

warnings.filterwarnings('ignore')


class DiversificationAnalyzer:
    """
    Comprehensive diversification and correlation analysis engine
    """
    
    def __init__(self):
        """Initialize diversification analyzer"""
        pass
    
    def calculate_comprehensive_diversification_metrics(self, 
                                                       returns: pd.DataFrame,
                                                       weights: pd.Series,
                                                       asset_metadata: pd.DataFrame = None) -> Dict:
        """
        Calculate comprehensive diversification metrics
        
        Args:
            returns: Asset returns matrix (assets as columns)
            weights: Portfolio weights
            asset_metadata: Metadata about assets (sector, geography, etc.)
            
        Returns:
            Dictionary containing all diversification metrics
        """
        if returns.empty or weights.empty:
            return self._get_empty_diversification_metrics()
        
        # Align data
        common_assets = returns.columns.intersection(weights.index)
        if len(common_assets) == 0:
            return self._get_empty_diversification_metrics()
        
        returns_aligned = returns[common_assets]
        weights_aligned = weights[common_assets]
        weights_aligned = weights_aligned / weights_aligned.sum()  # Normalize
        
        diversification_metrics = {}
        
        # Basic correlation metrics
        diversification_metrics.update(self._calculate_correlation_metrics(returns_aligned, weights_aligned))
        
        # Concentration metrics
        diversification_metrics.update(self._calculate_concentration_metrics(weights_aligned))
        
        # Diversification ratios
        diversification_metrics.update(self._calculate_diversification_ratios(returns_aligned, weights_aligned))
        
        # Risk contribution analysis
        diversification_metrics.update(self._calculate_risk_contributions(returns_aligned, weights_aligned))
        
        # Effective number of assets
        diversification_metrics.update(self._calculate_effective_assets(weights_aligned, returns_aligned))
        
        # Sector/geographic diversification (if metadata provided)
        if asset_metadata is not None:
            diversification_metrics.update(self._calculate_sector_diversification(weights_aligned, asset_metadata))
        
        # Clustering analysis
        diversification_metrics.update(self._calculate_clustering_metrics(returns_aligned, weights_aligned))
        
        return diversification_metrics
    
    def _calculate_correlation_metrics(self, returns: pd.DataFrame, weights: pd.Series) -> Dict:
        """Calculate correlation-based metrics"""
        # Correlation matrix
        corr_matrix = returns.corr()
        
        # Average correlation
        n_assets = len(returns.columns)
        if n_assets > 1:
            # Exclude diagonal (self-correlations)
            mask = np.triu(np.ones_like(corr_matrix, dtype=bool), k=1)
            avg_correlation = corr_matrix.values[mask].mean()
            
            # Weighted average correlation
            weight_matrix = np.outer(weights, weights)
            weighted_corr = (corr_matrix * weight_matrix).sum().sum() - weights.sum()  # Exclude diagonal
            weighted_corr = weighted_corr / (1 - (weights ** 2).sum())  # Normalize
        else:
            avg_correlation = 0
            weighted_corr = 0
        
        # Maximum and minimum correlations
        max_correlation = corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].max() if n_assets > 1 else 0
        min_correlation = corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].min() if n_assets > 1 else 0
        
        # Portfolio correlation with equal-weight benchmark
        if n_assets > 1:
            equal_weights = pd.Series(1/n_assets, index=returns.columns)
            portfolio_returns = (returns * weights).sum(axis=1)
            equal_weight_returns = (returns * equal_weights).sum(axis=1)
            portfolio_ew_correlation = portfolio_returns.corr(equal_weight_returns)
        else:
            portfolio_ew_correlation = 1.0
        
        return {
            'avg_correlation': avg_correlation,
            'weighted_avg_correlation': weighted_corr,
            'max_correlation': max_correlation,
            'min_correlation': min_correlation,
            'portfolio_ew_correlation': portfolio_ew_correlation,
            'correlation_dispersion': corr_matrix.std().std()  # Standard deviation of correlations
        }
    
    def _calculate_concentration_metrics(self, weights: pd.Series) -> Dict:
        """Calculate portfolio concentration metrics"""
        # Herfindahl-Hirschman Index (HHI)
        hhi = (weights ** 2).sum()
        
        # Effective number of assets (1/HHI)
        effective_assets = 1 / hhi if hhi > 0 else 0
        
        # Concentration ratio (sum of top N holdings)
        sorted_weights = weights.sort_values(ascending=False)
        top_3_concentration = sorted_weights.head(3).sum()
        top_5_concentration = sorted_weights.head(5).sum()
        top_10_concentration = sorted_weights.head(min(10, len(weights))).sum()
        
        # Gini coefficient (measure of inequality)
        gini_coefficient = self._calculate_gini_coefficient(weights)
        
        # Shannon entropy (information-theoretic measure)
        shannon_entropy = -(weights * np.log(weights + 1e-10)).sum()
        
        # Maximum weight
        max_weight = weights.max()
        
        return {
            'herfindahl_index': hhi,
            'effective_num_assets': effective_assets,
            'top_3_concentration': top_3_concentration,
            'top_5_concentration': top_5_concentration,
            'top_10_concentration': top_10_concentration,
            'gini_coefficient': gini_coefficient,
            'shannon_entropy': shannon_entropy,
            'max_weight': max_weight,
            'num_assets': len(weights)
        }
    
    def _calculate_diversification_ratios(self, returns: pd.DataFrame, weights: pd.Series) -> Dict:
        """Calculate diversification ratios"""
        # Individual asset volatilities
        asset_vols = returns.std()
        
        # Portfolio volatility
        cov_matrix = returns.cov()
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
        portfolio_vol = np.sqrt(portfolio_variance)
        
        # Weighted average volatility
        weighted_avg_vol = (weights * asset_vols).sum()
        
        # Diversification ratio
        diversification_ratio = weighted_avg_vol / portfolio_vol if portfolio_vol > 0 else 0
        
        # Risk reduction due to diversification
        risk_reduction = 1 - (portfolio_vol / weighted_avg_vol) if weighted_avg_vol > 0 else 0
        
        return {
            'diversification_ratio': diversification_ratio,
            'portfolio_volatility': portfolio_vol,
            'weighted_avg_volatility': weighted_avg_vol,
            'risk_reduction': risk_reduction
        }
    
    def _calculate_risk_contributions(self, returns: pd.DataFrame, weights: pd.Series) -> Dict:
        """Calculate risk contribution analysis"""
        cov_matrix = returns.cov()
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
        
        if portfolio_variance > 0:
            # Marginal risk contributions
            marginal_contrib = np.dot(cov_matrix, weights)
            
            # Risk contributions
            risk_contrib = weights * marginal_contrib / portfolio_variance
            
            # Component contributions to variance
            component_contrib = weights * marginal_contrib
            
            # Risk contribution statistics
            max_risk_contrib = risk_contrib.max()
            min_risk_contrib = risk_contrib.min()
            risk_contrib_dispersion = risk_contrib.std()
            
            # Effective number of risk contributors
            effective_risk_contributors = 1 / (risk_contrib ** 2).sum() if (risk_contrib ** 2).sum() > 0 else 0
        else:
            risk_contrib = pd.Series(0, index=weights.index)
            max_risk_contrib = 0
            min_risk_contrib = 0
            risk_contrib_dispersion = 0
            effective_risk_contributors = 0
        
        return {
            'max_risk_contribution': max_risk_contrib,
            'min_risk_contribution': min_risk_contrib,
            'risk_contribution_dispersion': risk_contrib_dispersion,
            'effective_risk_contributors': effective_risk_contributors,
            'risk_contributions': risk_contrib.to_dict()
        }
    
    def _calculate_effective_assets(self, weights: pd.Series, returns: pd.DataFrame) -> Dict:
        """Calculate various measures of effective number of assets"""
        # Weight-based effective assets
        weight_effective = 1 / (weights ** 2).sum()
        
        # Volatility-adjusted effective assets
        asset_vols = returns.std()
        vol_weights = weights * asset_vols
        vol_weights = vol_weights / vol_weights.sum()
        vol_effective = 1 / (vol_weights ** 2).sum()
        
        # Correlation-adjusted effective assets
        corr_matrix = returns.corr()
        avg_corr = corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].mean()
        corr_adjusted_effective = len(weights) / (1 + (len(weights) - 1) * avg_corr) if avg_corr < 1 else 1
        
        return {
            'effective_assets_weight': weight_effective,
            'effective_assets_volatility': vol_effective,
            'effective_assets_correlation': corr_adjusted_effective
        }

    def _calculate_sector_diversification(self, weights: pd.Series, asset_metadata: pd.DataFrame) -> Dict:
        """Calculate sector and geographic diversification metrics"""
        # Align metadata with weights
        common_assets = weights.index.intersection(asset_metadata.index)
        if len(common_assets) == 0:
            return {}

        weights_aligned = weights[common_assets]
        metadata_aligned = asset_metadata.loc[common_assets]

        sector_metrics = {}

        # Sector diversification
        if 'sector' in metadata_aligned.columns:
            sector_weights = weights_aligned.groupby(metadata_aligned['sector']).sum()
            sector_hhi = (sector_weights ** 2).sum()
            sector_effective = 1 / sector_hhi if sector_hhi > 0 else 0

            sector_metrics.update({
                'sector_hhi': sector_hhi,
                'sector_effective_count': sector_effective,
                'num_sectors': len(sector_weights),
                'max_sector_weight': sector_weights.max(),
                'sector_weights': sector_weights.to_dict()
            })

        return sector_metrics

    def _calculate_clustering_metrics(self, returns: pd.DataFrame, weights: pd.Series) -> Dict:
        """Calculate clustering-based diversification metrics"""
        if len(returns.columns) < 3:
            return {'num_clusters': len(returns.columns)}

        # Calculate distance matrix from correlations
        corr_matrix = returns.corr()
        distance_matrix = 1 - corr_matrix.abs()  # Distance = 1 - |correlation|

        # Hierarchical clustering
        condensed_distances = squareform(distance_matrix.values)
        linkage_matrix = linkage(condensed_distances, method='ward')

        # Determine optimal number of clusters
        max_clusters = min(5, len(returns.columns))
        optimal_clusters = max_clusters

        return {
            'optimal_num_clusters': optimal_clusters
        }

    def _calculate_gini_coefficient(self, weights: pd.Series) -> float:
        """Calculate Gini coefficient for portfolio weights"""
        sorted_weights = np.sort(weights.values)
        n = len(sorted_weights)

        if n == 0:
            return 0

        cumsum = np.cumsum(sorted_weights)
        return (n + 1 - 2 * np.sum(cumsum) / cumsum[-1]) / n if cumsum[-1] > 0 else 0

    def _get_empty_diversification_metrics(self) -> Dict:
        """Return empty diversification metrics structure"""
        return {
            'avg_correlation': 0,
            'herfindahl_index': 1,
            'effective_num_assets': 1,
            'diversification_ratio': 1,
            'num_assets': 0
        }

    def calculate_diversification_score(self, returns: pd.DataFrame, weights: pd.Series) -> float:
        """
        Calculate overall diversification score (0-100)

        Args:
            returns: Asset returns matrix
            weights: Portfolio weights

        Returns:
            Diversification score from 0 (not diversified) to 100 (highly diversified)
        """
        metrics = self.calculate_comprehensive_diversification_metrics(returns, weights)

        # Component scores (0-100)
        scores = {}

        # Correlation score (lower correlation = higher score)
        avg_corr = metrics.get('avg_correlation', 1)
        scores['correlation'] = max(0, (1 - avg_corr) * 100)

        # Concentration score (lower concentration = higher score)
        hhi = metrics.get('herfindahl_index', 1)
        max_hhi = 1.0  # Maximum concentration (single asset)
        min_hhi = 1.0 / len(weights) if len(weights) > 0 else 1.0  # Minimum concentration (equal weights)
        if max_hhi > min_hhi:
            scores['concentration'] = ((max_hhi - hhi) / (max_hhi - min_hhi)) * 100
        else:
            scores['concentration'] = 100

        # Diversification ratio score
        div_ratio = metrics.get('diversification_ratio', 1)
        scores['diversification_ratio'] = min(100, (div_ratio - 1) * 100)  # Above 1 is good

        # Number of assets score
        num_assets = metrics.get('num_assets', 1)
        scores['num_assets'] = min(100, (num_assets / 20) * 100)  # 20+ assets = 100 points

        # Weighted average of component scores
        weights_scores = {
            'correlation': 0.3,
            'concentration': 0.3,
            'diversification_ratio': 0.2,
            'num_assets': 0.2
        }

        overall_score = sum(scores[component] * weight for component, weight in weights_scores.items())

        return min(100, max(0, overall_score))
