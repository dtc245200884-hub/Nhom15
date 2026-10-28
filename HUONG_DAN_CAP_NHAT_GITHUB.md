# Hướng dẫn cập nhật bản ZIP thống nhất lên GitHub

**Nhánh đích:** `canteenai-upload`. Không cần tạo repository mới. Chỉ thực hiện sau khi đã sao lưu `.env` và database đang dùng.

## 1. Giải nén ZIP

Giải nén `CanteenAI_Nhom15_DuongDanChinh_ThongNhat.zip`. Bên trong có thư mục `cangtinai_code` chứa toàn bộ mã nguồn.

## 2. Sao chép có chọn lọc vào repository đang dùng

Mở PowerShell trong thư mục repository hiện tại:

```powershell
cd "C:\Users\admin\Downloads\CanteenAI_EasyStart_Test\cangtinai_code"
git switch canteenai-upload
Get-Location
Test-Path .\start.bat
```

Sao chép từ thư mục giải nén vào đây **những tệp được cập nhật**: `README.md`, `HUONG_DAN_CHAY.md`, `HUONG_DAN_CAP_NHAT_GITHUB.md`, `PHU_LUC_DU_AN.md`. Không chép đè `.env`, database, `.venv`; không cần chép đè `main.py` hoặc các thư mục nghiệp vụ nếu chúng không đổi.

Để kiểm tra vị trí thư mục giải nén:

```powershell
Get-ChildItem "$env:USERPROFILE\Downloads" -Recurse -Filter PHU_LUC_DU_AN.md -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
```

## 3. Kiểm tra trước khi commit

```powershell
Test-Path .\PHU_LUC_DU_AN.md
Test-Path .\check_project.py
python .\check_project.py
python .\smoke_check.py
git status
git diff -- README.md HUONG_DAN_CHAY.md run.ps1 .gitignore
```

Nếu hai lệnh `Test-Path` trả về `False`, bạn chưa sao chép đúng thư mục. **Đừng push vội**.

## 4. Commit và push

```powershell
git add README.md HUONG_DAN_CHAY.md HUONG_DAN_CAP_NHAT_GITHUB.md PHU_LUC_DU_AN.md
git diff --cached --name-only
git commit -m "Standardize canonical Windows project path and run docs"
git push origin canteenai-upload
```

Nếu `git status` hiển thị `nothing to commit`, chưa có thay đổi để đẩy. Nếu Git báo nhánh từ xa đã thay đổi, dừng lại và kiểm tra trước khi pull/rebase.

## 5. Xác nhận trên GitHub

Mở nhánh `canteenai-upload` trên repository và kiểm tra `README.md`, `PHU_LUC_DU_AN.md`, `HUONG_DAN_CHAY.md` xuất hiện ở thư mục gốc. GitHub tự hiển thị README ngay dưới danh sách tệp; liên kết đến phụ lục nằm ở đầu README.

## 6. Thư mục chính duy nhất

Luôn thực hiện `git status`, `git commit` và `git push` từ:

```text
C:\Users\admin\Downloads\CanteenAI_EasyStart_Test\cangtinai_code
```

Không commit từ thư mục giải nén ZIP tạm. Không cần chỉnh `start.bat` hay `run.ps1` để hard-code đường dẫn: hai file này đã chạy theo thư mục chứa chúng.
