"""
Minimalist Log Formatter conforming strictly to the LOCKED SCHEMA & PRINT LOG CONTRACT.
Maintains 100% backward compatibility by re-exporting from backend.src.infrastructure.formatters.
"""
from backend.src.infrastructure.formatters import (
    PARAM_CONFIG,
    ALL_PARAM_SPECS,
    APP_CHANGEABLE_PARAMETERS,
    format_param_value,
    get_val_and_churn,
    extract_session_report_parameters,
    convert_entry_to_print_log_session,
    build_session_entry,
    render_kpi_cards,
    render_spreadsheet_table,
    build_parameter_session_matrix,
    render_markdown_log,
)

# Alias for private helper for backward compatibility
_get_val_and_churn = get_val_and_churn

__all__ = [
    "PARAM_CONFIG",
    "ALL_PARAM_SPECS",
    "APP_CHANGEABLE_PARAMETERS",
    "format_param_value",
    "_get_val_and_churn",
    "get_val_and_churn",
    "extract_session_report_parameters",
    "convert_entry_to_print_log_session",
    "build_session_entry",
    "render_kpi_cards",
    "render_spreadsheet_table",
    "build_parameter_session_matrix",
    "render_markdown_log",
]
