"""
Application and Infrastructure Configuration Settings.
Loads from environment variables or .env file with safe defaults.
"""
import os
from pathlib import Path
from typing import List

class Settings:
    """System configuration settings."""
    def __init__(self) -> None:
        self.host: str = os.getenv("HOST", "127.0.0.1")
        self.port: int = int(os.getenv("PORT", "8000"))
        self.vault_root: str = os.getenv("VAULT_ROOT", str(Path("ObsidianVault").resolve()))
        self.json_root: str = os.getenv("JSON_ROOT", str(Path("JsonLogs").resolve()))
        self.db_path: str = os.getenv("SQLITE_DB_PATH", str(Path("telemetry_buffer.db").resolve()))
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        # CORS allowed origins
        cors_raw = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173"
        )
        self.cors_origins: List[str] = [origin.strip() for origin in cors_raw.split(",") if origin.strip()]

settings = Settings()
