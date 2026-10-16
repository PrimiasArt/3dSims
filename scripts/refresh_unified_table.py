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

    session_cols, json_matrix_rows, table_md = build_parameter_session_matrix(entries)

    matrix_payload = {
        "schema_version": "v2026.1",
        "kieu_trinh_bay": "bang_hop_nhat_phan_lop",
        "tong_so_phien": len(entries),
        "danh_sach_phien": session_cols,
        "bang_tong_hop": json_matrix_rows,
        "ma_tran_tham_so": json_matrix_rows,
        "chi_tiet_tung_phien": entries,
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(matrix_payload, f, indent=2, ensure_ascii=False)

    md_content = render_markdown_log(entries)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"SUCCESS: Regenerated {len(entries)} sessions into 1 unified layered table in {md_path}")

if __name__ == "__main__":
    main()
