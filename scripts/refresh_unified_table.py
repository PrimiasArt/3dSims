import json
from pathlib import Path
import sys

# Ensure backend can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.src.infrastructure.minimalist_formatter import (
    build_parameter_session_matrix,
    render_markdown_log,
)
from backend.src.infrastructure.obsidian_vault import ObsidianVaultAdapter

def main():
    root = Path(__file__).resolve().parent.parent
    vault = ObsidianVaultAdapter(
        vault_root=str(root / "ObsidianVault"),
        json_root=str(root / "JsonLogs"),
    )
    json_path = root / "JsonLogs" / "nhat_ky_in.json"
    md_path = root / "ObsidianVault" / "02_NhatKy_In" / "nhat_ky_in.md"
    moc_path = root / "ObsidianVault" / "000_PRINT_INDEX.md"
    profiles_dir = root / "ObsidianVault" / "01_Profiles_In3D"
    phieu_dir = root / "ObsidianVault" / "02_NhatKy_In"

    profiles_dir.mkdir(parents=True, exist_ok=True)
    phieu_dir.mkdir(parents=True, exist_ok=True)

    if not json_path.exists():
        print(f"Error: {json_path} does not exist")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        entries = data.get("sessions", []) or data.get("chi_tiet_tung_phien", [])

    session_cols, sessions_list, table_html = build_parameter_session_matrix(entries)

    payload = {
        "schema_version": "v2026.1",
        "kieu_trinh_bay": "bang_da_tang_multi_tier",
        "total_sessions": len(entries),
        "session_ids": session_cols,
        "sessions": entries,
        "chi_tiet_tung_phien": entries,
        "bang_tong_hop": sessions_list,
        "ma_tran_tham_so": sessions_list,
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    # 1. Regenerate 02_NhatKy_In/nhat_ky_in.md
    md_content = render_markdown_log(entries)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    # 2. Regenerate 01_Profiles_In3D/Profile_In3D_{s_id}.md for all sessions
    generated_profiles = 0
    for s in entries:
        s_id = str(s.get("sessionId", "01"))
        p_path = profiles_dir / f"Profile_In3D_{s_id}.md"
        p_content = vault.render_3d_profile_from_dict(s)
        with open(p_path, "w", encoding="utf-8") as f:
            f.write(p_content)
        generated_profiles += 1

    # 3. Regenerate MOC 000_PRINT_INDEX.md
    session_table_rows = [
        f"| `{s.get('sessionId', f'{i+1:02d}')}` | [[Profile_In3D_{s.get('sessionId', f'{i+1:02d}')}|🎨 Profile In 3D #{s.get('sessionId', f'{i+1:02d}')}]] | [[PHIEU_{s.get('sessionId', f'{i+1:02d}')}|Phiếu #{s.get('sessionId', f'{i+1:02d}')}]] | `{s.get('startedAt', '-')}` | `{s.get('slicer', {}).get('layerHeightMm', 0.2)}mm` | `01_Profiles_In3D/` | `02_NhatKy_In/` |"
        for i, s in enumerate(entries)
    ]
    session_table_str = "\\n".join(session_table_rows)

    moc_content = f"""---
type: moc
tags:
  - printsim/index
  - corexy/vault
---

# 🌐 3D PrintSim Pro — Map of Content (MOC) & Graph Navigator

> **Obsidian Graph View Hub**: Tệp này liên kết toàn bộ hồ sơ in 3D, báo cáo kiểm định và nhật ký in để trực quan hóa sơ đồ mạng nhện.

---

## 📦 1. Bảng Tổng Hợp Hồ Sơ In 3D & Nhật Ký In (Master Matrix)

| Phiên in | Hồ Sơ In 3D (Executive) | Phiếu Chi Tiết | Thời Gian | Cấu Hình Lớp | Thư Mục Profile | Thư Mục Nhật Ký |
| :---: | :--- | :--- | :---: | :---: | :--- | :--- |
{session_table_str}

---

## 🔍 2. Truy Vấn Obsidian Dataview Toàn Bộ Phiên In
```dataview
TABLE startedAt as "Thời gian", status as "Trạng thái", slicer.layerHeightMm as "Độ dày lớp", hardware.speedF.defaultMmS as "Tốc độ F"
FROM "01_Profiles_In3D" OR "02_NhatKy_In" OR #printsim/phieu-in
SORT file.mtime DESC
```

---

## 📋 3. Nhật Ký In Khóa Chuẩn (02_NhatKy_In)
- [[nhat_ky_in|Nhật Ký In Tổng Hợp]] (`02_NhatKy_In/nhat_ky_in.md`)

---
*Tự động đồng bộ bởi 3D PrintSim Telemetry Engine.*
"""
    with open(moc_path, "w", encoding="utf-8") as f:
        f.write(moc_content)

    print(f"SUCCESS: Synchronized {len(entries)} sessions across:")
    print(f"  - 02_NhatKy_In/nhat_ky_in.md")
    print(f"  - 01_Profiles_In3D/ ({generated_profiles} profiles)")
    print(f"  - 000_PRINT_INDEX.md (MOC Index)")
    print(f"  - JsonLogs/nhat_ky_in.json")

if __name__ == "__main__":
    main()
