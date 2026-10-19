"""

Obsidian Vault Storage Adapter.

Produces multi-tier output:

- 01_Profiles_In3D: Executive 3D Print Profiles for cross-functional roles (Designers, Operators, Managers)

- 01_BaoCao_KiemDinh: Technical Audit Reports (.md with YAML frontmatter + Dataview queries)

- 02_NhatKy_In: Spreadsheet-style Master Log Matrix and individual PHIEU_{session_id}.md notes

- JsonLogs: Structured JSON telemetry and logs (Schema v2026.1)

- 000_PRINT_INDEX.md: Central Map of Content (MOC) connecting all nodes for Obsidian Graph View.



Guarantees atomic writes and defends strictly against Path Traversal vulnerabilities.

"""

import json

import os

from pathlib import Path

from typing import Any, Dict, List, Optional, Tuple



from backend.src.domain.entities import AuditReport, ParameterMetric

from backend.src.domain.exceptions import PathTraversalSecurityError

from backend.src.domain.protocols import VaultStorageProtocol





class ObsidianVaultAdapter(VaultStorageProtocol):

    """Adapter for storing audits, 3D profiles, and logs in a clean Obsidian Vault structure."""



    def __init__(

        self,

        vault_root: str = "ObsidianVault",

        json_root: str = "JsonLogs",

    ) -> None:

        self._vault_root = Path(vault_root).resolve()

        self._json_root = Path(json_root).resolve()

        self._vault_root.mkdir(parents=True, exist_ok=True)

        self._json_root.mkdir(parents=True, exist_ok=True)



        # Pre-create organized folder structure for all roles

        self._profiles_dir = self._vault_root / "01_Profiles_In3D"

        self._audits_dir = self._vault_root / "01_BaoCao_KiemDinh"

        self._logs_dir = self._vault_root / "02_NhatKy_In"

        

        for d in [self._profiles_dir, self._audits_dir, self._logs_dir]:

            d.mkdir(parents=True, exist_ok=True)



    def _resolve_safe_md_path(self, filename: str) -> Path:

        """Resolves target markdown path and enforces that it remains within vault_root boundary."""

        target = (self._vault_root / filename).resolve()

        try:

            target.relative_to(self._vault_root)

        except ValueError:

            raise PathTraversalSecurityError(filename)

        return target



    def _resolve_safe_json_path(self, filename: str) -> Path:

        """Resolves target JSON path and enforces that it remains within json_root boundary."""

        target = (self._json_root / filename).resolve()

        try:

            target.relative_to(self._json_root)

        except ValueError:

            raise PathTraversalSecurityError(filename)

        return target



    def _resolve_safe_path(self, filename: str) -> Path:

        """Routes files according to extension: .json -> json_root, .md -> vault_root."""

        if filename.lower().endswith(".json"):

            return self._resolve_safe_json_path(filename)

        return self._resolve_safe_md_path(filename)



    def _atomic_write(self, target_path: Path, content: str) -> None:

        """Writes content to a temporary file and atomically renames it to target_path."""

        target_path.parent.mkdir(parents=True, exist_ok=True)

        temp_path = target_path.with_name(f".tmp_{target_path.name}_{os.getpid()}")

        try:

            with open(temp_path, "w", encoding="utf-8") as f:

                f.write(content)

                f.flush()

                os.fsync(f.fileno())

            os.replace(temp_path, target_path)

        except Exception:

            if temp_path.exists():

                try:

                    temp_path.unlink()

                except OSError:

                    pass

            raise



    def save_dual_audit(self, report: AuditReport) -> Tuple[str, str]:

        # Path traversal guard on session_id

        safe_session = report.session_id.strip()

        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:

            raise PathTraversalSecurityError(report.session_id)



        md_filename = f"01_BaoCao_KiemDinh/Audit_{safe_session}.md"

        profile_filename = f"01_Profiles_In3D/Profile_In3D_{safe_session}.md"

        json_filename = f"Audit_{safe_session}.json"



        md_path = self._resolve_safe_path(md_filename)

        profile_path = self._resolve_safe_path(profile_filename)

        json_path = self._resolve_safe_path(json_filename)



        # 1. Render Technical Audit Markdown (.md)

        md_content = self._render_markdown(report)

        self._atomic_write(md_path, md_content)



        # 2. Render Executive 3D Print Profile (.md) - Non-Dev Friendly

        profile_content = self._render_3d_profile(report)

        self._atomic_write(profile_path, profile_content)



        # 3. Render Machine JSON (Schema v2026.1)

        json_content = self._render_json(report)

        self._atomic_write(json_path, json_content)



        # 4. Update Obsidian Map of Content (MOC) for Graph View

        self._update_moc_index(report)



        # 5. Update Minimalist Locked Schema Logs (nhat_ky_in.json & nhat_ky_in.md)

        self._update_minimalist_logs(report)



        return (str(md_path), str(json_path))



    def get_audit_json(self, session_id: str) -> Optional[Dict[str, Any]]:

        safe_session = session_id.strip()

        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:

            raise PathTraversalSecurityError(session_id)



        json_path = self._resolve_safe_path(f"Audit_{safe_session}.json")

        if not json_path.exists():

            return None

        with open(json_path, "r", encoding="utf-8") as f:

            return json.load(f)




    def render_3d_profile_from_dict(self, s: dict) -> str:
        """
        Renders an executive, highly intuitive 3D Print Profile from a session dict.
        Designed specifically for non-developers (Designers, 3D Artists, QA, Workshop Operators).
        Guarantees exact-position parameter extraction without corruption or mixing.
        """
        s_id = str(s.get("sessionId", "01"))
        op = s.get("operator", "Kỹ sư in 3D (CoreXY)")
        started = s.get("startedAt", "2026-10-17 10:00")
        dur = s.get("durationMinutes", 0)
        status = s.get("status", "COMPLETED")
        parent = s.get("parentSessionId")
        failure = s.get("failureDetail")

        meta = s.get("metadata", {})
        model_name = meta.get("modelName", f"Mô hình 3D (Phiên #{s_id})")
        mat = meta.get("material", "PLA")
        score = meta.get("printabilityScore", 95)
        filament_g = meta.get("filamentGrams", 15.0)
        total_layers = meta.get("totalLayers", 200)

        slicer = s.get("slicer", {})
        lh = float(slicer.get("layerHeightMm", 0.20))
        inf = int(slicer.get("infillPercent", 20))
        inf_type = str(slicer.get("infillType", "Gyroid"))
        wl = int(slicer.get("wallLoops", 2))
        tb = slicer.get("topBottomLayers", {"top": 4, "bottom": 3})
        sup = str(slicer.get("supportType", "None"))
        ang = int(slicer.get("supportOverhangAngle", 45))

        hw = s.get("hardware", {})
        spd = hw.get("speedF", {})
        spd_def = float(spd.get("defaultMmS", 60))
        spd_wall = float(spd.get("wallMmS", 150))
        spd_inf = float(spd.get("infillMmS", 275))

        temps = hw.get("tempsE", {})
        bed_t = float(temps.get("bedTempC", 60))
        noz_t = float(temps.get("nozzleTempC", 210))
        fan = int(temps.get("fanSpeedPercent", 100))

        ext = hw.get("extrusion", {})
        flow = float(ext.get("flowRatio", 0.98))
        ret = float(ext.get("retractionMm", 0.8))
        zh = float(ext.get("zHopMm", 0.4))

        # Physical hazard evaluation
        mat_upper = mat.upper()
        warping_hazard = (mat_upper in ["ABS", "ASA"] and bed_t < 90) or (mat_upper == "PLA" and bed_t < 50)
        heatcreep_hazard = (mat_upper == "PLA" and bed_t >= 75) or (spd_def > 320)
        stringing_hazard = (noz_t > 225 and ret < 0.6)

        status_badge = "🟢 ĐẠT CHUẨN SẢN XUẤT (OPTIMAL)"
        if status == "WARPING" or warping_hazard:
            status_badge = "🟡 CẢNH BÁO CONG VÊNH (WARPING RISK)"
        elif status != "COMPLETED":
            status_badge = "🔴 CẦN KIỂM TRA LẠI (FAILED)"

        advice_items = []
        if warping_hazard:
            advice_items.append("⚠️ **Nguy cơ cong vênh (Warping):** Tăng nhiệt độ bàn in lên mức khuyến nghị hoặc bổ sung vành bám (Brim).")
        if heatcreep_hazard:
            advice_items.append("⚠️ **Nguy cơ nghẹt cổ đùn (Heat Creep):** Giảm nhiệt độ bàn in để tránh truyền nhiệt ngược vào ống dẫn.")
        if stringing_hazard:
            advice_items.append("⚠️ **Nguy cơ kéo tơ (Stringing):** Tăng khoảng cách rút sợi (Retraction) hoặc giảm nhẹ nhiệt đầu phun.")
        if not advice_items:
            advice_items.append("✅ **Chất lượng lý tưởng:** Bộ thông số cân bằng hoàn hảo giữa tốc độ và độ sắc nét bề mặt.")

        advice_text = "\n".join(f"> - {item}" for item in advice_items)

        return f"""---
schema_version: "v2026.1"
doc_type: "3d_print_profile"
profile_id: "PROFILE_{s_id}"
ten_mo_hinh: "{model_name}"
vat_lieu: "{mat}"
nguoi_thuc_hien: "{op}"
thoi_gian: "{started}"
trang_thai: "{status}"
diem_chat_luong: {score}
do_day_lop_mm: {lh}
nhiet_do_ban_c: {bed_t}
nhiet_do_dau_in_c: {noz_t}
toc_do_in_mms: {spd_def:.0f}
tags:
  - printsim/profile-3d
  - vat-lieu/{mat.lower()}
  - trang-thai/{status.lower()}
---

# 🎨 HỒ SƠ THIẾT LẬP IN 3D (3D PRINT PROFILE): {model_name}

> **Mã hồ sơ:** `PROFILE_{s_id}` | **Vật liệu:** `{mat}` | **Trạng thái:** {status_badge}  
> **Điều hướng:** [[000_PRINT_INDEX|🧭 MOC Tổng]] | [[nhat_ky_in|📋 Bảng Nhật Ký Tổng Hợp]] | [[PHIEU_{s_id}|📄 Phiếu In #{s_id}]]

---

## 🌟 1. Tóm Tắt Dành Cho Quản Lý & Vận Hành (Executive Summary)
- 📌 **Mô hình in:** `{model_name}` ({mat})
- ⏱️ **Thời gian in:** `{dur}` phút | **Tổng số lớp:** `{total_layers}` lớp
- ⚖️ **Lượng nhựa tiêu hao ước tính:** `{filament_g}` g
- 🎯 **Điểm đánh giá khả thi:** `{score}/100` ({'Xuất sắc' if score >= 90 else 'Cần chú ý'})
- 👤 **Người thiết lập / Vận hành:** `{op}` | **Bắt đầu lúc:** `{started}`

---

## 📐 2. Cấu Trúc Lớp & Độ Phân Giải (Slicer Resolution & Shell)
| Thông số kỹ thuật | Giá trị thực tế | Ý nghĩa thực tế cho bản in |
| :--- | :---: | :--- |
| **Độ cao lớp (Layer Height)** | `{lh:.2f} mm` | Độ mịn bề mặt (Càng nhỏ bề mặt càng mịn bóng) |
| **Mật độ ruột (Infill)** | `{inf}%` | Độ cứng vững bên trong sản phẩm |
| **Dạng ruột (Infill Pattern)** | `{inf_type}` | Phân bổ lực đồng đều mọi hướng |
| **Độ dày vỏ ngoài (Wall Loops)** | `{wl} vòng` | Độ bền kéo và chống chịu lực tác động |
| **Lớp Nóc / Lớp Đáy** | `{tb.get('top', 4)} nóc / {tb.get('bottom', 3)} đáy` | Độ kín bề mặt trên cùng và mặt tiếp xúc bàn |
| **Giá đỡ chống sụp (Support)** | `{sup} ({ang}°)` | Giữ các chi tiết nhô ra ngoài không bị rơi tự do |

---

## ⚡ 3. Tốc Độ & Phần Cứng Máy In (Speed & Dynamics)
| Vị trí đầu phun | Tốc độ thiết lập | Đánh giá vận hành |
| :--- | :---: | :--- |
| **Tốc độ in cơ sở (Base Speed)** | `{spd_def:.0f} mm/s` | Tốc độ đẩy tổng thể của máy |
| **Tốc độ vách ngoài (Outer Wall)** | `{spd_wall:.0f} mm/s` | Đảm bảo tính thẩm mỹ, hạn chế rung sọc |
| **Tốc độ đùn ruột (Infill Speed)** | `{spd_inf:.0f} mm/s` | Tối ưu hóa thời gian in |

---

## 🌡️ 4. Nhiệt Độ & Cơ Chế Đùn Nhựa (Thermal & Extrusion)
| Thiết bị & Tham số | Thiết lập | Vai trò kỹ thuật |
| :--- | :---: | :--- |
| **Nhiệt độ bàn in (Heatbed)** | `{bed_t:.0f}°C` | Giúp đáy nhựa bám chặt bàn in, chống cong vênh |
| **Nhiệt độ đầu phun (Hotend)** | `{noz_t:.0f}°C` | Đảm bảo nhựa nóng chảy đều và liên kết lớp tối đa |
| **Quạt tản nhiệt chi tiết** | `{fan}%` | Làm đông nhựa ngay khi ra khỏi đầu phun |
| **Hệ số đùn nhựa (Flow Ratio)** | `{flow:.2f}` | Tránh đùn thiếu hoặc thừa nhựa |
| **Khoảng cách rút sợi (Retraction)** | `{ret} mm` | Chống chảy nhựa tơ nhện (stringing) khi di chuyển |
| **Nhấc đầu phun Z (Z-Hop)** | `{zh} mm` | Tránh va quệt vào mô hình khi đầu phun di chuyển |

---

## 🛡️ 5. Đánh Giá Rủi Ro Vật Lý & Khuyến Nghị Vận Hành
> [!tip] 💡 Hướng dẫn cho Thợ in & Designer:
{advice_text}

---

## 🔍 Truy Vấn Tự Động (Obsidian Dataview)
```dataview
TABLE startedAt as "Thời gian", metadata.material as "Vật liệu", slicer.layerHeightMm as "Lớp (mm)", hardware.tempsE.bedTempC as "Nhiệt bàn"
FROM "01_Profiles_In3D" OR #printsim/profile-3d
WHERE profile_id = "PROFILE_{s_id}"
```

---
*Tự động tổng hợp Profile In 3D bởi 3D PrintSim Telemetry Engine.*
"""

    def get_3d_profile_md(self, session_id: str) -> Optional[str]:

        """Retrieves the executive 3D print profile markdown for a given session."""

        safe_session = session_id.strip()

        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:

            raise PathTraversalSecurityError(session_id)



        profile_path = self._resolve_safe_path(f"01_Profiles_In3D/Profile_In3D_{safe_session}.md")

        if not profile_path.exists():

            return None

        with open(profile_path, "r", encoding="utf-8") as f:

            return f.read()




    def save_session_thumbnail(self, session_id: str, image_bytes: bytes, ext: str = "png") -> Tuple[str, str]:
        """
        Saves a model thumbnail image to ObsidianVault/01_Profiles_In3D/Attachments/Thumb_{session_id}.{ext}
        and updates the corresponding Profile_In3D_{session_id}.md to embed the image.
        """
        safe_session = session_id.strip()
        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:
            raise PathTraversalSecurityError(session_id)

        clean_ext = ext.lstrip(".").lower()
        if clean_ext not in ["png", "jpg", "jpeg", "webp"]:
            clean_ext = "png"

        attachments_dir = self._vault_root / "01_Profiles_In3D" / "Attachments"
        attachments_dir.mkdir(parents=True, exist_ok=True)

        filename = f"Thumb_{safe_session}.{clean_ext}"
        target_path = attachments_dir / filename
        rel_path = f"01_Profiles_In3D/Attachments/{filename}"

        # Dọn dẹp các định dạng ảnh cũ của phiên này để tránh xung đột
        for other_ext in ["png", "jpg", "jpeg", "webp"]:
            if other_ext != clean_ext:
                stale_path = attachments_dir / f"Thumb_{safe_session}.{other_ext}"
                if stale_path.exists():
                    try:
                        stale_path.unlink()
                    except OSError:
                        pass

        # Write binary image atomically
        temp_path = target_path.with_name(f".tmp_{target_path.name}_{os.getpid()}")
        try:
            with open(temp_path, "wb") as f:
                f.write(image_bytes)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, target_path)
        except Exception:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise

        # Update Profile_In3D_{session_id}.md if it exists
        profile_path = self._vault_root / "01_Profiles_In3D" / f"Profile_In3D_{safe_session}.md"
        if profile_path.exists():
            try:
                with open(profile_path, "r", encoding="utf-8") as f:
                    p_content = f.read()
                
                img_tag = f"![Mô hình 3D](Attachments/{filename})"
                if img_tag not in p_content and f"Thumb_{safe_session}" not in p_content:
                    # Insert after Executive Summary header
                    marker = "## 🌟 1. Tóm Tắt Dành Cho Quản Lý & Vận Hành (Executive Summary)"
                    if marker in p_content:
                        embed_block = f"""## 🖼️ Ảnh Mô Hình 3D (3D Model Preview)
> {img_tag}

{marker}"""
                        p_content = p_content.replace(marker, embed_block)
                    else:
                        p_content += "\n\n## 🖼️ Ảnh Mô Hình 3D\n> " + img_tag + "\n"
                    
                    self._atomic_write(profile_path, p_content)
            except Exception:
                pass

        return rel_path, str(target_path)

    def get_session_thumbnail_path(self, session_id: str) -> Optional[Path]:
        """Returns the physical Path of a session thumbnail if it exists."""
        safe_session = session_id.strip()
        if ".." in safe_session or "/" in safe_session or "\\" in safe_session:
            raise PathTraversalSecurityError(session_id)

        attachments_dir = self._vault_root / "01_Profiles_In3D" / "Attachments"
        for ext in ["png", "jpg", "jpeg", "webp"]:
            p = attachments_dir / f"Thumb_{safe_session}.{ext}"
            if p.exists():
                return p
        return None

    def save_comparison_report(self, comparison_data: Dict[str, Any]) -> Tuple[str, str]:
        """
        Saves a session comparison report into 01_BaoCao_KiemDinh/Comparison_{base}_vs_{target}.md
        and updates 000_PRINT_INDEX.md MOC.
        """
        filename = comparison_data.get("markdown_filename", "Comparison_report.md")
        safe_filename = filename.strip()
        if ".." in safe_filename or "/" in safe_filename or "\\" in safe_filename:
            raise PathTraversalSecurityError(safe_filename)

        md_path = self._vault_root / "01_BaoCao_KiemDinh" / safe_filename
        self._atomic_write(md_path, comparison_data.get("markdown", ""))

        # Update MOC
        moc_path = self._vault_root / "000_PRINT_INDEX.md"
        if moc_path.exists():
            try:
                with open(moc_path, "r", encoding="utf-8") as f:
                    moc_text = f.read()

                comp_link = f"- [[{safe_filename.replace('.md', '')}|⚖️ So Sánh: #{comparison_data.get('base_session_id')} vs #{comparison_data.get('target_session_id')}]] ({comparison_data.get('verdict_badge', '')})"
                if comp_link not in moc_text and safe_filename not in moc_text:
                    header_tag = "## ⚖️ Báo Cáo So Sánh Đối Chiếu (Session Comparisons)"
                    if header_tag not in moc_text:
                        moc_text += "\n\n---\n\n" + header_tag + "\n" + comp_link + "\n"
                    else:
                        moc_text = moc_text.replace(header_tag, header_tag + "\n" + comp_link)
                    self._atomic_write(moc_path, moc_text)
            except Exception:
                pass

        return f"01_BaoCao_KiemDinh/{safe_filename}", str(md_path)

    def _get_metric_val(self, metrics: List[ParameterMetric], name: str, default: Any = None) -> Any:

        for m in metrics:

            if m.parameter_name == name:

                return m.final_value if m.final_value is not None else default

        return default



    def _render_3d_profile(self, report: AuditReport) -> str:

        """

        Renders a synthesized, non-dev friendly 3D Print Profile.

        Organized cleanly for Designers, 3D Artists, QA, and Workshop Operators.

        """

        lh = float(self._get_metric_val(report.metrics, "layerHeight", 0.20) or 0.20)

        inf = int(self._get_metric_val(report.metrics, "infillDensity", 20) or 20)

        inf_type = str(self._get_metric_val(report.metrics, "infillType", "Gyroid") or "Gyroid")

        wl = int(self._get_metric_val(report.metrics, "wallLoops", 2) or 2)

        sup = str(self._get_metric_val(report.metrics, "supportMode", "Tắt") or "Tắt")

        tree = str(self._get_metric_val(report.metrics, "treeStyle", "Organic") or "Organic")

        brim = bool(self._get_metric_val(report.metrics, "brimEnabled", False))

        

        spd = float(self._get_metric_val(report.metrics, "printSpeed", 60) or 60)

        spd_wall = float(self._get_metric_val(report.metrics, "outerWallSpeed", 150) or 150)

        spd_inf = float(self._get_metric_val(report.metrics, "infillSpeed", 275) or 275)

        spd_trav = float(self._get_metric_val(report.metrics, "travelSpeed", 500) or 500)



        noz_t = float(self._get_metric_val(report.metrics, "nozzleTemp", 210) or 210)

        bed_t = float(self._get_metric_val(report.metrics, "bedTemp", 60) or 60)

        fan = int(self._get_metric_val(report.metrics, "coolingFanSpeed", 100) or 100)



        flow = float(self._get_metric_val(report.metrics, "flowRateMm3s", 0.98) or 0.98)

        ret = float(self._get_metric_val(report.metrics, "retractionDistanceMm", 0.8) or 0.8)

        ret_spd = float(self._get_metric_val(report.metrics, "retractionSpeedMmS", 35) or 35)

        zh = float(self._get_metric_val(report.metrics, "zHopMm", 0.4) or 0.4)



        # Evaluate Physical Hazards

        mat = report.material.upper()

        warping_hazard = (mat in ["ABS", "ASA"] and not brim) or (bed_t < 55)

        heatcreep_hazard = (mat == "PLA" and bed_t >= 75) or (spd > 320)

        stringing_hazard = (noz_t > 225 and ret < 0.6)



        status_verdict = "PASSED"

        status_badge = "🟢 ĐẠT CHUẨN SẢN XUẤT (OPTIMAL)"

        if warping_hazard or heatcreep_hazard:

            status_verdict = "WARNING"

            status_badge = "🟡 CẦN LƯU Ý (WARNING)"



        advice_items = []

        if warping_hazard:

            advice_items.append("⚠️ **Nguy cơ cong vênh (Warping):** Nên bật vành bám Brim >= 5mm và duy trì nhiệt bàn in tối thiểu 60°C.")

        if heatcreep_hazard:

            advice_items.append("⚠️ **Nguy cơ trào ngược nhiệt (Heatcreep):** Nhiệt bàn in cao hoặc tốc độ quá tải có thể làm tắc đầu đùn.")

        if stringing_hazard:

            advice_items.append("⚠️ **Nguy cơ giăng tơ (Stringing):** Nên tăng khoảng cách rút nhựa (Retraction) lên 0.8mm - 1.0mm.")

        if not advice_items:

            advice_items.append("✅ Bộ thông số cân bằng lý tưởng giữa tốc độ in và chất lượng bề mặt láng mịn.")



        advice_text = "\n".join(f"> - {item}" for item in advice_items)



        return f"""---

schema_version: "v2026.1"

doc_type: "3d_print_profile"

profile_id: "PROFILE_{report.session_id}"

session_id: "{report.session_id}"

material: "{report.material}"

status: "{status_verdict}"

layer_height_mm: {lh}

infill_percent: {inf}

nozzle_temp_c: {noz_t}

bed_temp_c: {bed_t}

print_speed_mms: {spd}

warping_risk: "{'HIGH' if warping_hazard else 'LOW'}"

heatcreep_risk: "{'HIGH' if heatcreep_hazard else 'LOW'}"

hesitation_churn_count: {len(report.high_churn_parameters)}

created_at: "{report.created_at.isoformat()}"

tags:

  - printsim/3d-profile

  - material/{report.material.lower()}

  - status/{status_verdict.lower()}

---



# 📦 Hồ Sơ Cấu Hình In 3D: Profile_{report.session_id}



> **MOC Tổng Hợp:** [[000_PRINT_INDEX|Trang Chủ MOC]] | **Báo Cáo Kiểm Định:** [[Audit_{report.session_id}|Báo Cáo Chi Tiết]] | **Nhật Ký In:** [[nhat_ky_in|Bảng Ma Trận]]  

> **Chất liệu:** `{report.material}` | **Thời gian tạo:** `{report.created_at.strftime('%Y-%m-%d %H:%M')}` | **Đánh giá chung:** {status_badge}



---



## 🎯 1. Đánh Giá Trực Quan Cho Mọi Bộ Phận (Executive Summary)

| Chỉ Số Trọng Tâm | Giá Trị Thực Tế | Ngưỡng Tiêu Chuẩn | Trạng Thái |

| :--- | :---: | :---: | :---: |

| **Chất Liệu Nhựa** | `{report.material}` | Tiêu chuẩn Slicer | ✅ Đúng chủng loại |

| **Độ Mịn Bề Mặt (Layer Height)** | `{lh:.2f} mm` | `0.08 - 0.28 mm` | {'✅ Mịn đẹp sắc nét' if lh <= 0.20 else '⚡ Chế độ in nhanh'} |

| **Nhiệt Độ Đầu Đùn (Nozzle)** | `{noz_t:.0f}°C` | 195 - 235°C | {'✅ Ổn định nhiệt' if 195 <= noz_t <= 235 else '⚠️ Cần kiểm tra'} |

| **Nhiệt Bàn In & Độ Bám (Bed)** | `{bed_t:.0f}°C` | 55 - 75°C | {'✅ Bám dính an toàn' if bed_t >= 55 else '⚠️ Nguy cơ bong đáy'} |

| **Tốc Độ In Tổng Thể (Speed)** | `{spd:.0f} mm/s` | 50 - 300 mm/s | {'✅ Tốc độ tối ưu' if spd <= 300 else '⚠️ Tốc độ cao'} |

| **Nguy Cơ Cong Vênh (Warping)** | `{'RỦI RO CAO' if warping_hazard else 'AN TOÀN'}` | Thấp (Low) | {'❌ Cần thêm Brim' if warping_hazard else '✅ An toàn'} |



> [!summary] Nhận Định & Khuyến Nghị Tối Ưu Cho Xưởng In & Designer

{advice_text}



---



## 📐 2. Cấu Trúc Khối & Độ Bền Cơ Học (Slicer Layer Architecture)

- **Độ đặc ruột (Infill):** `{inf}%` (Kiểu cấu trúc: `{inf_type}`)

- **Độ dày thành vỏ (Wall Loops):** `{wl} vòng tường bao`

- **Khung chống đỡ (Support):** `{sup}` (Dáng cây: `{tree}`)

- **Vành bám đáy (Brim):** `{'Đã kích hoạt (Chống cong vênh)' if brim else 'Tắt (Cần chú ý vệ sinh bàn in)'}`



---



## ⚙️ 3. Thiết Lập Vận Hành Máy In & Đùn Nhựa (Hardware & Extrusion Control)

- **Tốc độ các phần:** In cơ bản `{spd:.0f} mm/s` • Vách ngoài `{spd_wall:.0f} mm/s` • Đổ ruột `{spd_inf:.0f} mm/s` • Chạy không tải `{spd_trav:.0f} mm/s`

- **Hệ thống tản nhiệt:** Quạt làm mát lớp in `{fan}%`

- **Rút nhựa chống tơ (Retraction):** Rút `{ret:.1f} mm` với tốc độ `{ret_spd:.0f} mm/s` • Nhấc đầu Z-Hop `{zh:.1f} mm`

- **Hệ số đùn nhựa (Flow Ratio):** `{flow:.2f}`



---



## 📜 4. Truy Vấn Obsidian Dataview Đồng Bộ

```dataview

TABLE material as "Vật liệu", layer_height_mm as "Độ dày lớp", nozzle_temp_c as "Nhiệt vòi", bed_temp_c as "Nhiệt bàn", status as "Trạng thái"

FROM "01_Profiles_In3D" OR #printsim/3d-profile

WHERE session_id = "{report.session_id}"

```



---

*Hồ sơ in 3D được tự động tổng hợp bởi 3D PrintSim Pro Telemetry Engine.*

"""



    def _render_markdown(self, report: AuditReport) -> str:

        from backend.src.infrastructure.minimalist_formatter import format_param_value



        material_tag = f"material/{report.material.lower()}"

        churn_tag = "churn/high-hesitation" if report.high_churn_parameters else "churn/normal"
        tags = ["printsim/audit", material_tag, churn_tag]
        tags_yaml = "\n".join(f"  - {tag}" for tag in tags)



        tab_icons = {

            "Cơ Bản": "🎯",

            "Vách & Vỏ": "🛡️",

            "Support": "🌲",

            "Tốc Độ": "⚡",

            "Nhiệt Độ": "🔥",

            "Đùn Nhựa": "💧",

        }



        table_rows = []

        for m in report.metrics:

            tab = getattr(m, "tab_name", "Cơ Bản") or "Cơ Bản"

            icon = tab_icons.get(tab, "⚙️")

            p_label = getattr(m, "label", "") or m.parameter_name

            formatted_init = format_param_value(m.parameter_name, m.initial_value)

            formatted_final = format_param_value(m.parameter_name, m.final_value)

            hist_formatted = " → ".join(format_param_value(m.parameter_name, v) for v in m.change_history) if m.change_history else formatted_final



            table_rows.append(

                f"| {icon} {tab} | `{m.parameter_name}` | {p_label} | {m.mutation_count} | **{m.churn_severity}** | `{formatted_init}` | `{formatted_final}` | {hist_formatted} |"

            )



        metrics_table = "\n".join(table_rows) if table_rows else "| - | *Không có thông số* | - | - | - | - | - | - |\n"



        ai_section = ""

        if report.ai_insight:

            ai_section = f"""

---



## 🤖 Nhận Định Chuyên Gia AI (Gemini Diagnostics)

{report.ai_insight}

"""



        return f"""---

session_id: {report.session_id}

created_at: {report.created_at.isoformat()}

total_events: {report.total_events}

total_parameters: {len(report.metrics)}

high_churn_count: {len(report.high_churn_parameters)}

material: {report.material}

tags:

  - {tags_yaml}

---



# 🩺 Báo Cáo Kiểm Định: [[Session_{report.session_id}]]



> **MOC:** [[000_PRINT_INDEX]] | **Hồ Sơ In 3D:** [[Profile_In3D_{report.session_id}|Profile 3D Hoàn Chỉnh]]  

> **Thư mục lưu:** `01_BaoCao_KiemDinh/`  

> **Tags:** #printsim/audit #corexy/telemetry #{material_tag} #{churn_tag}  

> **Thời gian tạo:** `{report.created_at.isoformat()}`  

> **Vật liệu in:** `{report.material}`  

> **Tổng số đột biến tham số:** `{report.total_events}`  

> **Tổng số tham số giám sát:** `{len(report.metrics)}`  

> **Tham số phân vân cao (>= 3 lần đổi):** `{', '.join(report.high_churn_parameters) if report.high_churn_parameters else 'Không phát hiện'}`



---



## 📋 Tóm Tắt Phân Tích

{report.summary}

{ai_section}

---



## 🔍 Truy Vấn Obsidian Dataview

```dataview

TABLE parameter_name, mutation_count, is_high_churn, initial_value, final_value

FROM #printsim/audit

WHERE session_id = "{report.session_id}"

SORT mutation_count DESC

```



---



## 📊 Bảng Tổng Hợp Chi Tiết Toàn Bộ 30 Tham Số Cắt Lớp (Unified Parameter Metrics)



| Nhóm / Tab | Tham số | Tên mô tả | Số lần đổi | Đánh giá | Ban đầu | Cuối cùng | Lịch sử biến đổi |

| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |

{metrics_table}

"""



    def _render_json(self, report: AuditReport) -> str:

        from backend.src.infrastructure.minimalist_formatter import format_param_value



        mutation_history: Dict[str, list] = {}

        metrics_data = []



        for m in report.metrics:

            mutation_history[m.parameter_name] = m.change_history

            metrics_data.append({

                "tab_name": getattr(m, "tab_name", "Cơ Bản"),

                "parameter_name": m.parameter_name,

                "label": getattr(m, "label", m.parameter_name),

                "unit": getattr(m, "unit", ""),

                "mutation_count": m.mutation_count,

                "is_high_churn": m.is_high_churn,

                "churn_severity": m.churn_severity,

                "initial_value": m.initial_value,

                "final_value": m.final_value,

                "formatted_initial": format_param_value(m.parameter_name, m.initial_value),

                "formatted_final": format_param_value(m.parameter_name, m.final_value),

                "change_history": m.change_history,

            })



        data = {

            "schema_version": "v2026.1",

            "session_id": report.session_id,

            "created_at": report.created_at.isoformat(),

            "material": report.material,

            "total_events": report.total_events,

            "summary": report.summary,

            "diagnostics": {

                "high_churn_parameters": report.high_churn_parameters,

                "hesitation_detected": len(report.high_churn_parameters) > 0,

                "total_monitored_parameters": len(report.metrics),

                "ai_insight": report.ai_insight,

            },

            "mutation_history": mutation_history,

            "metrics": metrics_data,

        }

        return json.dumps(data, indent=2, ensure_ascii=False)



    def _update_moc_index(self, latest_report: AuditReport) -> None:

        """Maintains the 000_PRINT_INDEX.md Map of Content linking all sessions for Obsidian Graph View."""

        moc_path = self._resolve_safe_path("000_PRINT_INDEX.md")



        # Scan all existing audit markdown files in 01_BaoCao_KiemDinh

        audit_folder = self._vault_root / "01_BaoCao_KiemDinh"

        audit_files = list(audit_folder.glob("Audit_*.md")) if audit_folder.exists() else []

        if not audit_files:

            audit_files = list(self._vault_root.glob("**/Audit_*.md"))

        existing_audits = sorted(

            [f.stem.replace("Audit_", "") for f in audit_files],

            reverse=True,

        )

        if latest_report.session_id not in existing_audits:

            existing_audits.insert(0, latest_report.session_id)



        session_table_rows = []

        for sid in existing_audits:

            audit_file = audit_folder / f"Audit_{sid}.md"

            created_str = "-"

            mat_str = "PLA"

            if audit_file.exists():

                try:

                    with open(audit_file, "r", encoding="utf-8") as f:

                        lines = [f.readline() for _ in range(12)]

                        for ln in lines:

                            if ln.startswith("created_at:"):

                                created_str = ln.replace("created_at:", "").strip()[:16].replace("T", " ")

                            elif ln.startswith("material:"):

                                mat_str = ln.replace("material:", "").strip()

                except Exception:

                    pass

            session_table_rows.append(

                f"| `{sid}` | [[Profile_In3D_{sid}|📦 Profile In 3D {sid}]] | [[Audit_{sid}|Báo Cáo Phiên {sid}]] | `{created_str}` | `{mat_str}` | `01_Profiles_In3D/` | `01_BaoCao_KiemDinh/` |"

            )

        session_table = "\n".join(session_table_rows)



        moc_content = f"""---

type: moc

tags:

  - printsim/index

  - corexy/vault

---



# 🌐 3D PrintSim Pro — Map of Content (MOC) & Graph Navigator



> **Obsidian Graph View Hub**: Tệp này liên kết toàn bộ hồ sơ in 3D, báo cáo kiểm định và nhật ký in để trực quan hóa sơ đồ mạng nhện.



---



## 📦 1. Bảng Tổng Hợp Hồ Sơ In 3D & Kiểm Định (3D Profiles Matrix)



| Phiên in | Hồ sơ in 3D (Executive) | Báo cáo kiểm định | Thời gian tạo | Vật liệu | Thư mục Profile | Thư mục Báo Cáo |

| :---: | :--- | :--- | :---: | :---: | :--- | :--- |

{session_table}



---



## 🔍 2. Truy Vấn Obsidian Dataview Toàn Bộ Phiên In

```dataview

TABLE created_at as "Thời gian", material as "Vật liệu", total_events as "Sự kiện", high_churn_count as "Độ phân vân"

FROM "01_BaoCao_KiemDinh" OR #printsim/audit

SORT file.mtime DESC

```



---



## 📋 3. Nhật Ký In Khóa Chuẩn (02_NhatKy_In)

- [[nhat_ky_in|Nhật Ký In Tổng Hợp]] (`02_NhatKy_In/nhat_ky_in.md`)



---

*Tự động đồng bộ bởi 3D PrintSim Telemetry Engine.*

"""

        self._atomic_write(moc_path, moc_content)



    def _update_minimalist_logs(self, report: AuditReport) -> None:

        """Updates nhat_ky_in.json and nhat_ky_in.md conforming strictly to the user's locked schemas."""

        json_log_path = self._resolve_safe_path("nhat_ky_in.json")

        md_log_path = self._resolve_safe_path("02_NhatKy_In/nhat_ky_in.md")



        from backend.src.infrastructure.minimalist_formatter import (

            build_parameter_session_matrix,

            build_session_entry,

            render_markdown_log,

        )



        entries = []

        if json_log_path.exists():

            try:

                with open(json_log_path, "r", encoding="utf-8") as f:

                    data = json.load(f)

                    if isinstance(data, list):

                        entries = data

                    elif isinstance(data, dict):

                        entries = data.get("chi_tiet_tung_phien", [])

            except Exception:

                entries = []



        phien_num = len(entries) + 1

        thu_lai = f"{len(entries):02d}" if len(entries) >= 1 else None



        has_warping_risk = any(

            (m.parameter_name == "brimEnabled" and not m.final_value)

            or (m.parameter_name == "bedTemp" and (m.final_value or 0) < 60)

            for m in report.metrics

        )

        has_heatcreep_risk = any(

            (m.parameter_name == "bedTemp" and (m.final_value or 0) >= 80)

            or (m.parameter_name == "printSpeed" and (m.final_value or 0) > 300)

            for m in report.metrics

        )

        loi_desc = (

            "Va chạm đầu in tại lớp 35 (Warping do thiếu vành bám)"

            if has_warping_risk

            else "Nghẹt nhựa đầu phun tại lớp 120 (Trào ngược nhiệt buồng in)"

            if has_heatcreep_risk

            else "Không phát hiện lỗi nghiêm trọng (In hoàn tất)"

        )



        new_entry = build_session_entry(

            phien_index=phien_num,

            metrics=report.metrics,

            nguoi_dung="Kỹ sư vận hành",

            thoi_gian_str=f"{report.created_at.strftime('%Y-%m-%d %H:%M')} (7 phút)",

            hanh_dong="Mô phỏng (50x) -> Bắt đầu in" if phien_num == 1 else "Mô phỏng lại -> Bắt đầu in",

            loi=loi_desc,

            thu_lai_tu_phien=thu_lai,

        )



        entries.append(new_entry)



        # 1. Write nhat_ky_in.json (Consolidated Matrix JSON)

        session_cols, json_matrix_rows, _ = build_parameter_session_matrix(entries)

        matrix_payload = {

            "schema_version": "v2026.1",

            "kieu_trinh_bay": "bang_hop_nhat_phan_lop",

            "tong_so_phien": len(entries),

            "danh_sach_phien": session_cols,

            "bang_tong_hop": json_matrix_rows,

            "ma_tran_tham_so": json_matrix_rows,

            "chi_tiet_tung_phien": entries,

        }

        self._atomic_write(json_log_path, json.dumps(matrix_payload, indent=2, ensure_ascii=False))



        # 2. Write nhat_ky_in.md (Single Matrix Table Layout)

        md_log = render_markdown_log(entries)

        self._atomic_write(md_log_path, md_log)