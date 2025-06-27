"""
Setup script for database initialization
"""

import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent / 'src'))

from src.config.settings import Settings
from src.config.database import DatabaseConfig
from src.utils.logger import setup_logger

logger = setup_logger(__name__)

def setup_database():
    """Setup database tables"""
    logger.info("Setting up database...")
    
    try:
        settings = Settings()
        db_config = DatabaseConfig(settings)
        
        # Create tables
        db_config.create_tables()
        
        logger.info("Database setup completed successfully")
        
    except Exception as e:
        logger.error(f"Database setup failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    setup_database()
