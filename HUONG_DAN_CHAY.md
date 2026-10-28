# CANTEEN AI — NHÓM 15

## Chạy nhanh trên Windows

**Cách dễ nhất:** mở thư mục này và nhấp đúp `start.bat`. Lần đầu cần Internet để cài thư viện; các lần sau thường chỉ mất vài giây.

Nếu Windows hỏi xác nhận mở tệp, chọn **Run / Open** nếu bạn tin cậy nguồn tệp. Nếu cửa sổ báo lỗi, không đóng cửa sổ; chụp hoặc sao chép phần lỗi để kiểm tra.

### Chạy bằng PowerShell

Mở PowerShell tại thư mục `cangtinai_code` và chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1
```

Nếu đang dùng PowerShell 7, có thể dùng `pwsh` thay cho `powershell`:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\run.ps1
```

## Mở website

- Website: http://127.0.0.1:8000/
- API Docs: http://127.0.0.1:8000/docs

Khi thấy `Uvicorn running` và `Application startup complete`, website đã chạy. Giữ cửa sổ khởi động mở. Nhấn `Ctrl+C` để dừng.

## Lần đầu và các lần sau

- Lần đầu: script tự tạo `.venv`, tạo `.env` nếu chưa có và cài thư viện. Có thể mất vài phút.
- Lần sau: script dùng lại `.venv` và bỏ qua cài thư viện nếu `requirements.txt` không thay đổi.
- Không cần tự kích hoạt môi trường ảo và không cần chạy `pip install` thủ công.

## Dữ liệu và cấu hình

- Script không ghi đè `.env` nếu file đã tồn tại.
- Khi tạo `.env` mới, script tự tạo `SECRET_KEY` ngẫu nhiên.
- Nếu phát hiện `Downloads\group15v5\canteen_ai.db`, script sẽ cấu hình dùng database đó **chỉ khi tạo `.env` lần đầu**.
- Không xóa hoặc di chuyển `.env`, `canteen_ai.db` hay bản sao lưu nếu chưa biết chắc chúng không còn cần thiết. Nếu dữ liệu cũ không hiện ra, kiểm tra `DATABASE_URL` trong `.env`.
- ZIP không chứa `.env`, mật khẩu, database cá nhân hoặc môi trường `.venv`.

## Tài khoản demo

Nếu cơ sở dữ liệu mới được tạo, ứng dụng có tài khoản demo:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin@school.vn` | `Admin@123` |
| Nhân viên | `staff@school.vn` | `Staff@123` |
| Sinh viên | `student@school.vn` | `Student@123` |

Nếu dùng database cũ, tài khoản phụ thuộc vào dữ liệu đã lưu trong database đó.

## AI (không bắt buộc để khởi động)

Để gọi Gemini thật, thêm API key vào `GEMINI_API_KEY` trong `.env`. Không chia sẻ file `.env` và không đưa API key lên GitHub. Nếu chưa có key, các chức năng AI có thể sử dụng chế độ dự phòng tùy chức năng.

## Sửa lỗi nhanh

**Không tìm thấy `run.ps1`:** đảm bảo PowerShell đang ở đúng thư mục chứa `run.ps1`, `main.py` và `requirements.txt`.

**Lỗi cổng 8000 đang được sử dụng:** dừng phiên bản cũ bằng `Ctrl+C` ở cửa sổ đang chạy, sau đó mở lại `start.bat`.

**Cài thư viện lỗi:** kiểm tra kết nối Internet rồi chạy lại `start.bat`. Không xóa `.env` hoặc database để thử sửa lỗi.

**Website không mở:** đợi đến khi log hiện `Application startup complete`; nếu có thông báo lỗi màu đỏ, giữ lại toàn bộ thông báo để kiểm tra.

## Kiểm tra tùy chọn

Sau khi cài thư viện thành công, có thể chạy trong PowerShell:

```powershell
.\.venv\Scripts\python.exe .\smoke_check.py
```

Kết quả mong đợi: `SMOKE_CHECK_OK`.

---
*Hướng dẫn dành cho chạy demo trên máy cá nhân Windows; chưa thay thế cấu hình bảo mật khi triển khai production.*
