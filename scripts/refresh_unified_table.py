import json
from pathlib import Path
import sys

# Ensure backend can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.src.infrastructure.minimalist_formatter import (
    build_parameter_session_matrix,
    render_markdown_log,
)

def main():
    root = Path(__file__).resolve().parent.parent
    json_path = root / "JsonLogs" / "nhat_ky_in.json"
    md_path = root / "ObsidianVault" / "02_NhatKy_In" / "nhat_ky_in.md"

    if not json_path.exists():
        print(f"Error: {json_path} does not exist")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        entries = data.get("chi_tiet_tung_phien", [])

    session_cols, sessions_list, table_html = build_parameter_session_matrix(entries)

    payload = {
        "schema_version": "v2026.1",
        "kieu_trinh_bay": "bang_da_tang_multi_tier",
        "total_sessions": len(sessions_list),
        "session_ids": session_cols,
        "sessions": sessions_list,
        "chi_tiet_tung_phien": entries,
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    md_content = render_markdown_log(entries)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"SUCCESS: Regenerated Multi-Tier Log Table for {len(sessions_list)} sessions in {md_path}")

if __name__ == "__main__":
    main()
