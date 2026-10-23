"""
Pydantic v2 Schemas for Telemetry & Audit Presentation Layer.
Strict validation and model_dump/model_validate usage.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TelemetryEventRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    session_id: str = Field(..., min_length=1, description="Unique simulation session ID")
    event_type: str = Field(default="PARAMETER_CHANGE", min_length=1, description="Event classification")
    parameter_name: str = Field(..., min_length=1, description="Name of modified slicer parameter")
    old_value: Any = Field(default=None, description="Previous parameter value")
    new_value: Any = Field(default=None, description="New parameter value")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Contextual telemetry payload")


class TelemetryEventResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event_id: str
    session_id: str
    recorded_at: str


class AuditGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profile: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Full snapshot of the current 3D simulator profile covering all 5 tabs and extrusion",
    )


class AuditGenerateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    session_id: str
    markdown_path: str
    json_path: str
    high_churn_parameters: List[str]
    total_events: int
    created_at: str


class SaveSessionLogRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    session: Dict[str, Any] = Field(..., description="Single session log entry conforming to nhat_ky_in.json contract")
    append_mode: bool = Field(default=True, description="Append to existing sessions if true, otherwise replace")


class ProblemDetails(BaseModel):
    """RFC 9457 Problem Details schema."""
    model_config = ConfigDict(extra="allow")

    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: Optional[str] = None


class PhysicsIssueSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str
    severity: str
    category: str
    title: str
    description: str
    suggested_action: str
    conflicting_parameters: List[str]
    risk_penalty: int


class PhysicsSanityCheckRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profile: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Full slicer profile dictionary containing material, temperatures, speeds, etc.",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Optional session ID to reconstruct and inspect profile snapshot",
    )


class PhysicsSanityCheckResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    qc_risk_score: int
    qc_health_score: int
    status: str
    status_label: str
    material: str
    max_volumetric_flow_rate: float
    estimated_volumetric_flow_rate: float
    flow_headroom_percent: float
    issues: List[PhysicsIssueSchema]
    passed_checks: List[str]
    summary: str


# =====================================================================
# Profile In 3D & Slicer Exporter & Session Benchmarking Schemas
# =====================================================================

class Profile3DSummarySchema(BaseModel):
    """Tóm tắt thông số trọng tâm của Hồ Sơ In 3D cho giao diện Live Report."""
    model_config = ConfigDict(extra="ignore")

    profile_id: str = Field(..., description="Mã hồ sơ in 3D (ví dụ PROFILE_01)")
    model_name: str = Field("Mô hình 3D CoreXY", description="Tên mô hình in")
    material: str = Field("PLA", description="Vật liệu sợi nhựa in")
    status: str = Field("COMPLETED", description="Trạng thái hoàn thành phiên in")
    printability_score: int = Field(95, description="Điểm đánh giá chất lượng in ấn (0-100)")
    layer_height_mm: float = Field(0.20, description="Độ cao lớp in (mm)")
    infill_percent: int = Field(20, description="Mật độ ruột in (%)")
    bed_temp_c: int = Field(60, description="Nhiệt độ bàn in (°C)")
    nozzle_temp_c: int = Field(210, description="Nhiệt độ đầu đùn (°C)")
    speed_mms: float = Field(60.0, description="Tốc độ in mặc định (mm/s)")
    markdown_path: str = Field(..., description="Đường dẫn file markdown trong Obsidian Vault")


class Profile3DResponse(BaseModel):
    """Phản hồi chi tiết của Hồ Sơ In 3D tổng hợp."""
    model_config = ConfigDict(extra="ignore")

    status: str = Field("success", description="Trạng thái phản hồi")
    session_id: str = Field(..., description="Mã phiên in")
    profile_path: str = Field(..., description="Đường dẫn tương đối tới file Profile In 3D trong Obsidian")
    markdown: str = Field(..., description="Nội dung Markdown hoàn chỉnh của Profile In 3D")


class SlicerExportResponse(BaseModel):
    """Phản hồi JSON khi xuất cấu hình Slicer (download=False)."""
    model_config = ConfigDict(extra="ignore")

    status: str = Field("success", description="Trạng thái xuất cấu hình")
    session_id: str = Field(..., description="Mã phiên in được trích xuất")
    format: str = Field(..., description="Định dạng slicer (orcaslicer, bambulab, prusaslicer)")
    filename: str = Field(..., description="Tên file preset được sinh ra")
    content: str = Field(..., description="Nội dung file cấu hình (JSON hoặc INI)")
    saved_preset_path: str = Field(..., description="Đường dẫn file preset đã lưu tự động trong Obsidian Vault")


class ParameterDiffSchema(BaseModel):
    """Chi tiết so sánh từng thông số kỹ thuật giữa 2 phiên in."""
    model_config = ConfigDict(extra="ignore")

    category: str = Field(..., description="Nhóm thông số (Cấu trúc lớp, Tốc độ, Nhiệt độ, Độ co ngót, v.v.)")
    name: str = Field(..., description="Tên thông số kỹ thuật trực quan")
    base_val: str = Field(..., description="Giá trị ở phiên in gốc (Base)")
    target_val: str = Field(..., description="Giá trị ở phiên in mục tiêu (Target)")
    delta_str: str = Field(..., description="Độ lệch định dạng trực quan (+ / -)")
    status: str = Field(..., description="Trạng thái đánh giá: IMPROVED (Cải thiện), CHANGED (Thay đổi), UNCHANGED (Giữ nguyên)")
    impact: str = Field(..., description="Phân tích tác động vật lý và khuyến nghị vận hành")


class SessionComparisonResponse(BaseModel):
    """Phản hồi so sánh toàn diện 2 phiên in (Session Diff & Benchmark Engine)."""
    model_config = ConfigDict(extra="ignore")

    status: str = Field("success", description="Trạng thái phân tích")
    comparison_id: str = Field(..., description="Mã định danh đối chiếu (ví dụ: COMPARE_01_VS_03)")
    base_session_id: str = Field(..., description="Mã phiên in gốc (Base)")
    target_session_id: str = Field(..., description="Mã phiên in mục tiêu (Target)")
    score_delta: int = Field(..., description="Chênh lệch điểm chất lượng QC (+ / -)")
    time_delta_minutes: int = Field(..., description="Chênh lệch thời gian in ấn ước tính (phút)")
    filament_delta_grams: float = Field(..., description="Chênh lệch khối lượng tiêu hao nhựa (gram)")
    verdict_badge: str = Field(..., description="Huy hiệu tổng kết đánh giá đối chiếu")
    verdict_summary: str = Field(..., description="Tóm tắt phân tích đối chiếu chuyên sâu")
    parameter_diffs: List[ParameterDiffSchema] = Field(default_factory=list, description="Danh sách so sánh chi tiết từng thông số")
    markdown_filename: str = Field(..., description="Tên file Markdown báo cáo so sánh")
    markdown_path: str = Field(..., description="Đường dẫn lưu file trong Obsidian Vault")
    markdown: str = Field(..., description="Nội dung Markdown hoàn chỉnh của báo cáo so sánh")


class ThumbnailUploadRequest(BaseModel):
    """Yêu cầu tải lên ảnh thumbnail 3D của phiên in."""
    model_config = ConfigDict(extra="ignore")

    image_base64: Optional[str] = Field(default=None, description="Chuỗi base64 của ảnh render 3D (data:image/png;base64,... hoặc raw)")
    thumbnail: Optional[str] = Field(default=None, description="Bí danh trường tương đương với image_base64")


class ThumbnailUploadResponse(BaseModel):
    """Phản hồi sau khi lưu thumbnail render 3D thành công vào Obsidian Vault."""
    model_config = ConfigDict(extra="ignore")

    status: str = Field("success", description="Trạng thái lưu ảnh")
    message: str = Field(..., description="Thông báo kết quả")
    session_id: str = Field(..., description="Mã phiên in")
    thumbnail_path: str = Field(..., description="Đường dẫn tương đối lưu thumbnail trong Obsidian")
    bytes_written: int = Field(..., description="Kích thước dữ liệu ảnh ghi vào đĩa (bytes)")


# ==============================================================================
# ⚡ SUPABASE CLOUD HUB SCHEMAS
# ==============================================================================

class SupabaseConfigRequest(BaseModel):
    """Yêu cầu lưu cấu hình kết nối Supabase Cloud Hub."""
    model_config = ConfigDict(extra="ignore")

    url: str = Field(..., description="Supabase Project URL (e.g. https://xxx.supabase.co)")
    key: str = Field(..., description="Supabase API Key (Anon hoặc Service Role Key)")
    auto_sync: bool = Field(default=False, description="Tự động đồng bộ khi ghi session mới")


class SupabaseTestRequest(BaseModel):
    """Yêu cầu kiểm tra kết nối tới Supabase."""
    model_config = ConfigDict(extra="ignore")

    url: Optional[str] = Field(default=None, description="URL kiểm thử (nếu để trống dùng cấu hình hiện tại)")
    key: Optional[str] = Field(default=None, description="Key kiểm thử (nếu để trống dùng cấu hình hiện tại)")


class SupabaseTestResponse(BaseModel):
    """Phản hồi kiểm tra kết nối Supabase."""
    model_config = ConfigDict(extra="ignore")

    connected: bool = Field(..., description="Trạng thái kết nối thành công hay thất bại")
    message: str = Field(..., description="Thông báo chi tiết kết quả kiểm tra")
    url: Optional[str] = Field(default=None, description="URL máy chủ đã kiểm tra")
    status_code: Optional[int] = Field(default=None, description="HTTP status code từ Supabase")


class SupabaseSyncResponse(BaseModel):
    """Phản hồi sau khi đồng bộ dữ liệu lên Supabase Cloud Hub."""
    model_config = ConfigDict(extra="ignore")

    success: bool = Field(..., description="Trạng thái đồng bộ toàn phần")
    sessions_synced: int = Field(default=0, description="Số lượng phiên in đã đồng bộ")
    profiles_synced: int = Field(default=0, description="Số lượng hồ sơ 3D đã đồng bộ")
    duration_ms: int = Field(default=0, description="Thời gian thực thi (mili-giây)")
    timestamp: str = Field(..., description="Thời điểm hoàn tất đồng bộ")
    message: str = Field(..., description="Thông điệp kết quả")
    errors: List[str] = Field(default_factory=list, description="Danh sách lỗi chi tiết nếu có")


class SupabaseHubStatusResponse(BaseModel):
    """Trạng thái tổng thể của Supabase Cloud Hub."""
    model_config = ConfigDict(extra="ignore")

    configured: bool = Field(..., description="Đã có cấu hình URL và API Key hay chưa")
    url: str = Field(default="", description="Supabase Project URL hiện hành")
    masked_key: str = Field(default="", description="API Key đã được che giấu bảo mật")
    auto_sync: bool = Field(default=False, description="Cờ kích hoạt tự động đồng bộ")
    last_synced_at: Optional[str] = Field(default=None, description="Thời điểm đồng bộ gần nhất")
    last_sync_result: Optional[Dict[str, Any]] = Field(default=None, description="Chi tiết kết quả lần đồng bộ gần nhất")
    local_sessions_count: int = Field(default=0, description="Tổng số phiên in sẵn sàng ở máy cục bộ")
    local_profiles_count: int = Field(default=0, description="Tổng số hồ sơ 3D sẵn sàng ở máy cục bộ")

# ==============================================================================
# 🔮 ADVANCED AI DEFECTS, AUTO-TUNING & PRINTER PROFILES SCHEMAS
# ==============================================================================

class DefectPredictionRequest(BaseModel):
    """Yêu cầu dự đoán nguy cơ khuyết tật in FDM."""
    model_config = ConfigDict(extra="ignore")

    profile: Dict[str, Any] = Field(..., description="Snapshot thông số slicer hiện tại")
    printer_id: Optional[str] = Field(default=None, description="ID máy in mục tiêu (e.g. bambu_x1c, prusa_mk4, voron_2_4)")


class AutoTuneRequest(BaseModel):
    """Yêu cầu tự động điều chỉnh và tối ưu hóa thông số in."""
    model_config = ConfigDict(extra="ignore")

    profile: Dict[str, Any] = Field(..., description="Snapshot thông số slicer cần tối ưu")
    printer_id: Optional[str] = Field(default=None, description="ID máy in mục tiêu để lấy giới hạn phần cứng")


class QCCertificateRequest(BaseModel):
    """Yêu cầu tạo chứng chỉ nghiệm thu kỹ thuật QC Certificate."""
    model_config = ConfigDict(extra="ignore")

    profile: Dict[str, Any] = Field(..., description="Thông số slicer của phiên in")
    audit_data: Optional[Dict[str, Any]] = Field(default=None, description="Kết quả audit/QC điểm số nếu có")
    printer_id: Optional[str] = Field(default=None, description="ID máy in thực thi")


# ==============================================================================
# 📦 NATIVE 3MF PROJECT PACKAGING & 📊 QC ANALYTICS SCHEMAS
# ==============================================================================

class Project3MFExportRequest(BaseModel):
    """Yêu cầu tạo và đóng gói tệp dự án .3mf hoàn chỉnh."""
    model_config = ConfigDict(extra="ignore")

    model_name: str = Field(default="PrintSim_Model", description="Tên mô hình 3D")
    profile: Dict[str, Any] = Field(default_factory=dict, description="Bộ thông số in (slicer / hardware)")
    vertices: Optional[List[Dict[str, float]]] = Field(default=None, description="Danh sách toạ độ đỉnh 3D (x, y, z)")
    triangles: Optional[List[Dict[str, int]]] = Field(default=None, description="Danh sách chỉ số tam giác (v1, v2, v3)")
    thumbnail_base64: Optional[str] = Field(default=None, description="Ảnh xem trước thumbnail định dạng base64")
    sd_card_mode: bool = Field(default=False, description="Xuất định dạng .gcode.3mf nạp thẻ nhớ SD in trực tiếp trên máy in Bambu/Klipper")
    gcode_content: Optional[str] = Field(default=None, description="Mã G-Code tuỳ chọn nhúng vào thẻ nhớ")


class AnalyticsOverviewResponse(BaseModel):
    """Báo cáo KPI tổng quan chất lượng QC và thống kê vật liệu."""
    model_config = ConfigDict(extra="ignore")

    total_sessions: int = Field(..., description="Tổng số phiên in")
    completed_count: int = Field(..., description="Số phiên hoàn tất thành công")
    failed_count: int = Field(..., description="Số phiên in thất bại")
    warping_count: int = Field(..., description="Số phiên in bị lỗi warping")
    success_rate_percent: float = Field(..., description="Tỷ lệ in thành công (%)")
    avg_duration_minutes: float = Field(..., description="Thời lượng in trung bình mỗi phiên")
    avg_qc_score: float = Field(..., description="Điểm số chất lượng trung bình")
    materials_matrix: Dict[str, Any] = Field(default_factory=dict, description="Thống kê theo từng loại vật liệu")
    defect_pareto: List[Dict[str, Any]] = Field(default_factory=list, description="Bảng phân tích Pareto nguyên nhân lỗi")
    recent_timeline: List[Dict[str, Any]] = Field(default_factory=list, description="Lịch sử các phiên in gần nhất")
    operator_leaderboard: Dict[str, int] = Field(default_factory=dict, description="Bảng xếp hạng kỹ sư in")


class AnalyticsTrendsResponse(BaseModel):
    """Chuỗi dữ liệu thời gian phục vụ vẽ biểu đồ xu hướng."""
    model_config = ConfigDict(extra="ignore")

    total_points: int = Field(..., description="Tổng số điểm dữ liệu")
    trend_series: List[Dict[str, Any]] = Field(default_factory=list, description="Chuỗi thông số lịch sử")
    hesitation_churn_leaderboard: List[Dict[str, Any]] = Field(default_factory=list, description="Top các thông số bị phân vân thay đổi nhiều nhất")


# ==============================================================================
# 📊 STATISTICAL PROCESS CONTROL (SPC) & BATCH QC SCHEMAS
# ==============================================================================

class BatchQCAuditRequest(BaseModel):
    """Yêu cầu thẩm định chất lượng hàng loạt (Batch QC)."""
    model_config = ConfigDict(extra="ignore")

    sessions: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Danh sách các phiên in cần kiểm tra. Nếu để trống, hệ thống sẽ tự nạp toàn bộ từ nhat_ky_in.json"
    )
    printer_id: Optional[str] = Field(default=None, description="ID máy in để đối soát trần công suất phần cứng")


class BatchQCAuditResponse(BaseModel):
    """Báo cáo kết quả kiểm định hàng loạt và năng lực quy trình SPC."""
    model_config = ConfigDict(extra="ignore")

    total_audited_sessions: int
    passed_sessions: int
    failed_sessions: int
    yield_rate_percent: float
    average_qc_score: float
    process_capability_summary: Dict[str, Any]
    control_charts: Dict[str, Any]
    detected_anomalies: List[Any]
    executive_recommendations: List[str]


class SPCControlChartResponse(BaseModel):
    """Dữ liệu chuỗi thời gian biểu đồ kiểm soát Shewhart (UCL, CL, LCL)."""
    model_config = ConfigDict(extra="ignore")

    metric: str
    limits: Dict[str, Any]
    data_points: List[Dict[str, Any]]


class AnomalyDetectionResponse(BaseModel):
    """Danh sách các ca in dị thường (Outliers)."""
    model_config = ConfigDict(extra="ignore")

    total_anomalies: int
    anomalies: List[Any]
