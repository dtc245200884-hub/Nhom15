"""Shared configuration, authentication helpers and seed data."""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from database import Base, engine, get_db
from models import User, Category, Food, Menu, MenuItem, Order, OrderItem, Ingredient, InventoryMovement, Payment, Notification, AILog
from schemas import Login, Register, FoodIn, CategoryIn, IngredientIn, StockMovementIn, OrderLine, OrderIn, StatusIn, PaymentIn, AIQuestion, MenuIn, UserStatusIn
load_dotenv()
logger = logging.getLogger(__name__)
ENVIRONMENT = os.getenv('ENVIRONMENT', '').strip().lower()
SECRET_KEY = os.getenv('SECRET_KEY', '').strip()
if SECRET_KEY in {'replace-with-a-random-secret-key', 'change-this-secret-key'}:
    if ENVIRONMENT == 'production':
        raise RuntimeError('Hãy thay SECRET_KEY mẫu bằng khóa ngẫu nhiên riêng trong production')
    logger.warning('SECRET_KEY hiện vẫn là giá trị mẫu; hãy thay bằng khóa ngẫu nhiên riêng.')
    SECRET_KEY = ''
if not SECRET_KEY:
    if ENVIRONMENT == 'production':
        raise RuntimeError('SECRET_KEY phải được cấu hình trong môi trường production')
    SECRET_KEY = secrets.token_urlsafe(48)
    logger.warning('Đang dùng SECRET_KEY tạm thời; phiên đăng nhập sẽ hết hiệu lực khi ứng dụng khởi động lại.')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_DAYS = max(1, int(os.getenv('ACCESS_TOKEN_EXPIRE_DAYS', '30')))
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
oauth = OAuth2PasswordBearer(tokenUrl='/api/auth/login')

def hashpw(password: str) -> str:
    return pwd.hash(password)

def verify(password: str, password_hash: str) -> bool:
    try:
        return pwd.verify(password, password_hash)
    except (ValueError, TypeError):
        return False

def token(user: User) -> str:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({'sub': str(user.id), 'role': user.role, 'iat': now, 'exp': expires}, SECRET_KEY, algorithm=ALGORITHM)

def current(token_value: str=Depends(oauth), db: Session=Depends(get_db)) -> User:
    try:
        subject = jwt.decode(token_value, SECRET_KEY, algorithms=[ALGORITHM]).get('sub')
        uid = int(subject)
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail='Token không hợp lệ', headers={'WWW-Authenticate': 'Bearer'})
    user = db.get(User, uid)
    if not user or user.status != 'active':
        raise HTTPException(status_code=401, detail='Tài khoản không khả dụng', headers={'WWW-Authenticate': 'Bearer'})
    return user

def roles(*allowed: str):

    def dependency(user: User=Depends(current)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail='Bạn không có quyền')
        return user
    return dependency

def get_demo_credentials() -> list[dict[str, str]]:
    """Return development demo credentials only when explicitly configured."""
    if ENVIRONMENT != 'development':
        return []
    configured = (
        ('admin@school.vn', 'DEMO_ADMIN_PASSWORD', 'Quản trị viên', 'admin'),
        ('staff@school.vn', 'DEMO_STAFF_PASSWORD', 'Nhân viên căng tin', 'staff'),
        ('student@school.vn', 'DEMO_STUDENT_PASSWORD', 'Nguyễn Văn A', 'student'),
    )
    credentials = []
    for email, setting, full_name, role in configured:
        password = os.getenv(setting, '')
        if not password:
            return []
        credentials.append({'email': email, 'password': password, 'full_name': full_name, 'role': role})
    return credentials

def seed(db: Session) -> None:
    """Insert demo records only when each table is empty."""
    if ENVIRONMENT != 'development':
        return
    if not db.query(User).first():
        credentials = get_demo_credentials()
        if credentials:
            db.add_all([User(email=item['email'], password_hash=hashpw(item['password']), full_name=item['full_name'], role=item['role']) for item in credentials])
            db.commit()
            logger.info('Đã tạo các tài khoản demo development.')
        else:
            logger.info('Không tạo tài khoản demo vì thiếu cấu hình mật khẩu development.')
    if not db.query(Category).first():
        db.add_all([Category(name='Cơm', description='Các món cơm'), Category(name='Món nước'), Category(name='Đồ uống'), Category(name='Ăn nhẹ')])
        db.commit()
    if not db.query(Food).first():
        categories = {item.name: item.id for item in db.query(Category).all()}
        db.add_all([Food(name='Cơm gà', description='Cơm gà truyền thống', price=30000, stock=50, category_id=categories['Cơm']), Food(name='Phở bò', description='Phở bò nóng', price=35000, stock=40, category_id=categories['Món nước']), Food(name='Mì xào', description='Mì xào rau củ', price=28000, stock=35, category_id=categories['Ăn nhẹ']), Food(name='Nước cam', description='Nước cam tươi', price=15000, stock=60, category_id=categories['Đồ uống'])])
        db.commit()
    if not db.query(Ingredient).first():
        db.add_all([Ingredient(name='Gạo', unit='kg', quantity=50, min_quantity=10, cost_per_unit=18000), Ingredient(name='Thịt gà', unit='kg', quantity=25, min_quantity=5, cost_per_unit=65000), Ingredient(name='Thịt bò', unit='kg', quantity=18, min_quantity=4, cost_per_unit=220000)])
        db.commit()

def notify(db: Session, user_id: int, title: str, message: str) -> None:
    db.add(Notification(user_id=user_id, title=title, message=message))

def order_dict(order: Order) -> dict:
    return {'id': order.id, 'user_id': order.user_id, 'status': order.status, 'payment_status': order.payment_status, 'payment_method': order.payment_method, 'total': order.total, 'note': order.note, 'created_at': order.created_at, 'items': [{'food_id': item.food_id, 'name': item.food.name, 'quantity': item.quantity, 'price': item.price} for item in order.items]}
