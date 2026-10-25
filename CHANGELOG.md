# Nhật ký chỉnh sửa

## Bản tái cấu trúc 3.1.0
- Tách API thành các router theo miền: xác thực, danh mục/món/thực đơn, kho, đơn hàng/thông báo, quản trị/AI.
- Tách schema đầu vào khỏi logic API; bổ sung giới hạn và kiểm tra dữ liệu.
- Tách cấu hình, xác thực JWT, phân quyền và dữ liệu demo vào `core.py`.
- Giới hạn CORS theo danh sách origin cụ thể; cảnh báo về khóa JWT và tài khoản demo.
- Sửa API danh sách người dùng để không trả `password_hash`.
- Sửa xử lý đơn hàng để gộp các dòng món trùng ID trước khi kiểm tra tồn kho và rollback khi ghi dữ liệu lỗi.
- Sửa cập nhật trạng thái đơn để kiểm tra tồn kho trước khi trừ lại.
- Tách dịch vụ AI, đặt timeout, ghi nhận đúng trạng thái fallback/AI và tránh log thông tin bí mật.
- Loại bỏ các module chat/tài chính cũ không được kết nối với hệ thống căng tin và các migration tham chiếu schema không tồn tại.
- Bổ sung README, `.env.example`, `.gitignore` và test đơn vị cơ bản.

## Kiểm tra đã thực hiện trong môi trường chỉnh sửa
- `python -m compileall -q .`: đạt.
- `python smoke_check.py`: đạt (`SMOKE_CHECK_OK`).
- Kiểm tra cú pháp AST và danh sách endpoint: đạt, 36 route API trong 5 router.
- Chưa chạy kiểm thử tích hợp/runtime vì môi trường chỉnh sửa không có các dependency của dự án cài sẵn và không truy cập được PyPI. Sau khi cài `requirements.txt`, cần chạy lại `pytest` và thử luồng website/API thực tế.
