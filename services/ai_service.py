"""AI orchestration for menu recommendations, sales forecasts and chat."""
import logging
import os
from google import genai
from services.prompt_builder import build_canteen_prompt
from services.response_validator import validate_response

logger = logging.getLogger(__name__)

def _fallback(kind: str, facts: dict) -> str:
    available = [food for food in facts.get('menu', []) if food.get('stock', 0) > 0]
    if kind == 'recommend':
        sold = {item.get('food_id'): item.get('quantity', 0) for item in facts.get('sales', [])}
        available = sorted(available, key=lambda item: (-sold.get(item.get('id'), 0), item.get('price', 0)))[:3]
        if not available:
            return 'Hiện chưa có món còn hàng để đề xuất.'
        return 'Gợi ý món đang có sẵn: ' + ', '.join(f"{item['name']} ({item.get('price', 0):,.0f} đ)" for item in available)
    if kind == 'forecast':
        sales = sorted(facts.get('sales', []), key=lambda item: item.get('quantity', 0), reverse=True)[:5]
        if not sales:
            return 'Chưa đủ dữ liệu bán hàng để dự báo. Hãy tiếp tục ghi nhận đơn hàng để phân tích xu hướng.'
        return 'Các món có số lượng bán cao trong dữ liệu hiện có: ' + ', '.join(item['name'] for item in sales) + '. Đây là tham khảo từ dữ liệu lịch sử, không phải dự báo chắc chắn.'
    return 'Tôi có thể hỗ trợ về món ăn, giá, thực đơn, tồn kho, đơn hàng, doanh thu và nhu cầu của căng tin.'

def _call_gemini(prompt: str, api_key: str) -> str:
    client = genai.Client(api_key=api_key, http_options={'timeout': int(float(os.getenv('AI_TIMEOUT_SECONDS', '20')) * 1000)})
    model = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash').strip()
    response = client.models.generate_content(model=model, contents=prompt)
    answer = (response.text or '').strip()
    if not answer:
        raise ValueError('AI trả về nội dung rỗng')
    return answer

def ask_ai(kind: str, facts: dict, question: str = '', user_id: int | None = None, db=None) -> str:
    if kind not in {'recommend', 'forecast', 'chat'}:
        raise ValueError('Loại yêu cầu AI không hợp lệ')
    prompt_messages = build_canteen_prompt(kind, question, facts)
    prompt = '\n'.join(f"{item['role']}: {item['content']}" for item in prompt_messages)
    api_key = (os.getenv('GEMINI_API_KEY') or os.getenv('AI_API_KEY') or '').strip()
    success = False
    source = 'fallback'
    if api_key:
        try:
            answer = _call_gemini(prompt, api_key)
            source = 'gemini'
            success = True
        except Exception as exc:
            logger.warning('AI provider unavailable; using deterministic fallback (%s)', type(exc).__name__)
            answer = _fallback(kind, facts)
    else:
        answer = _fallback(kind, facts)
    try:
        answer = validate_response(answer, facts)
    except ValueError:
        logger.warning('AI response validation failed; using fallback')
        answer = validate_response(_fallback(kind, facts), facts)
        success = False
        source = 'fallback'
    if db is not None and user_id is not None:
        from models import AILog
        db.add(AILog(user_id=user_id, kind=kind, question=question[:4000], response=answer[:8000], success=success))
        db.commit()
    logger.info('AI request completed: kind=%s source=%s success=%s', kind, source, success)
    return answer
