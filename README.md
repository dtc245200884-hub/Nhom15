# CanteenAI — Hệ thống quản lý căng tin trường học tích hợp AI

**Đồ án Nhóm 15 | Môn Ứng dụng trí tuệ nhân tạo | CNTTK23N**

Dự án xây dựng hệ thống quản lý căng tin với **FastAPI (Python)**, **SQLAlchemy** và giao diện **HTML/CSS/JavaScript**. Mã nguồn có các luồng quản lý món ăn, thực đơn, đơn hàng, tồn kho, người dùng, báo cáo và các điểm truy cập dịch vụ AI.

> **Xem phụ lục dự án:** [PHU_LUC_DU_AN.md](PHU_LUC_DU_AN.md) — tóm tắt mục tiêu, chức năng, kiến trúc, cấu trúc mã nguồn, API, kiểm tra và giới hạn triển khai.

## Thư mục dự án chính trên máy Windows

Thư mục được thống nhất cho máy đang sử dụng:

```text
C:\Users\admin\Downloads\CanteenAI_EasyStart_Test\cangtinai_code
```

Đây là **đường dẫn cục bộ trên máy người thực hiện**, không phải địa chỉ website công khai. Người tải repository sang máy khác cần thay đường dẫn tương ứng; script `start.bat` tự xác định vị trí của chính nó.

## Khởi động nhanh sau khi bật lại máy Windows

1. Mở PowerShell và chuyển đến thư mục dự án chính:

   ```powershell
   cd "C:\Users\admin\Downloads\CanteenAI_EasyStart_Test\cangtinai_code"
   ```

   Kiểm tra `Test-Path .\start.bat` trả về `True`.
2. Chạy **`.\start.bat`** trong PowerShell (hoặc nhấp đúp `start.bat` trong File Explorer). Có thể dùng lệnh tương đương:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1
   ```
3. Đợi thông báo `Application startup complete` rồi mở **http://127.0.0.1:8000/**.
4. Xem API tại **http://127.0.0.1:8000/docs**. Giữ cửa sổ PowerShell mở; nhấn `Ctrl+C` để dừng.

Lần đầu cần **Python 3.11+** và kết nối Internet để cài các thư viện. Các lần sau script dùng lại `.venv` và `.env` hiện có. Không cần chạy Git hoặc cài lại thư viện mỗi lần khởi động máy.

## Chạy bằng Docker Desktop (tùy chọn)

Tạo `.env` từ `.env.example` và thiết lập `SECRET_KEY` phù hợp, sau đó:

```powershell
docker compose up -d --build
```

Mở **http://127.0.0.1:8001/**. Docker dùng volume dữ liệu riêng; không mặc định dùng chung database với cách chạy PowerShell.

## Tài liệu dự án

| Tài liệu | Nội dung |
|---|---|
| [PHU_LUC_DU_AN.md](PHU_LUC_DU_AN.md) | Phụ lục giới thiệu đồ án, kiến trúc, chức năng, API và kết quả kiểm tra |
| [HUONG_DAN_CHAY.md](HUONG_DAN_CHAY.md) | Hướng dẫn chạy lần đầu, chạy lại, Docker, dữ liệu và xử lý lỗi |
| [HUONG_DAN_CAP_NHAT_GITHUB.md](HUONG_DAN_CAP_NHAT_GITHUB.md) | Quy trình đưa bản ZIP đã thống nhất lên nhánh `canteenai-upload` |

## Cấu trúc mã nguồn

- `main.py`: ứng dụng FastAPI và các endpoint.
- `models.py`, `database.py`, `migrations/`: mô hình và cấu hình dữ liệu.
- `services/`, `repositories/`: xử lý nghiệp vụ, chat và AI.
- `static/`: giao diện HTML, CSS, JavaScript.
- `start.bat`, `run.ps1`: khởi động Windows.
- `Dockerfile`, `docker-compose.yml`: cấu hình container.
- `check_project.py`, `smoke_check.py`: kiểm tra tĩnh trước khi trình diễn.

**Bảo mật:** Không đưa `.env`, khóa API, database thật, `.venv` hoặc dữ liệu cá nhân lên GitHub. Các kiểm tra tĩnh không thay thế kiểm thử ứng dụng thực tế.
