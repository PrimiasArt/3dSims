"""
Domain Models for Filament Spool Inventory & RFID Smart Warning.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class FilamentSpool(BaseModel):
    """Represents a physical filament spool in the workshop inventory or AMS."""
    id: str = Field(..., description="Unique spool identifier or barcode")
    name: str = Field(..., description="Display name of the spool")
    brand: str = Field(default="Bambu Lab", description="Filament manufacturer")
    material: str = Field(default="PLA", description="Polymer type: PLA, PETG, ABS, ASA, TPU")
    color_name: str = Field(default="Bambu Orange", description="Color human label")
    color_hex: str = Field(default="#ea580c", description="HEX color code for UI preview")
    initial_weight_g: float = Field(default=1000.0, ge=100.0, description="Nominal weight when new in grams")
    remaining_weight_g: float = Field(default=1000.0, ge=0.0, description="Current remaining weight in grams")
    cost_vnd: float = Field(default=350000.0, ge=0.0, description="Purchase cost in VND")
    diameter_mm: float = Field(default=1.75, description="Filament diameter (1.75 or 2.85)")
    density_g_cm3: float = Field(default=1.24, description="Material volumetric density in g/cm3")
    temp_nozzle_recommended: int = Field(default=210, description="Optimal nozzle temperature in Celsius")
    temp_bed_recommended: int = Field(default=60, description="Optimal heated bed temperature in Celsius")
    rfid_tag: Optional[str] = Field(default=None, description="Bambu/NFC RFID tag code if supported")
    location: str = Field(default="AMS Slot 1", description="Current position: AMS Slot 1-4, Drybox, Shelf")
    is_active: bool = Field(default=True, description="Whether spool is currently loaded and ready to print")

    @property
    def percentage_left(self) -> float:
        if self.initial_weight_g <= 0:
            return 0.0
        return round(max(0.0, min(100.0, (self.remaining_weight_g / self.initial_weight_g) * 100.0)), 1)


class SpoolVerificationResult(BaseModel):
    """Result of checking if a spool has sufficient weight for a requested 3D model."""
    can_complete: bool = Field(..., description="True if remaining weight >= required weight + safety buffer")
    required_grams: float = Field(..., description="Required model weight in grams")
    remaining_grams: float = Field(..., description="Available weight on the spool in grams")
    safety_margin_g: float = Field(default=5.0, description="Safety buffer grams for purge line and tower")
    deficit_grams: float = Field(default=0.0, description="Shortage grams if spool will run out mid-print")
    material_matches: bool = Field(default=True, description="Whether spool polymer matches sliced profile")
    status_badge: str = Field(..., description="OPTIMAL, SUFFICIENT, RUNOUT_HAZARD, MATERIAL_MISMATCH")
    warning_message: Optional[str] = None
    recommended_action: str
