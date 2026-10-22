"""
3D PrintSim Pro - Production Excel (.xlsx) & CSV Exporter Engine.
Generates executive audit workbooks with professional styling, multi-sheet layouts,
and locked 23-parameter consolidated matrices.
"""
import io
import csv
from typing import List, Dict, Any, Tuple
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from backend.src.infrastructure.formatters import build_parameter_session_matrix


def generate_csv_report(sessions: List[Dict[str, Any]]) -> str:
    """
    Generates a UTF-8-SIG encoded CSV report containing both session summaries
    and the complete 23-parameter consolidated matrix.
    """
    session_cols, matrix_rows, _ = build_parameter_session_matrix(sessions)
    output = io.StringIO()
    # Write UTF-8 BOM so Excel on Windows recognizes Vietnamese accents immediately
    output.write("\ufeff")
    writer = csv.writer(output, lineterminator="\n")

    # 1. Title
    writer.writerow(["=== 3D PRINTSIM PRO - BÁO CÁO TỔNG HỢP PHIÊN IN & THAM SỐ QC ==="])
    writer.writerow([f"Tổng số phiên in: {len(sessions)}", "Phiên bản schema: v2026.1", "Khóa chuẩn 23 tham số"])
    writer.writerow([])

    # 2. Overview Table
    writer.writerow(["--- 1. DANH SÁCH & TRẠNG THÁI PHIÊN IN ---"])
    writer.writerow(["Mã Phiên", "Thời Gian", "Người Vận Hành", "Mô Hình", "Vật Liệu", "Trạng Thái", "Điểm QC", "Ghi Chú"])
    for s in sessions:
        sid = str(s.get("sessionId", "-"))
        time_str = str(s.get("startedAt", "-"))
        op = str(s.get("operator", "Kỹ sư in 3D"))
        model = str(s.get("modelName", "Benchy"))
        mat = str(s.get("material") or s.get("slicer", {}).get("material") or "PLA")
        status_val = str(s.get("status", "COMPLETED"))
        score = str(s.get("score", 100))
        note = str(s.get("failureDetail") or s.get("notes") or "")
        writer.writerow([f"Phiên #{sid}", time_str, op, model, mat, status_val, score, note])

    writer.writerow([])

    # 3. Parameter Matrix
    writer.writerow(["--- 2. MA TRẬN 23 THAM SỐ IN 3D (LOCKED SCHEMA) ---"])
    header_row = ["Nhóm Tham Số", "STT", "Mã Tham Số", "Tên Tham Số", "Đơn Vị"] + [f"Phiên #{c}" for c in session_cols]
    writer.writerow(header_row)

    for row in matrix_rows:
        cac_phien = row.get("cac_phien", {})
        data_row = [
            row.get("nhom", ""),
            row.get("stt", ""),
            row.get("ma_ts", ""),
            row.get("ten_tham_so", ""),
            row.get("don_vi", ""),
        ] + [cac_phien.get(c, "-") for c in session_cols]
        writer.writerow(data_row)

    return output.getvalue()


def generate_excel_report(sessions: List[Dict[str, Any]]) -> bytes:
    """
    Generates a beautifully styled, enterprise-ready Excel (.xlsx) workbook with:
    - Sheet 1: Ma Trận 23 Tham Số (Executive Matrix)
    - Sheet 2: Danh Sách Phiên In & QC (Session Overview)
    """
    session_cols, matrix_rows, _ = build_parameter_session_matrix(sessions)
    wb = Workbook()

    # Define color palette & styles
    font_title = Font(name="Segoe UI", size=14, bold=True, color="1E293B")
    font_subtitle = Font(name="Segoe UI", size=10, italic=True, color="64748B")
    font_header = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    font_bold = Font(name="Segoe UI", size=10, bold=True, color="0F172A")
    font_regular = Font(name="Segoe UI", size=9, color="334155")
    font_code = Font(name="Consolas", size=9, color="475569")

    fill_header_main = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    fill_header_accent = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    fill_group_banner = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    fill_zebra = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    fill_success = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    font_success = Font(name="Segoe UI", size=9, bold=True, color="166534")

    fill_warning = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    font_warning = Font(name="Segoe UI", size=9, bold=True, color="92400E")

    fill_error = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    font_error = Font(name="Segoe UI", size=9, bold=True, color="991B1B")

    thin_border_side = Side(border_style="thin", color="E2E8F0")
    thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    thick_bottom_side = Side(border_style="medium", color="CBD5E1")
    header_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thick_bottom_side)

    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")

    # =========================================================================
    # SHEET 1: MA TRẬN 23 THAM SỐ
    # =========================================================================
    ws1 = wb.active
    ws1.title = "Ma Trận 23 Tham Số"
    ws1.views.sheetView[0].showGridLines = True

    # Title block
    ws1["A1"] = "3D PRINTSIM PRO — MA TRẬN 23 THAM SỐ IN 3D KHÓA CHUẨN"
    ws1["A1"].font = font_title
    ws1["A2"] = f"Chuẩn Schema: v2026.1 | Tổng số phiên in: {len(sessions)} | Xuất tự động từ Obsidian & Telemetry Database"
    ws1["A2"].font = font_subtitle
    ws1.row_dimensions[1].height = 25
    ws1.row_dimensions[2].height = 18

    # Table Header (Row 4)
    start_row = 4
    ws1.row_dimensions[start_row].height = 26
    headers_s1 = ["Nhóm", "STT", "Tên Tham Số Kỹ Thuật", "Mã Tham Số", "Đơn Vị"] + [f"Phiên #{c}" for c in session_cols]

    for col_idx, h in enumerate(headers_s1, start=1):
        cell = ws1.cell(row=start_row, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_header_accent if col_idx > 5 else fill_header_main
        cell.alignment = align_center
        cell.border = header_border

    # Data Rows
    current_group = ""
    curr_r = start_row + 1

    for row_data in matrix_rows:
        nhom = row_data.get("nhom", "")
        # Group separator if group changed
        if nhom != current_group:
            current_group = nhom
            ws1.row_dimensions[curr_r].height = 20
            group_cell = ws1.cell(row=curr_r, column=1, value=f"▶ {current_group}")
            group_cell.font = font_bold
            group_cell.fill = fill_group_banner
            group_cell.alignment = align_left
            for c_idx in range(1, len(headers_s1) + 1):
                ws1.cell(row=curr_r, column=c_idx).fill = fill_group_banner
                ws1.cell(row=curr_r, column=c_idx).border = thin_border
            curr_r += 1

        ws1.row_dimensions[curr_r].height = 20
        cac_phien = row_data.get("cac_phien", {})
        is_zebra = (curr_r % 2 == 0)

        # Values
        vals = [
            row_data.get("nhom", ""),
            row_data.get("stt", ""),
            row_data.get("ten_tham_so", ""),
            row_data.get("ma_ts", ""),
            row_data.get("don_vi", ""),
        ] + [cac_phien.get(c, "-") for c in session_cols]

        for col_idx, val in enumerate(vals, start=1):
            cell = ws1.cell(row=curr_r, column=col_idx, value=val)
            cell.font = font_code if col_idx == 4 else (font_regular if col_idx != 3 else font_bold)
            cell.border = thin_border
            if is_zebra:
                cell.fill = fill_zebra

            if col_idx in (2, 5) or col_idx > 5:
                cell.alignment = align_center
            else:
                cell.alignment = align_left
        curr_r += 1

    # Auto-adjust column widths
    for col in ws1.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws1.column_dimensions[col_letter].width = max(max_len + 4, 12)
    ws1.column_dimensions["A"].width = 24
    ws1.column_dimensions["C"].width = 32
    ws1.column_dimensions["D"].width = 22

    # =========================================================================
    # SHEET 2: DANH SÁCH PHIÊN IN & QC
    # =========================================================================
    ws2 = wb.create_sheet(title="Tổng Hợp Phiên & QC")
    ws2.views.sheetView[0].showGridLines = True

    ws2["A1"] = "3D PRINTSIM PRO — BẢNG THEO DÕI ĐIỂM QC & TRẠNG THÁI IN"
    ws2["A1"].font = font_title
    ws2["A2"] = f"Hệ thống kiểm soát chất lượng & ghi nhận lỗi | Xuất vào: {sessions[-1].get('startedAt', 'N/A') if sessions else 'N/A'}"
    ws2["A2"].font = font_subtitle
    ws2.row_dimensions[1].height = 25
    ws2.row_dimensions[2].height = 18

    start_row_s2 = 4
    ws2.row_dimensions[start_row_s2].height = 26
    headers_s2 = [
        "Mã Phiên",
        "Thời Gian",
        "Người Thực Hiện",
        "Mô Hình",
        "Vật Liệu",
        "Độ Dày Lớp",
        "Mật Độ Infill",
        "Tốc Độ F",
        "Nhiệt Đầu/Bàn",
        "Trạng Thái",
        "Điểm QC",
        "Ghi Chú Lỗi & Can Thiệp",
    ]

    for col_idx, h in enumerate(headers_s2, start=1):
        cell = ws2.cell(row=start_row_s2, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_header_main
        cell.alignment = align_center
        cell.border = header_border

    curr_r2 = start_row_s2 + 1
    for s in sessions:
        ws2.row_dimensions[curr_r2].height = 22
        sid = str(s.get("sessionId", "-"))
        time_str = str(s.get("startedAt", "-"))
        op = str(s.get("operator", "Kỹ sư in 3D"))
        model = str(s.get("modelName", "Benchy"))
        mat = str(s.get("material") or s.get("slicer", {}).get("material") or "PLA")
        slicer = s.get("slicer", {})
        hw = s.get("hardware", {})
        lh = f"{slicer.get('layerHeightMm', 0.2)} mm"
        inf = f"{slicer.get('infillPercent', 20)}%"
        speed = f"{hw.get('speedF', {}).get('defaultMmS', 60)} mm/s"
        temps = f"{hw.get('temperatureC', {}).get('nozzleFanPercent', '210°C')} / {hw.get('temperatureC', {}).get('bed', 60)}°C"
        status_val = str(s.get("status", "COMPLETED")).upper()
        score = float(s.get("score", 100))
        note = str(s.get("failureDetail") or s.get("notes") or "In hoàn tất không lỗi")

        row_vals = [
            f"Phiên #{sid}",
            time_str,
            op,
            model,
            mat,
            lh,
            inf,
            speed,
            temps,
            status_val,
            score,
            note,
        ]

        is_zebra2 = (curr_r2 % 2 == 0)
        for c_idx, val in enumerate(row_vals, start=1):
            cell = ws2.cell(row=curr_r2, column=c_idx, value=val)
            cell.font = font_bold if c_idx in (1, 10, 11) else font_regular
            cell.border = thin_border
            if is_zebra2:
                cell.fill = fill_zebra

            if c_idx in (1, 2, 5, 6, 7, 8, 9, 10, 11):
                cell.alignment = align_center
            else:
                cell.alignment = align_left

            # Highlight status column
            if c_idx == 10:
                if "COMPLETED" in status_val or "OK" in status_val:
                    cell.fill = fill_success
                    cell.font = font_success
                elif "WARP" in status_val:
                    cell.fill = fill_warning
                    cell.font = font_warning
                else:
                    cell.fill = fill_error
                    cell.font = font_error

        curr_r2 += 1

    # Auto-adjust column widths for Sheet 2
    for col in ws2.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws2.column_dimensions[col_letter].width = max(max_len + 4, 14)
    ws2.column_dimensions["B"].width = 20
    ws2.column_dimensions["L"].width = 45

    # Export to binary stream
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.getvalue()
