"""
Main entry point for running the Telemetry & Audit Engine FastAPI server.
"""
import uvicorn
from backend.src.presentation.api import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
