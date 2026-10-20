"""
Application and Infrastructure Configuration Settings.
Uses Pydantic Settings v2 to load configuration from environment variables
or .env file with robust validation and safe defaults.
"""
from pathlib import Path
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    """System configuration settings with Pydantic v2 validation."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = Field(default="127.0.0.1", description="FastAPI host address")
    port: int = Field(default=8000, description="FastAPI port")

    project_root: str = Field(default_factory=lambda: str(PROJECT_ROOT))
    vault_root: str = Field(default_factory=lambda: str(PROJECT_ROOT / "ObsidianVault"))
    json_root: str = Field(default_factory=lambda: str(PROJECT_ROOT / "JsonLogs"))
    db_path: str = Field(default_factory=lambda: str(PROJECT_ROOT / "telemetry_buffer.db"))

    gemini_api_key: str = Field(default="", description="Google Gemini API Key")
    gemini_model: str = Field(default="gemini-2.5-flash", description="Gemini model identifier")

    # Supabase Hub Configuration
    supabase_url: str = Field(default="", description="Supabase project REST URL")
    supabase_key: str = Field(default="", description="Supabase service role or anon key")
    supabase_auto_sync: bool = Field(default=False, description="Enable automatic sync on save")

    # CORS Configuration
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
