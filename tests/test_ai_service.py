import os
from services.ai_service import _fallback
from services.response_validator import validate_response

def test_recommendation_fallback_uses_available_foods():
    facts = {'menu': [{'name': 'Cơm gà', 'price': 30000, 'stock': 4}, {'name': 'Phở bò', 'price': 35000, 'stock': 0}], 'sales': []}
    answer = _fallback('recommend', facts)
    assert 'Cơm gà' in answer
    assert 'Phở bò' not in answer

def test_forecast_fallback_reports_insufficient_data():
    assert 'Chưa đủ dữ liệu' in _fallback('forecast', {'menu': [], 'sales': []})

def test_chat_fallback_does_not_claim_database_facts():
    assert 'hỗ trợ' in _fallback('chat', {'menu': [], 'sales': []})

def test_validator_rejects_empty_response():
    try:
        validate_response('', {'menu': [], 'sales': []})
    except ValueError:
        return
    raise AssertionError('Expected empty AI response to be rejected')
