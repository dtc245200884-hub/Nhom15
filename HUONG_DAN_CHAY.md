# HƯỚNG DẪN CHẠY NHÓM 15

### 1. Mở PowerShell tại thư mục dự án
```powershell
cd "duong-dan-den\group15v5"
```

### 2. Tạo môi trường và cài thư viện
```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Chạy hệ thống
```powershell
uvicorn main:app --reload
```

### 4. Truy cập
- Website: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`

### 5. Tài khoản demo
- Student: student@school.vn / Student@123
- Staff: staff@school.vn / Staff@123
- Admin: admin@school.vn / Admin@123

### 6. Bật AI thật
Tạo `.env` từ `.env.example`, đặt `GEMINI_API_KEY`. Nếu chưa có key, hệ thống vẫn chạy bằng chế độ fallback để demo nghiệp vụ.
