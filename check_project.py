"""Kiem tra nhanh ma nguon, khong can cai thu vien ngoai.
Chay: python check_project.py
"""
from pathlib import Path
import ast
import sys

ROOT = Path(__file__).resolve().parent
REQUIRED = [
    "main.py", "database.py", "models.py", "requirements.txt",
    "Dockerfile", "docker-compose.yml", ".env.example",
    "start.bat", "run.ps1", "static/index.html", "static/app.js",
]
missing = [name for name in REQUIRED if not (ROOT / name).is_file()]
if missing:
    print("THIEU FILE:", ", ".join(missing))
    sys.exit(1)

for path in sorted(ROOT.rglob("*.py")):
    if any(part in {".venv", "venv", "__pycache__"} for part in path.relative_to(ROOT).parts):
        continue
    try:
        ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
    except (SyntaxError, UnicodeError) as exc:
        print(f"LOI PYTHON: {path.relative_to(ROOT)}: {exc}")
        sys.exit(1)

print("PROJECT_CHECK_OK")
print("Luu y: day la kiem tra tinh; chua xac nhan API, AI hay Docker chay thanh cong.")
