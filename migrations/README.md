# Cơ sở dữ liệu và migration

Ứng dụng gọi `Base.metadata.create_all()` khi khởi động để tạo bảng còn thiếu; thao tác này không cập nhật cấu trúc của bảng đã tồn tại. Các migration SQL lịch sử vẫn được giữ lại nhưng không được ứng dụng tự chạy; cần xác minh nội dung và schema đích trước khi áp dụng.

Migration `006_login_bruteforce.py` kiểm tra bảng `users` và chỉ thêm `failed_login_count` hoặc `locked_until` nếu cột tương ứng chưa có. Chạy thủ công từ thư mục gốc bằng `python migrations\006_login_bruteforce.py` sau khi đã sao lưu dữ liệu. Migration không tự chạy khi khởi động ứng dụng.

Đối với thay đổi schema khác, hãy sao lưu dữ liệu trước và bổ sung công cụ migration có phiên bản (khuyến nghị Alembic); không dựa vào `create_all()` để sửa cấu trúc bảng đã tồn tại.
