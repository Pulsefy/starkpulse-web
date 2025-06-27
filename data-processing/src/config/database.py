"""
Database configuration and connection management
"""

from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from .settings import Settings

Base = declarative_base()

class DatabaseConfig:
    """Database configuration and connection management"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self._engine = None
        self._session_factory = None
    
    @property
    def engine(self):
        """Get or create database engine"""
        if self._engine is None:
            self._engine = create_engine(
                self.settings.database_url,
                pool_size=10,
                max_overflow=20,
                echo=self.settings.debug
            )
        return self._engine
    
    def get_session(self):
        """Get database session"""
        if self._session_factory is None:
            self._session_factory = sessionmaker(bind=self.engine)
        return self._session_factory()
    
    def create_tables(self):
        """Create all tables"""
        Base.metadata.create_all(bind=self.engine)
