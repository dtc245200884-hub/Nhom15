# Canteen AI — Nhóm 15

Ứng dụng quản lý căng tin trường học tích hợp AI, chạy bằng Python + FastAPI.

## Bắt đầu trong 1 bước

1. Giải nén ZIP.
2. Mở thư mục `cangtinai_code`.
3. Nhấp đúp `start.bat`.
4. Mở http://127.0.0.1:8000/ nếu trình duyệt chưa tự mở.

Lần đầu cần Internet để cài thư viện. Những lần sau thường khởi động nhanh hơn. Không cần tự chạy lệnh cài thư viện.

Xem hướng dẫn đầy đủ tại [`HUONG_DAN_CHAY.md`](HUONG_DAN_CHAY.md).

## Chức năng chính

- Tài khoản và phân quyền sinh viên / nhân viên / quản trị viên.
- Quản lý món ăn, danh mục, thực đơn, đơn hàng và thanh toán.
- Theo dõi nguyên liệu, tồn kho, thông báo và báo cáo.
- Hỗ trợ AI cho hỏi đáp và phân tích dữ liệu căng tin.

## Liên kết

- Website: http://127.0.0.1:8000/
- API Docs: http://127.0.0.1:8000/docs

## An toàn dữ liệu

Không chia sẻ `.env` hoặc API key. Script giữ nguyên `.env` hiện có và không đưa database cá nhân vào ZIP. Hãy sao lưu database trước khi thay đổi cấu hình hoặc di chuyển dự án.
