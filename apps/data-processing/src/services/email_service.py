import aiosmtplib
import aiofiles
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import List

class EmailService:

    def __init__(self, smtp_server: str, smtp_port: int, smtp_user: str, smtp_pass: str):
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_pass = smtp_pass

    async def send_email_with_attachment(self, subject: str, body: str, recipients: List[str], attachment_path: str):
        if not recipients:
            print("No recipients specified. Skipping email.")
            return

        try:
            msg = MIMEMultipart()
            msg['From'] = self.smtp_user
            msg['To'] = ", ".join(recipients)
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'html'))

            async with aiofiles.open(attachment_path, "rb") as attachment:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(await attachment.read())

            encoders.encode_base64(part)
            attachment_filename = attachment_path.split('/')[-1]
            part.add_header(
                "Content-Disposition",
                f"attachment; filename= {attachment_filename}",
            )
            msg.attach(part)

            await aiosmtplib.send(
                msg,
                hostname=self.smtp_server,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_pass,
                use_tls=True
            )
            print(f"Email sent successfully to: {', '.join(recipients)}")

        except FileNotFoundError:
            print(f"Error: Attachment file not found at {attachment_path}")
        except Exception as e:
            print(f"Failed to send email. Error: {e}")
