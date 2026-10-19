"""
Application Use Case for Physics-Based Sanity Check.
Connects Domain Physics Engine with Repositories and Profiles.
"""
from typing import Any, Dict, Optional
from backend.src.domain.physics_engine import PhysicsSanityEngine, PhysicsSanityResult
from backend.src.domain.protocols import TelemetryRepositoryProtocol, VaultStorageProtocol


class PhysicsSanityCheckUseCase:
    """
    Use case to execute comprehensive physics rules against a live slicer profile
    or a stored session snapshot.
    """

    def __init__(
        self,
        engine: Optional[PhysicsSanityEngine] = None,
        repo: Optional[TelemetryRepositoryProtocol] = None,
        vault: Optional[VaultStorageProtocol] = None,
    ) -> None:
        self._engine = engine or PhysicsSanityEngine()
        self._repo = repo
        self._vault = vault

    def execute(
        self,
        profile: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> PhysicsSanityResult:
        target_profile = profile or {}

        # If profile not provided but session_id is provided, attempt to reconstruct from audit or vault
        if not target_profile and session_id and self._vault:
            audit = self._vault.get_audit_json(session_id)
            if audit and "profile_snapshot" in audit:
                target_profile = audit["profile_snapshot"] or {}
            elif audit and "slicer" in audit:
                # Map slicer & hardware fields
                slicer = audit.get("slicer", {})
                hw = audit.get("hardware", {})
                target_profile = {
                    "material": audit.get("material", "PLA"),
                    "layerHeight": slicer.get("layerHeightMm", 0.20),
                    "infillDensity": slicer.get("infillPercent", 20),
                    "supportMode": slicer.get("supportType", "None"),
                    "outerWallSpeed": hw.get("speedF", {}).get("wallMmS", 150),
                    "infillSpeed": hw.get("speedF", {}).get("infillMmS", 275),
                    "bedTemp": hw.get("tempsE", {}).get("bedTempC", 60),
                    "nozzleTemp": hw.get("tempsE", {}).get("nozzleTempC", 210),
                    "coolingFanSpeed": hw.get("tempsE", {}).get("fanSpeedPercent", 100),
                }

        # Execute deterministic physics evaluation
        return self._engine.evaluate(target_profile)
