# Hướng dẫn chạy và chạy lại CanteenAI — Nhóm 15

## 1. Sau khi khởi động lại Windows

**Đường dẫn dự án chính trên máy này:**

```text
 "C:\Users\admin\Downloads\CanteenAI_EasyStart_Test\cangtinai_code"
```

Mở PowerShell ở bất kỳ vị trí nào, sau đó chạy:

```powershell
cd "C:\Users\admin\Downloads\CanteenAI_EasyStart_Test\cangtinai_code"
Kiểm tra Git:
git status
git branch --show-current
Nếu thấy:
On branch main
nothing to commit, working tree clean
thì dự án đang ở trạng thái bình thường.
Tiếp theo kiểm tra các file quan trọng và khởi động dự án CanteenAI:
Lệnh	Chức năng
Test-Path .\start.bat	  Kiểm tra file khởi động start.bat có tồn tại không.
Test-Path .\main.py	    Kiểm tra file Python chính của ứng dụng có tồn tại không.
Test-Path .\run.ps1	    Kiểm tra file PowerShell dùng để chạy dự án có tồn tại không.
.\start.bat	            Thực thi file start.bat để khởi động CanteenAI.
```

Ba lệnh `Test-Path` phải trả về `True`. Nếu đang ở `PS C:\Users\admin>` mà chạy thẳng `.\start.bat`, PowerShell sẽ báo không tìm thấy tệp. 

### Cách chạy khác

1. Vào thư mục dự án chính ở trên bằng File Explorer.
2. Nhấp đúp **`start.bat`** (hoặc mở PowerShell trong thư mục đó và chạy lệnh bên dưới).
3. Giữ cửa sổ PowerShell mở trong lúc sử dụng.
4. Mở **http://127.0.0.1:8000/**. Tài liệu API: **http://127.0.0.1:8000/docs**.
5. Để tắt: nhấn **Ctrl+C** tại cửa sổ đang chạy.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1
```

**Lần đầu:** cần cài Python 3.11+ và có Internet để cài các thư viện trong `requirements.txt`. Script tạo `.venv`, tạo `.env` từ `.env.example` và sinh `SECRET_KEY` mới nếu `.env` chưa tồn tại. **Lần sau:** script dùng lại môi trường và giữ nguyên `.env`, không cài lại thư viện nếu `requirements.txt` không đổi.

**Dữ liệu:** cấu hình `DATABASE_URL` trong `.env` quyết định nơi lưu database. Mặc định dùng `sqlite:///./canteen_ai.db` tại thư mục dự án. Script **không tự tìm hoặc chuyển sang database cũ** trong Downloads; nếu bạn cần dữ liệu cũ, sao lưu và chỉnh `DATABASE_URL` một cách chủ động. Không xóa `.env`, database hoặc `.venv` khi chỉ muốn chạy lại.

## 2. Chạy bằng Docker Desktop (lựa chọn khác)

Mở PowerShell tại thư mục dự án chính, mở Docker Desktop, đợi engine sẵn sàng; tạo `.env` từ `.env.example` nếu chưa có và **thay `SECRET_KEY=replace-me` bằng một chuỗi bí mật đủ mạnh**. Sau đó chạy:

```powershell
docker compose up -d --build
docker compose ps
docker compose logs --tail 50 canteen-ai
```

Website Docker: **http://127.0.0.1:8001/**. Dừng container: `docker compose down`. **Không chạy `docker compose down -v`** nếu muốn giữ dữ liệu SQLite trong volume `canteen_data`. Docker dùng database trong volume riêng, không tự dùng database Windows của cách chạy PowerShell.

## 3. Kiểm tra trước khi demo hoặc upload GitHub

```powershell
python .\check_project.py
python .\smoke_check.py
git status
git branch --show-current
```

`PROJECT_CHECK_OK` và `SMOKE_CHECK_OK` là các **kiểm tra tĩnh**, không chứng minh tất cả API hoặc Docker đã chạy thành công. Để xác nhận runtime, khởi động ứng dụng rồi kiểm tra `/api/health`, đăng nhập, đặt món và các chức năng cần trình diễn.

Chỉ commit những tệp đã kiểm tra; **không dùng `git add .` khi có tệp sao lưu chưa theo dõi**. Ví dụ trên nhánh `canteenai-upload`:

```powershell
git switch canteenai-upload
git add README.md HUONG_DAN_CHAY.md run.ps1 check_project.py
git diff --cached --name-only
git commit -m "Simplify startup and refresh run guide"
git push origin canteenai-upload
```

## 4. Lỗi thường gặp

- **Không tìm thấy Python:** cài Python 3.11+ và mở PowerShell mới.
- **Cổng 8000 đã sử dụng:** dừng cửa sổ web cũ bằng `Ctrl+C`.
- **Không có thư viện:** kiểm tra Internet và chạy lại `start.bat`.
- **Dữ liệu không như trước:** kiểm tra `DATABASE_URL` trong `.env` và bản sao lưu database; không xóa file để thử sửa lỗi.
- **Docker không khởi động:** kiểm tra Docker Desktop, `docker compose ps`, và `docker compose logs --tail 100 canteen-ai`.
- **AI không trả lời:** kiểm tra API key trong `.env` và kết nối mạng. Không công khai API key.

## 5. Bảo mật và giới hạn

Không upload `.env`, khóa API, database thật, file `.bak`, hoặc `.venv` lên GitHub. `start.bat` dùng cho demo cục bộ; Docker cũng đang chỉ mở cổng localhost. Trước khi triển khai thực tế cần cấu hình bảo mật, secret, sao lưu, kiểm thử và quản trị tài khoản phù hợp.

## 6. Phụ lục và cập nhật GitHub

- [Phụ lục dự án](PHU_LUC_DU_AN.md): tổng quan chức năng, kiến trúc, API và giới hạn.
- [Hướng dẫn cập nhật GitHub](HUONG_DAN_CAP_NHAT_GITHUB.md): các bước đồng bộ ZIP vào nhánh `canteenai-upload`.

## 7. Phân biệt đường dẫn Windows và GitHub

- Thư mục chạy trên máy: `C:\Users\admin\Downloads\CanteenAI_EasyStart_Test\cangtinai_code`.
- Repository: https://github.com/dtc245200884-hub/Nhom15
- Nhánh mã nguồn đang sử dụng: `canteenai-upload`.
- File ZIP là bản đóng gói để sao lưu hoặc chuyển máy, **không phải thư mục chạy chính** sau khi đã cập nhật vào repository.
- Nếu đổi máy hoặc di chuyển thư mục, cần thay đường dẫn `cd` trong tài liệu. `start.bat` và `run.ps1` vẫn chạy theo thư mục chứa script, không phụ thuộc tên thư mục bên ngoài.
