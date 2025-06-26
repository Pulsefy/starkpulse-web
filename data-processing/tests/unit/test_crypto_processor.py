"""
Unit tests for crypto data processor
"""

import pytest
from unittest.mock import Mock, AsyncMock

from src.processors.crypto_data_processor import CryptoDataProcessor

class TestCryptoDataProcessor:
    """Test crypto data processor"""
    
    @pytest.fixture
    def processor(self):
        """Create processor instance"""
        db_service = Mock()
        cache_service = Mock()
        return CryptoDataProcessor(db_service, cache_service)
    
    @pytest.mark.asyncio
    async def test_update_prices(self, processor):
        """Test price update"""
        processor.db_service.save_crypto_data.return_value = 2
        
        result = await processor.update_prices(['BTC', 'ETH'])
        
        assert result == 2
        processor.db_service.save_crypto_data.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_calculate_metrics(self, processor):
        """Test metrics calculation"""
        result = await processor.calculate_metrics('BTC')
        
        assert result['symbol'] == 'BTC'
        assert 'volatility' in result
