"""
Google Gemini AI Service Adapter.
Implements AIServiceProtocol to provide deep engineering reasoning on hesitation churn.
Gracefully falls back to domain-expert heuristic rules if no API key is provided.
"""
import logging
from typing import Any, List, Optional
import httpx

from backend.src.domain.protocols import AIServiceProtocol
from backend.src.infrastructure.config import settings

logger = logging.getLogger("gemini.ai.service")


class GeminiAIService(AIServiceProtocol):
    """Integrates Google Gemini API with fallback for 3D slicing hesitation analysis."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        self._api_key = api_key or settings.gemini_api_key
        self._model = model or settings.gemini_model

    def generate_insight(
        self,
        session_id: str,
        high_churn_params: List[str],
        metrics: List[Any],
        material: str = "PLA",
    ) -> Optional[str]:
        if not high_churn_params:
            return "✅ Không phát hiện sự phân vân bất thường. Quy trình cấu hình đạt trạng thái ổn định và dứt khoát."

        # Attempt to call Gemini API if key is available
        if self._api_key:
            try:
                insight = self._call_gemini_api(session_id, high_churn_params, metrics, material)
                if insight:
                    return insight
            except Exception as e:
                logger.warning(f"Lỗi gọi Gemini API: {e}, chuyển sang chuyên gia suy luận fallback.")

        # Expert Heuristic Rule Fallback
        return self._generate_expert_heuristic_insight(high_churn_params, metrics, material)

    def _call_gemini_api(
        self,
        session_id: str,
        high_churn_params: List[str],
        metrics: List[Any],
        material: str,
    ) -> Optional[str]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent?key={self._api_key}"
        
        prompt = (
            f"Bạn là chuyên gia cấp cao về công nghệ in 3D FDM CoreXY (Bambu Lab / Voron / Prusa).\n"
            f"Phiên in: {session_id}, Vật liệu: {material}.\n"
            f"Người dùng đang do dự và thay đổi liên tục (>= 3 lần) các thông số: {', '.join(high_churn_params)}.\n"
            f"Chi tiết biến đổi:\n"
        )
        for m in metrics:
            if getattr(m, "is_high_churn", False):
                prompt += f"- {m.parameter_name}: {m.change_history} (Ban đầu: {m.initial_value} -> Cuối: {m.final_value})\n"
        prompt += (
            "\nHãy phân tích lý do người dùng phân vân, rủi ro tiềm ẩn (sập overhang, cong vênh warping, stringing) "
            "và đưa ra khuyến nghị giá trị thông số chuẩn nhất trong 2-3 câu ngắn gọn, súc tích."
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 300},
        }

        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
        return None

    def _generate_expert_heuristic_insight(
        self, high_churn_params: List[str], metrics: List[Any], material: str
    ) -> str:
        recommendations = []
        for param in high_churn_params:
            if "infill" in param.lower():
                recommendations.append(
                    f"• **{param}**: Tần suất thay đổi cao phản ánh sự lưỡng lự giữa độ cứng cơ học và thời gian in. "
                    f"Đối với vật liệu {material}, mức tối ưu khuyến nghị là Gyroid 15% - 20% giúp chịu lực đẳng hướng mà không tốn nhựa."
                )
            elif "support" in param.lower():
                recommendations.append(
                    f"• **{param}**: Người dùng băn khoăn về góc đỡ overhang. Khuyến nghị thiết lập Tree Support góc nghiêng 45° "
                    f"với Top Z-distance 0.20mm để dễ bóc tách mà không để lại vết sẹo bề mặt."
                )
            elif "temp" in param.lower() or "bed" in param.lower() or "nozzle" in param.lower():
                recommendations.append(
                    f"• **{param}**: Biến động nhiệt độ liên tục. Đối với {material}, hãy cố định Nozzle ở 215°C (PLA) / 240°C (PETG) "
                    f"và Textured PEI Bed ở 55°C - 60°C để chống tách lớp (Delamination) và co ngót (Warping)."
                )
            elif "speed" in param.lower():
                recommendations.append(
                    f"• **{param}**: Tốc độ in thay đổi nhiều lần. Nên giữ Outer Wall ở 120 mm/s và Infill ở 250 mm/s "
                    f"trên máy CoreXY để đảm bảo bề mặt mịn không bị sọc gợn rung (Ghosting/Ringing)."
                )
            else:
                recommendations.append(
                    f"• **{param}**: Phát hiện đột biến >= 3 lần. Đề xuất khóa thông số về cấu hình mặc định Bambu Studio Profile để tránh sai số dây chuyền."
                )

        return (
            f"💡 **Phân Tích Chuyên Gia In 3D (Cơ chế Suy Luận Tự Động):**\n"
            + "\n".join(recommendations)
            + f"\n\n*Khuyến nghị chung cho vật liệu {material}: Đạt độ ổn định nhiệt trước khi bắt đầu layer đầu tiên.*"
        )
