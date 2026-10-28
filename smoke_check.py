"""Static smoke checks for Nhom 15 Canteen AI.
Run: python smoke_check.py
"""
from pathlib import Path
import ast, re

root=Path(__file__).parent
for p in root.rglob('*.py'):
    if any(part in {"venv", ".venv", "__pycache__"} for part in p.parts): continue
    ast.parse(p.read_text(encoding='utf-8'), filename=str(p))

js=(root/'static/app.js').read_text(encoding='utf-8')
assert "function closeCheckout" in js
assert "function submitOrder" in js
assert "POST /api/orders" not in js  # endpoint is called through fetch
html=(root/'static/index.html').read_text(encoding='utf-8')
assert '/static/favicon.svg' in html
assert 'data-csp-action="close-checkout"' in html
assert 'data-csp-action="submit-order"' in html
print('SMOKE_CHECK_OK')
