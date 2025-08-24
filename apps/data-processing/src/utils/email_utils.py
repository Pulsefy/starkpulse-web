import smtplib
from email.message import EmailMessage
import os

def send_email_with_attachment(to_email: str, file_path: str):
    msg = EmailMessage()
    msg['Subject'] = 'Automated Data Report'
    msg['From'] = os.getenv('EMAIL_SENDER')
    msg['To'] = to_email
    with open(file_path, 'rb') as f:
        file_data = f.read()
        file_name = os.path.basename(file_path)
    msg.add_attachment(file_data, maintype='application', subtype='octet-stream', filename=file_name)
    with smtplib.SMTP(os.getenv('SMTP_SERVER'), int(os.getenv('SMTP_PORT'))) as smtp:
        smtp.login(os.getenv('EMAIL_SENDER'), os.getenv('EMAIL_PASSWORD'))
        smtp.send_message(msg)
