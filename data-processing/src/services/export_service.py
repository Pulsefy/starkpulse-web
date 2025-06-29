import pandas as pd
import os
import asyncio
import functools
from typing import Coroutine

class ExportService:
    def __init__(self, export_dir: str = 'data/exports'):
        self.export_dir = export_dir
        os.makedirs(self.export_dir, exist_ok=True)
        print(f"Export directory is set to: {os.path.abspath(self.export_dir)}")

    def _get_export_path(self, filename: str) -> str:
        return os.path.join(self.export_dir, filename)

    async def to_csv(self, data: pd.DataFrame, filename: str) -> Coroutine[None, None, str]:
        if not filename.endswith('.csv'):
            filename += '.csv'

        file_path = self._get_export_path(filename)
        loop = asyncio.get_running_loop()

        blocking_task = functools.partial(data.to_csv, file_path, index=False)
        await loop.run_in_executor(None, blocking_task)

        print(f"Data successfully exported to {file_path}")
        return file_path

    async def to_json(self, data: pd.DataFrame, filename: str) -> Coroutine[None, None, str]:
        if not filename.endswith('.json'):
            filename += '.json'

        file_path = self._get_export_path(filename)
        loop = asyncio.get_running_loop()

        blocking_task = functools.partial(data.to_json, file_path, orient='records', indent=4)
        await loop.run_in_executor(None, blocking_task)

        print(f"Data successfully exported to {file_path}")
        return file_path

    async def to_parquet(self, data: pd.DataFrame, filename: str) -> Coroutine[None, None, str]:
        if not filename.endswith('.parquet'):
            filename += '.parquet'

        file_path = self._get_export_path(filename)
        loop = asyncio.get_running_loop()

        blocking_task = functools.partial(data.to_parquet, file_path, index=False)
        await loop.run_in_executor(None, blocking_task)

        print(f"Data successfully exported to {file_path}")
        return file_path
