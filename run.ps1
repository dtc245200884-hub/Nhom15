$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

Write-Host "`n=== Canteen AI | Nhom 15 ===" -ForegroundColor Cyan
Write-Host "Thu muc: $PSScriptRoot" -ForegroundColor DarkGray

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        if (Get-Command py -ErrorAction SilentlyContinue) {
            & py -3 -m venv .venv
        } else {
            throw 'Khong tim thay Python. Cai Python 3.11+ tu python.org va chon Add Python to PATH.'
        }
    } else {
        & python -m venv .venv
    }
    if ($LASTEXITCODE -ne 0) { throw 'Tao moi truong Python that bai.' }
    Write-Host '[1/4] Da tao moi truong Python.' -ForegroundColor Green
} else {
    Write-Host '[1/4] Moi truong Python da co san.' -ForegroundColor Green
}

# Tao .env chi khi chua ton tai; luon giu nguyen cau hinh hien co.
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item '.env.example' '.env'
    $secret = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    $envText = Get-Content '.env' -Raw
    $envText = $envText -replace '(?m)^SECRET_KEY=.*$', "SECRET_KEY=$secret"

    # Khong tu dong tro sang database o thu muc Downloads khac.
    # Du lieu hien tai duoc xac dinh boi DATABASE_URL trong .env.
    $envText | & $python -c "import sys; from pathlib import Path; Path('.env').write_text(sys.stdin.read(), encoding='utf-8')"
    if ($LASTEXITCODE -ne 0) { throw 'Khong tao duoc file .env.' }
    Write-Host '[2/4] Da tao cau hinh .env lan dau.' -ForegroundColor Green
} else {
    Write-Host '[2/4] Giu nguyen cau hinh .env hien co.' -ForegroundColor Green
}

$requirementsHash = (Get-FileHash -LiteralPath 'requirements.txt' -Algorithm SHA256).Hash
$markerPath = Join-Path $PSScriptRoot '.venv\requirements.sha256'
$installedHash = if (Test-Path -LiteralPath $markerPath) { (Get-Content -LiteralPath $markerPath -Raw).Trim() } else { '' }
if ($requirementsHash -ne $installedHash) {
    Write-Host '[3/4] Cai thu vien (lan dau hoac khi requirements thay doi)...' -ForegroundColor Yellow
    & $python -m pip install --disable-pip-version-check -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Cai thu vien that bai. Kiem tra mang, sau do chay lai start.bat.' }
    Set-Content -LiteralPath $markerPath -Value $requirementsHash -Encoding ascii
} else {
    Write-Host '[3/4] Thu vien da san sang; bo qua cai dat.' -ForegroundColor Green
}

Write-Host '[4/4] Dang khoi dong may chu...' -ForegroundColor Green
Write-Host 'Website : http://127.0.0.1:8000/' -ForegroundColor Cyan
Write-Host 'API Docs: http://127.0.0.1:8000/docs' -ForegroundColor Cyan
Write-Host 'Nhan Ctrl+C de dung website.' -ForegroundColor DarkGray
# Mo trinh duyet thu cong neu can; tranh tao job nen khong duoc don dep.
& $python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
if ($LASTEXITCODE -ne 0) { throw 'May chu dung voi loi. Xem thong bao o tren.' }
