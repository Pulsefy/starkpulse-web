import logging
import sys
import os
import structlog

def setup_logger():
    """
    Configures a structured JSON logger using structlog.
    This setup ensures that all log outputs are in a machine-readable
    JSON format, ready for aggregation by tools like Loki or Splunk.
    """
    # Get log level from environment variable, default to INFO
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    
    # Configure the standard logging module which structlog will wrap
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # Configure structlog processors
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer() # Renders the final log entry as JSON
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Return a structlog-wrapped logger
    return structlog.get_logger()