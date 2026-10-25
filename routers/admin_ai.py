from datetime import datetime, date, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from core import User, UserStatusIn, Order, OrderItem, Food, Ingredient, AILog, get_db, roles, current, AIQuestion
from services.canteen_analyzer import menu_facts, sales_facts
from services.ai_service import ask_ai
router = APIRouter()

@router.get('/api/users')
def users(db: Session=Depends(get_db), u=Depends(roles('admin'))):
    return [{'id': item.id, 'email': item.email, 'full_name': item.full_name, 'role': item.role, 'status': item.status, 'created_at': item.created_at} for item in db.query(User).order_by(User.created_at.desc()).all()]

@router.patch('/api/users/{id}/status')
def user_status(id: int, data: UserStatusIn, db: Session=Depends(get_db), u=Depends(roles('admin'))):
    x = db.get(User, id)
    if not x:
        raise HTTPException(404, 'Không tìm thấy người dùng')
    if x.id == u.id and data.status == 'blocked':
        raise HTTPException(status_code=400, detail='Không thể tự khóa tài khoản đang đăng nhập')
    if data.status not in ('active', 'blocked'):
        raise HTTPException(400, 'Trạng thái không hợp lệ')
    x.status = data.status
    db.commit()
    return {'status': x.status}

@router.get('/api/dashboard')
def dashboard(db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    total_orders = db.query(func.count(Order.id)).scalar() or 0
    revenue = db.query(func.sum(Order.total)).filter(Order.status != 'cancelled').scalar() or 0
    today = date.today()
    today_orders = db.query(func.count(Order.id)).filter(func.date(Order.created_at) == today, Order.status != 'cancelled').scalar() or 0
    today_revenue = db.query(func.sum(Order.total)).filter(func.date(Order.created_at) == today, Order.status != 'cancelled').scalar() or 0
    low_foods = db.query(func.count(Food.id)).filter(Food.is_active == True, Food.stock < 10).scalar() or 0
    top = db.query(OrderItem.food_id, func.sum(OrderItem.quantity).label('qty')).join(Order).filter(Order.status != 'cancelled').group_by(OrderItem.food_id).order_by(func.sum(OrderItem.quantity).desc()).limit(5).all()
    top_data = [{'food_id': x[0], 'quantity': int(x[1]), 'name': db.get(Food, x[0]).name} for x in top]
    low_ingredients = db.query(func.count(Ingredient.id)).filter(Ingredient.quantity <= Ingredient.min_quantity).scalar() or 0
    statuses = {s: db.query(func.count(Order.id)).filter(Order.status == s).scalar() or 0 for s in ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']}
    return {'total_orders': total_orders, 'revenue': revenue, 'today_orders': today_orders, 'today_revenue': today_revenue, 'low_stock': low_foods, 'low_ingredients': low_ingredients, 'top_foods': top_data, 'order_statuses': statuses}

@router.get('/api/reports/sales')
def sales_report(days: int=7, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    days = max(1, min(days, 90))
    start = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days - 1)
    rows = []
    for n in range(days):
        d = (start + timedelta(days=n)).date()
        count = db.query(func.count(Order.id)).filter(func.date(Order.created_at) == d, Order.status != 'cancelled').scalar() or 0
        rev = db.query(func.sum(Order.total)).filter(func.date(Order.created_at) == d, Order.status != 'cancelled').scalar() or 0
        rows.append({'date': str(d), 'orders': int(count), 'revenue': float(rev)})
    return rows

@router.post('/api/ai/recommend')
def ai_recommend(db: Session=Depends(get_db), u=Depends(current)):
    return {'answer': ask_ai('recommend', {'menu': menu_facts(db), 'sales': sales_facts(db)}, user_id=u.id, db=db)}

@router.post('/api/ai/forecast')
def ai_forecast(db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    return {'answer': ask_ai('forecast', {'menu': menu_facts(db), 'sales': sales_facts(db)}, user_id=u.id, db=db)}

@router.post('/api/ai/chat')
def ai_chat(data: AIQuestion, db: Session=Depends(get_db), u=Depends(current)):
    return {'answer': ask_ai('chat', {'menu': menu_facts(db), 'sales': sales_facts(db)}, data.question, u.id, db)}

@router.get('/api/ai/logs')
def ai_logs(db: Session=Depends(get_db), u=Depends(roles('admin'))):
    return db.query(AILog).order_by(AILog.created_at.desc()).limit(100).all()
