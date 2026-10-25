# Hệ thống quản lý căng tin trường học tích hợp AI — Nhóm 15

## 1. Giới thiệu
Ứng dụng web quản lý món ăn, danh mục, thực đơn, nguyên liệu, nhập/xuất kho, đơn hàng, thanh toán, thông báo, báo cáo và các chức năng AI hỗ trợ nghiệp vụ.

## 2. Kiến trúc mã nguồn
```text
cangtinai_code/
├── main.py                 # Khởi tạo FastAPI, middleware và router
├── core.py                 # Cấu hình, xác thực, phân quyền, seed dữ liệu demo
├── schemas.py              # Pydantic request schemas và validation
├── database.py             # SQLAlchemy engine/session
├── models.py               # ORM models và quan hệ dữ liệu
├── routers/                # API chia theo miền nghiệp vụ
│   ├── auth.py
│   ├── catalog.py
│   ├── inventory.py
│   ├── orders.py
│   └── admin_ai.py
├── services/                # Logic AI và phân tích dữ liệu
├── static/                  # HTML, CSS, JavaScript giao diện
├── migrations/              # SQL migration hiện có
├── tests/                   # Kiểm thử tự động
├── .env.example
└── requirements.txt
```

## 3. Yêu cầu
- Python 3.10 trở lên (khuyến nghị Python 3.12).
- pip và môi trường ảo Python.
- SQLite mặc định; có thể cấu hình `DATABASE_URL` cho hệ quản trị được SQLAlchemy hỗ trợ.
- `GEMINI_API_KEY` chỉ cần khi muốn gọi Gemini thật; không có khóa thì ứng dụng dùng câu trả lời dự phòng dựa trên dữ liệu hiện có.

## 4. Cài đặt trên Windows PowerShell
```powershell
cd .\cangtinai_code
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```
Mở `.env`, đặt `ENVIRONMENT=development`, đặt `SECRET_KEY` thành chuỗi ngẫu nhiên riêng, ví dụ tạo bằng `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Để tạo tài khoản demo, tự đặt các giá trị riêng cho `DEMO_ADMIN_PASSWORD`, `DEMO_STAFF_PASSWORD` và `DEMO_STUDENT_PASSWORD`; trang đăng nhập development sẽ hiển thị thông tin đã cấu hình. Đặt `GEMINI_API_KEY` nếu dùng AI thật.

## 5. Chạy
```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
- Website: http://127.0.0.1:8000
- Tài liệu API: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/health

## 6. Tài khoản demo
Tài khoản demo chỉ được tạo khi `ENVIRONMENT=development`, bảng người dùng rỗng và cả ba biến mật khẩu `DEMO_ADMIN_PASSWORD`, `DEMO_STAFF_PASSWORD`, `DEMO_STUDENT_PASSWORD` đã được cấu hình. Không có mật khẩu demo mặc định trong mã nguồn hoặc tài liệu. Môi trường production và môi trường chưa cấu hình rõ sẽ không seed dữ liệu demo.

## 7. Cấu hình môi trường
Xem `.env.example`. Không commit `.env`, database thật hoặc API key. CORS mặc định chỉ cho phép localhost; nếu đổi địa chỉ frontend, cập nhật `CORS_ORIGINS` bằng danh sách origin cụ thể, không dùng wildcard cùng credentials.

## 8. Kiểm thử
```powershell
python -m compileall -q .
python smoke_check.py
python -m pytest -q
```

## 9. Lưu ý về dữ liệu
- `Base.metadata.create_all()` chỉ tạo bảng còn thiếu, không thay thế công cụ migration cho thay đổi schema.
- Sao lưu file SQLite hoặc database tương ứng trước khi thay đổi schema.
- Chỉ bật `ENVIRONMENT=production` sau khi cấu hình `SECRET_KEY` an toàn và cấp phát tài khoản quản trị theo quy trình triển khai riêng.
