"""
Main entry point for running the Telemetry & Audit Engine FastAPI server.
"""
import os
import sys
from pathlib import Path

# Centralize all Python bytecode (.pyc) into a single backend/.pycache directory
pycache_dir = Path(__file__).resolve().parent / ".pycache"
pycache_dir.mkdir(parents=True, exist_ok=True)
sys.pycache_prefix = str(pycache_dir)
os.environ["PYTHONPYCACHEPREFIX"] = str(pycache_dir)

root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import uvicorn
from backend.src.infrastructure.config import settings
from backend.src.presentation.api import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host=settings.host, port=settings.port, reload=True)