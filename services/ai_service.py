import os
from services.prompt_builder import build_canteen_prompt
from services.response_validator import validate_response

def _fallback(kind, facts):
    foods=[f for f in facts.get('menu',[]) if f.get('stock',0)>0]
    if kind=='recommend':
        foods=sorted(foods,key=lambda x:x.get('stock',0))[:3]
        return 'Gợi ý món đang có sẵn: ' + ', '.join(f'{f["name"]} ({f.get("price",0):,.0f} đ)' for f in foods) if foods else 'Hiện chưa có món phù hợp.'
    if kind=='forecast':
        sales=facts.get('sales',[])
        if sales:
            top=sorted(sales,key=lambda x:x.get('quantity',0),reverse=True)[:5]
            return 'Dự báo dựa trên lịch sử bán: ưu tiên chuẩn bị ' + ', '.join(x['name'] for x in top) + '. Đồng thời kiểm tra các món có tồn kho thấp trước giờ bán.'
        return 'Chưa đủ dữ liệu bán hàng để dự báo. Hãy tiếp tục ghi nhận đơn hàng để AI phân tích xu hướng.'
    return 'Tôi có thể hỗ trợ về món ăn, giá, thực đơn, tồn kho, đơn hàng, doanh thu và dự báo nhu cầu của căng tin.'

def _gemini(prompt,key):
    from google import genai
    client=genai.Client(api_key=key)
    model=os.getenv('GEMINI_MODEL','gemini-2.0-flash')
    response=client.models.generate_content(model=model,contents=prompt)
    return (response.text or '').strip()

def ask_ai(kind,facts,question='',user_id=None,db=None):
    prompt=build_canteen_prompt(kind,question,facts)
    answer=None
    provider_success=False
    key=os.getenv('AI_API_KEY') or os.getenv('GEMINI_API_KEY')

    if key:
        try:
            answer=_gemini('\n'.join(x['content'] for x in prompt),key)
            provider_success=bool(answer)
        except Exception:
            answer=None
            provider_success=False

    if not answer:
        answer=_fallback(kind,facts)

    answer=validate_response(answer,facts)

    if db is not None and user_id is not None:
        from models import AILog
        db.add(AILog(
            user_id=user_id,
            kind=kind,
            question=question,
            response=answer,
            success=provider_success
        ))
        db.commit()

    return answer
