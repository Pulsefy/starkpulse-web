import pandas as pd
from src.services.reporting_service import ReportingService
from src.schedulers.report_scheduler import schedule_reports
import sys
import os

def main():
    # Example: Load data from a CSV (replace with your actual data source)
    data = pd.read_csv(os.getenv('DATA_SOURCE_PATH', 'data.csv'))
    config_path = os.getenv('REPORT_CONFIG_PATH', 'report_schedule.yaml')
    schedule_reports(config_path, data)

if __name__ == "__main__":
    main()
