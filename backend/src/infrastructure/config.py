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
        
        # Canonical project root directory (D:/Job/HALOCOM/Scripts/Dark_Magician/3D_Sims_QC)
        project_root = Path(__file__).resolve().parent.parent.parent.parent
        self.project_root: str = str(project_root)
        self.vault_root: str = os.getenv("VAULT_ROOT", str(project_root / "ObsidianVault"))
        self.json_root: str = os.getenv("JSON_ROOT", str(project_root / "JsonLogs"))
        self.db_path: str = os.getenv("SQLITE_DB_PATH", str(project_root / "telemetry_buffer.db"))
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        # Supabase Hub Configuration
        self.supabase_url: str = os.getenv("SUPABASE_URL", "")
        self.supabase_key: str = os.getenv(
            "SUPABASE_KEY",
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_ANON_KEY", ""))
        )
        self.supabase_auto_sync: bool = os.getenv("SUPABASE_AUTO_SYNC", "false").lower() in ("true", "1", "yes")

        # CORS allowed origins
        cors_raw = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173"
        )
        self.cors_origins: List[str] = [origin.strip() for origin in cors_raw.split(",") if origin.strip()]

settings = Settings()
