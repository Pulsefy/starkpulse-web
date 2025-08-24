from apscheduler.schedulers.background import BackgroundScheduler
from services.reporting_service import ReportingService
from utils.email_utils import send_email_with_attachment
import pandas as pd
import yaml
import os

def load_schedule_config(config_path: str):
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

def schedule_reports(config_path: str, data: pd.DataFrame):
    config = load_schedule_config(config_path)
    scheduler = BackgroundScheduler()
    for job in config['jobs']:
        def job_func():
            service = ReportingService(data)
            report_path = job['output_path']
            service.generate_report(job['group_by'], job['agg_func'], job['format'], report_path)
            send_email_with_attachment(job['email'], report_path)
        scheduler.add_job(job_func, 'cron', **job['schedule'])
    scheduler.start()
