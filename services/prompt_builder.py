import json

def build_canteen_prompt(kind, question='', facts=None, history=None):
    facts = facts or {}
    history = history or []
    rules = ('Bạn là trợ lý AI của hệ thống quản lý căng tin trường học. '
             'Chỉ dùng dữ liệu CANTEEN_FACTS cho các con số, món ăn, giá, tồn kho và đơn hàng. '
             'Không bịa món, giá hoặc số liệu. Trả lời tiếng Việt, rõ ràng, ngắn gọn.')
    if kind == 'recommend':
        task='Gợi ý tối đa 3 món phù hợp dựa trên thực đơn, tồn kho và dữ liệu bán hàng.'
    elif kind == 'forecast':
        task='Phân tích dữ liệu bán hàng và tồn kho để dự báo món cần chuẩn bị, nêu lý do.'
    else:
        task=f'Trả lời câu hỏi của người dùng: {question}'
    return [
        {'role':'system','content':rules},
        {'role':'user','content':f'CANTEEN_FACTS={json.dumps(facts,ensure_ascii=False)}\nTASK={task}'}
    ]
