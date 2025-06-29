import pandas as pd
from datetime import datetime


from ..processors.crypto_data_processor import CryptoDataProcessor
from .export_service import ExportService
from .email_service import EmailService

class ReportingService:
    """
    Orchestrates the generation and delivery of data reports using a provided processor.
    """


    def __init__(self,
                 crypto_processor: CryptoDataProcessor,
                 export_service: ExportService,
                 email_service: EmailService,
                 recipients: list):
        """
        Initializes the ReportingService.
        """
        self.crypto_processor = crypto_processor
        self.export_service = export_service
        self.email_service = email_service
        self.recipients = recipients


    async def _fetch_report_data(self) -> pd.DataFrame:
        """
        Fetches data for the report by calling the processor's 'get_trending_cryptocurrencies' method.
        """
        print("Fetching trending cryptocurrency data from the processor...")
        try:

            list_of_trending_cryptos = await self.crypto_processor.get_trending_cryptocurrencies(limit=20)

            if not list_of_trending_cryptos:
                print("Processor returned no trending cryptos. Report will be empty.")
                return pd.DataFrame()


            df = pd.DataFrame(list_of_trending_cryptos)
            print(f"Successfully fetched {len(df)} trending cryptos for the report.")
            return df

        except Exception as e:
            print(f"An error occurred while fetching data from the processor: {e}")
            return pd.DataFrame()


    async def generate_and_send_report(self, export_format: str = 'csv'):
        """
        Generates a report, saves it to a file, and emails it.
        """

        report_data = await self._fetch_report_data()

        if report_data.empty:
            print("Report generation skipped because no data was fetched.")
            return

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"trending_crypto_report_{timestamp}"

        attachment_path = ""
        try:
            if export_format == 'csv':
                attachment_path = self.export_service.to_csv(report_data, filename)
            elif export_format == 'json':
                attachment_path = self.export_service.to_json(report_data, filename)
            elif export_format == 'parquet':
                attachment_path = self.export_service.to_parquet(report_data, filename)
            else:
                print(f"Error: Unsupported export format '{export_format}'")
                return
        except Exception as e:
            print(f"Error during file export: {e}")
            return

        subject = f"Daily Trending Cryptocurrency Report - {datetime.now().strftime('%Y-%m-%d')}"
        body = "<html><body><p>Hello,</p><p>Please find the latest trending cryptocurrency report attached.</p><p>Regards,<br>Starkpulse Team</p></body></html>"

        self.email_service.send_email_with_attachment(subject, body, self.recipients, attachment_path)
