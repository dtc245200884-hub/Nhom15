# PHỤ LỤC DỰ ÁN — CANTEEN AI (NHÓM 15)

> Tài liệu giới thiệu và đối chiếu mã nguồn cho nhánh `canteenai-upload`. Nội dung dưới đây dựa trên **các tệp hiện có trong gói mã nguồn**, không phải biên bản nghiệm thu hoặc khẳng định toàn bộ tính năng đã được kiểm thử thực tế.

## 1. Thông tin đồ án

- **Tên đề tài:** Hệ thống quản lý căng tin trường học có tích hợp AI (CanteenAI).
- **Nhóm thực hiện:** Nhóm 15; lớp CNTTK23N.
- **Môn học:** Ứng dụng trí tuệ nhân tạo.
- **Mục tiêu:** Hỗ trợ quản lý thực đơn, bán hàng, nguyên liệu, người dùng và khai thác dữ liệu căng tin qua các API và dịch vụ AI.
- **Mã nguồn chính:** nhánh `canteenai-upload` của repository `Nhom15`.

## 2. Công nghệ và kiến trúc

| Tầng | Thành phần trong mã nguồn | Vai trò |
|---|---|---|
| Giao diện | `static/*.html`, `static/*.css`, `static/*.js` | Các trang người dùng, đăng nhập, đăng ký và quản trị |
| API | `main.py` — FastAPI | Cung cấp tuyến API và trang web |
| Dữ liệu | `models.py`, `database.py` — SQLAlchemy | Mô hình bảng, phiên làm việc, kết nối database |
| Nghiệp vụ/AI | `services/` | Xử lý chat, gợi ý, phân tích, tích hợp nhà cung cấp AI |
| Truy xuất | `repositories/` | Một số thao tác lưu/truy vấn dữ liệu chat |
| Triển khai | `run.ps1`, `start.bat`, `Dockerfile`, `docker-compose.yml` | Chạy trên Windows hoặc Docker |

Dự án sử dụng HTML/CSS/JavaScript thuần; **không mô tả frontend là React/Vite** nếu chưa có mã nguồn tương ứng. Database mặc định trên Windows là SQLite (cấu hình bằng `DATABASE_URL`); Docker dùng volume riêng.

## 3. Các nhóm chức năng thể hiện qua API

1. **Tài khoản:** đăng ký, đăng nhập, xem thông tin phiên đăng nhập.
2. **Danh mục và món ăn:** xem, thêm, sửa, xóa danh mục/món ăn.
3. **Thực đơn:** xem, tạo và quản lý các món trong thực đơn.
4. **Nguyên liệu và kho:** quản lý nguyên liệu, ghi nhận và xem biến động tồn kho.
5. **Đơn hàng và thanh toán:** tạo, xem, đổi trạng thái đơn hàng và ghi nhận thanh toán.
6. **Thông báo và quản trị người dùng:** xem thông báo, đánh dấu đã đọc, quản lý trạng thái tài khoản.
7. **Thống kê:** dữ liệu dashboard và báo cáo doanh thu.
8. **AI:** endpoint gợi ý, dự báo, chat và xem log AI. Chất lượng kết quả phụ thuộc cấu hình và dữ liệu thực tế.

## 4. Mô hình dữ liệu

Các lớp mô hình SQLAlchemy tìm thấy trong `models.py`:

`User`, `Category`, `Food`, `Menu`, `MenuItem`, `Order`, `OrderItem`, `Ingredient`, `InventoryMovement`, `Payment`, `Notification`, `AILog`.

Các migration SQL trong `migrations/` hỗ trợ các thay đổi cơ sở dữ liệu tương ứng. Việc áp dụng migration cần tuân thủ hệ quản trị và cấu hình đang sử dụng.

## 5. Danh sách API khai báo trong `main.py`

Bảng dưới đây liệt kê **36 tuyến API `/api/`** tìm thấy bằng cách đọc các decorator FastAPI; đây là kiểm kê mã nguồn, không phải xác nhận API đã chạy thành công.

| Phương thức | Đường dẫn |
|---|---|
| `GET` | `/api/health` |
| `POST` | `/api/auth/register` |
| `POST` | `/api/auth/login` |
| `GET` | `/api/auth/me` |
| `GET` | `/api/categories` |
| `POST` | `/api/categories` |
| `PUT` | `/api/categories/{id}` |
| `DELETE` | `/api/categories/{id}` |
| `GET` | `/api/foods` |
| `POST` | `/api/foods` |
| `PUT` | `/api/foods/{id}` |
| `DELETE` | `/api/foods/{id}` |
| `GET` | `/api/menus` |
| `POST` | `/api/menus` |
| `POST` | `/api/menus/{menu_id}/items/{food_id}` |
| `DELETE` | `/api/menus/items/{item_id}` |
| `GET` | `/api/ingredients` |
| `POST` | `/api/ingredients` |
| `PUT` | `/api/ingredients/{id}` |
| `POST` | `/api/inventory/movement` |
| `GET` | `/api/inventory/movements` |
| `POST` | `/api/orders` |
| `GET` | `/api/orders` |
| `GET` | `/api/orders/{id}` |
| `PATCH` | `/api/orders/{id}/status` |
| `POST` | `/api/orders/{id}/payment` |
| `GET` | `/api/notifications` |
| `PATCH` | `/api/notifications/{id}/read` |
| `GET` | `/api/users` |
| `PATCH` | `/api/users/{id}/status` |
| `GET` | `/api/dashboard` |
| `GET` | `/api/reports/sales` |
| `POST` | `/api/ai/recommend` |
| `POST` | `/api/ai/forecast` |
| `POST` | `/api/ai/chat` |
| `GET` | `/api/ai/logs` |

Ngoài các API trên, ứng dụng có các đường dẫn trang như `/`, `/login`, `/register`, `/admin` và favicon.

## 6. Cách chạy và kiểm tra

**Windows:** nhấp đúp `start.bat`, hoặc chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1
```

- Website: http://127.0.0.1:8000/
- Tài liệu API: http://127.0.0.1:8000/docs
- Kiểm tra sức khỏe khi đã chạy: http://127.0.0.1:8000/api/health

**Docker:** `docker compose up -d --build`; website tại http://127.0.0.1:8001/.

**Kiểm tra tĩnh:**

```powershell
python .\check_project.py
python .\smoke_check.py
```

Các kết quả `PROJECT_CHECK_OK`, `SMOKE_CHECK_OK` chỉ phản ánh kiểm tra cấu trúc/cú pháp và một số dấu hiệu trong mã nguồn. Để nghiệm thu, cần chạy ứng dụng và kiểm thử các luồng đăng nhập, đặt hàng, phân quyền, tồn kho, báo cáo, AI và khởi động Docker.

## 7. Bảo mật và giới hạn

- `.env`, khóa AI, thông tin đăng nhập thật, database và `.venv` không được đưa vào GitHub.
- `SEED_DEMO_USERS` chỉ nên bật trong môi trường thử nghiệm và phải tắt khi triển khai thật.
- AI có thể cần `GEMINI_API_KEY` hoặc cấu hình tương ứng; không nên khẳng định AI trực tuyến hoạt động nếu chưa thử với khóa hợp lệ.
- Mã nguồn và tài liệu không tự chứng minh hiệu năng, tính bảo mật hoặc kết quả kiểm thử sản phẩm.

## 8. Danh mục tệp quan trọng

| Đường dẫn | Nội dung |
|---|---|
| `README.md` | Trang giới thiệu chính của GitHub |
| `PHU_LUC_DU_AN.md` | Phụ lục dự án này, hiển thị trực tiếp trên GitHub |
| `HUONG_DAN_CHAY.md` | Quy trình chạy và xử lý lỗi |
| `HUONG_DAN_CAP_NHAT_GITHUB.md` | Quy trình đồng bộ ZIP vào repository |
| `main.py` | API và ứng dụng FastAPI |
| `models.py`, `database.py` | Mô hình và kết nối dữ liệu |
| `services/`, `repositories/` | Dịch vụ AI/nghiệp vụ và truy xuất dữ liệu |
| `static/` | Giao diện người dùng |
| `Dockerfile`, `docker-compose.yml` | Đóng gói và triển khai Docker |

## 9. Hướng phát triển

Các hướng có thể xem xét sau khi kiểm thử thực tế: bổ sung bộ kiểm thử tự động, cải thiện quan sát/log, hoàn thiện sao lưu và khôi phục dữ liệu, nâng cao bảo mật và triển khai CI/CD. Đây là **đề xuất**, không phải tính năng đã triển khai.
