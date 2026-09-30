# Nhom 15 - Hệ thống quản lý căng tin trường học tích hợp AI

Phiên bản Python/FastAPI mở rộng, phát triển theo cấu trúc dự án mẫu Nhóm 5 nhưng chuyển toàn bộ nghiệp vụ sang quản lý căng tin.

## Chức năng
- JWT đăng nhập/đăng ký và phân quyền Student / Staff / Admin.
- Quản lý danh mục, món ăn, giá và tồn kho món.
- Quản lý thực đơn theo ngày.
- Đặt món, quản lý trạng thái đơn và hoàn tồn kho khi hủy.
- Thanh toán: tiền mặt/chuyển khoản, trạng thái paid/unpaid/refunded.
- Quản lý nguyên liệu và nhập/xuất kho.
- Thông báo cho người dùng khi đặt món, đổi trạng thái và thanh toán.
- Dashboard: đơn hôm nay, doanh thu, món bán chạy, món/nguyên liệu sắp hết, trạng thái đơn.
- Báo cáo doanh thu 7 ngày.
- AI: gợi ý món, dự báo nhu cầu, hỏi đáp tự nhiên dựa trên dữ liệu căng tin.
- Ghi log các phiên AI.

## Chạy
```bash
python -m venv venv
venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
Mở `http://127.0.0.1:8000`.

## Tài khoản demo
- Admin: `admin@school.vn` / `Admin@123`
- Staff: `staff@school.vn` / `Staff@123`
- Student: `student@school.vn` / `Student@123`

## AI Gemini
Sao chép `.env.example` thành `.env`, điền `GEMINI_API_KEY` hoặc `AI_API_KEY`. Không đưa `.env` có API key lên GitHub.
