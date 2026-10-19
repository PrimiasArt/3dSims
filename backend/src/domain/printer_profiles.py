"""
Standard Hardware Printer Profiles & Physical Kinematic Constraints.
Provides specifications for popular FDM 3D printers to validate simulation and QC bounds.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class PrinterHardwareSpecs(BaseModel):
    id: str
    brand: str
    model: str
    kinematics: str = Field(..., description="CoreXY, Bed-Slinger, Delta, or Flying Gantry")
    max_print_speed: float = Field(..., description="Max linear printing speed in mm/s")
    max_travel_speed: float = Field(..., description="Max travel speed in mm/s")
    max_acceleration: float = Field(..., description="Max acceleration in mm/s^2")
    max_volumetric_flow: float = Field(..., description="Max standard hotend flow rate in mm^3/s")
    max_nozzle_temp: float = Field(..., description="Max nozzle temperature in Celsius")
    max_bed_temp: float = Field(..., description="Max heated bed temperature in Celsius")
    build_volume: Dict[str, float] = Field(..., description="Dimensions: x, y, z in mm")
    extruder_type: str = Field(default="Direct Drive", description="Direct Drive or Bowden")
    enclosed: bool = Field(default=False, description="Whether the chamber is actively or passively enclosed")
    features: List[str] = Field(default_factory=list, description="Key features like Input Shaping, Lidar, etc.")


PRINTER_PROFILES_DATABASE: Dict[str, PrinterHardwareSpecs] = {
    "bambu_x1c": PrinterHardwareSpecs(
        id="bambu_x1c",
        brand="Bambu Lab",
        model="X1-Carbon Combo",
        kinematics="CoreXY",
        max_print_speed=500.0,
        max_travel_speed=500.0,
        max_acceleration=20000.0,
        max_volumetric_flow=32.0,
        max_nozzle_temp=300.0,
        max_bed_temp=120.0,
        build_volume={"x": 256.0, "y": 256.0, "z": 256.0},
        extruder_type="Direct Drive",
        enclosed=True,
        features=["Micro Lidar", "Vibration Compensation", "Active Chamber Temp Sensor", "Dual Bed Leveling"]
    ),
    "bambu_p1s": PrinterHardwareSpecs(
        id="bambu_p1s",
        brand="Bambu Lab",
        model="P1S",
        kinematics="CoreXY",
        max_print_speed=500.0,
        max_travel_speed=500.0,
        max_acceleration=20000.0,
        max_volumetric_flow=28.0,
        max_nozzle_temp=300.0,
        max_bed_temp=100.0,
        build_volume={"x": 256.0, "y": 256.0, "z": 256.0},
        extruder_type="Direct Drive",
        enclosed=True,
        features=["Vibration Compensation", "Enclosed Chamber", "Automatic Flow Calibration"]
    ),
    "prusa_mk4": PrinterHardwareSpecs(
        id="prusa_mk4",
        brand="Prusa Research",
        model="Original Prusa MK4",
        kinematics="Bed-Slinger",
        max_print_speed=200.0,
        max_travel_speed=300.0,
        max_acceleration=4000.0,
        max_volumetric_flow=18.0,
        max_nozzle_temp=300.0,
        max_bed_temp=120.0,
        build_volume={"x": 250.0, "y": 210.0, "z": 220.0},
        extruder_type="Direct Drive",
        enclosed=False,
        features=["Nextruder Loadcell Sensor", "Input Shaper", "Pressure Advance", "Magnetic Heatbed"]
    ),
    "voron_2_4": PrinterHardwareSpecs(
        id="voron_2_4",
        brand="Voron Design",
        model="Voron 2.4 R2 350",
        kinematics="Flying Gantry CoreXY",
        max_print_speed=600.0,
        max_travel_speed=800.0,
        max_acceleration=25000.0,
        max_volumetric_flow=36.0,
        max_nozzle_temp=350.0,
        max_bed_temp=130.0,
        build_volume={"x": 350.0, "y": 350.0, "z": 350.0},
        extruder_type="Direct Drive",
        enclosed=True,
        features=["Klipper Firmware", "Quad Gantry Level", "Dragon UHF Hotend", "Stealthburner Toolhead"]
    ),
    "creality_k1_max": PrinterHardwareSpecs(
        id="creality_k1_max",
        brand="Creality",
        model="K1 Max",
        kinematics="CoreXY",
        max_print_speed=600.0,
        max_travel_speed=600.0,
        max_acceleration=20000.0,
        max_volumetric_flow=32.0,
        max_nozzle_temp=300.0,
        max_bed_temp=120.0,
        build_volume={"x": 300.0, "y": 300.0, "z": 300.0},
        extruder_type="Direct Drive",
        enclosed=True,
        features=["AI Lidar", "Dual Cooling Fans", "High Flow Hotend", "Auto Bed Tramming"]
    ),
    "ender_3_v3": PrinterHardwareSpecs(
        id="ender_3_v3",
        brand="Creality",
        model="Ender-3 V3 CoreXZ",
        kinematics="CoreXZ Bed-Slinger",
        max_print_speed=300.0,
        max_travel_speed=350.0,
        max_acceleration=8000.0,
        max_volumetric_flow=20.0,
        max_nozzle_temp=300.0,
        max_bed_temp=100.0,
        build_volume={"x": 220.0, "y": 220.0, "z": 250.0},
        extruder_type="Direct Drive",
        enclosed=False,
        features=["Sprite Extruder", "CoreXZ Synchronous Belts", "Tri-metal Unicorn Nozzle"]
    )
}


def get_all_printer_profiles() -> List[PrinterHardwareSpecs]:
    """Returns list of all available printer profiles."""
    return list(PRINTER_PROFILES_DATABASE.values())


def get_printer_profile(printer_id: str) -> Optional[PrinterHardwareSpecs]:
    """Returns specific printer profile by ID or None."""
    return PRINTER_PROFILES_DATABASE.get(printer_id.lower().strip())