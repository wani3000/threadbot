from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


@dataclass
class Settings:
    base_dir: Path
    data_dir: Path
    sources_file: Path
    style_file: Path
    manual_file: Path
    outputs_dir: Path
    openai_api_key: Optional[str]
    openai_model: str
    publish_endpoint: Optional[str]
    publish_token: Optional[str]
    publish_dry_run: bool
    smtp_host: Optional[str]
    smtp_port: int
    smtp_user: Optional[str]
    smtp_password: Optional[str]
    email_from: Optional[str]
    email_to: Optional[str]
    dashboard_base_url: str



def load_settings() -> Settings:
    load_dotenv()
    base_dir = Path(os.getenv("THREADBOT_BASE_DIR", Path.cwd()))
    data_dir = base_dir / "data"
    return Settings(
        base_dir=base_dir,
        data_dir=data_dir,
        sources_file=Path(os.getenv("THREADBOT_SOURCES_FILE", data_dir / "inputs" / "sources.yaml")),
        style_file=Path(os.getenv("THREADBOT_STYLE_FILE", data_dir / "style" / "writing_samples.txt")),
        manual_file=Path(os.getenv("THREADBOT_MANUAL_FILE", data_dir / "inputs" / "manual_items.csv")),
        outputs_dir=Path(os.getenv("THREADBOT_OUTPUT_DIR", data_dir / "outputs")),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        publish_endpoint=os.getenv("THREADS_PUBLISH_ENDPOINT"),
        publish_token=os.getenv("THREADS_PUBLISH_TOKEN"),
        publish_dry_run=os.getenv("THREADS_DRY_RUN", "true").lower() in {"1", "true", "yes"},
        smtp_host=os.getenv("SMTP_HOST"),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_user=os.getenv("SMTP_USER"),
        smtp_password=os.getenv("SMTP_PASSWORD"),
        email_from=os.getenv("EMAIL_FROM"),
        email_to=os.getenv("EMAIL_TO"),
        dashboard_base_url=os.getenv("DASHBOARD_BASE_URL", "http://localhost:8501"),
    )
