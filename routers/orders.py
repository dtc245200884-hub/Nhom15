from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core import Order, OrderItem, Food, Notification, Payment, StatusIn, PaymentIn, OrderIn, get_db, current, roles, order_dict, notify
router = APIRouter()

@router.post('/api/orders')
def order_create(data: OrderIn, db: Session=Depends(get_db), u=Depends(current)):
    if data.payment_method not in ('cash', 'transfer'):
        raise HTTPException(status_code=400, detail='Phương thức thanh toán không hợp lệ')
    quantities = {}
    for line in data.items:
        quantities[line.food_id] = quantities.get(line.food_id, 0) + line.quantity
    checked = []
    for food_id, quantity in quantities.items():
        food = db.get(Food, food_id)
        if not food or not food.is_active:
            raise HTTPException(status_code=404, detail='Món không tồn tại hoặc đã ngừng bán')
        if food.stock < quantity:
            raise HTTPException(status_code=400, detail=f'Món {food.name} không đủ tồn kho (còn {food.stock})')
        checked.append((food, quantity))
    order = Order(user_id=u.id, payment_method=data.payment_method, note=data.note.strip())
    db.add(order)
    try:
        db.flush()
        total = 0.0
        for food, quantity in checked:
            food.stock -= quantity
            db.add(OrderItem(order_id=order.id, food_id=food.id, quantity=quantity, price=food.price))
            total += food.price * quantity
        order.total = total
        db.add(Notification(user_id=u.id, title='Đặt món thành công', message=f'Đơn #{order.id} đã được tạo với tổng tiền {total:,.0f} đ.'))
        db.commit()
        db.refresh(order)
    except Exception:
        db.rollback()
        raise
    return order_dict(order)

@router.get('/api/orders')
def orders(status_filter: str='', db: Session=Depends(get_db), u=Depends(current)):
    q = db.query(Order)
    if u.role == 'student':
        q = q.filter(Order.user_id == u.id)
    if status_filter:
        q = q.filter(Order.status == status_filter)
    return [order_dict(o) for o in q.order_by(Order.created_at.desc()).limit(200).all()]

@router.get('/api/orders/{id}')
def order_detail(id: int, db: Session=Depends(get_db), u=Depends(current)):
    o = db.get(Order, id)
    if not o or (u.role == 'student' and o.user_id != u.id):
        raise HTTPException(404, 'Không tìm thấy đơn')
    return order_dict(o)

@router.patch('/api/orders/{id}/status')
def order_status(id: int, data: StatusIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    allowed = {'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'}
    if data.status not in allowed:
        raise HTTPException(400, 'Trạng thái không hợp lệ')
    o = db.get(Order, id)
    if not o:
        raise HTTPException(404, 'Không tìm thấy đơn')
    old = o.status
    o.status = data.status
    if data.status == 'cancelled' and old != 'cancelled':
        for item in o.items:
            item.food.stock += item.quantity
    elif old == 'cancelled' and data.status != 'cancelled':
        # Validate every line before changing any stock to avoid partial updates.
        for item in o.items:
            if item.food.stock < item.quantity:
                raise HTTPException(400, f'Không đủ tồn kho để mở lại đơn #{o.id}')
        for item in o.items:
            item.food.stock -= item.quantity
    db.add(Notification(user_id=o.user_id, title='Cập nhật đơn hàng', message=f'Đơn #{o.id}: {old} → {o.status}.'))
    db.commit()
    return {'message': 'Đã cập nhật', 'status': o.status}

@router.post('/api/orders/{id}/payment')
def payment(id: int, data: PaymentIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    o = db.get(Order, id)
    if not o:
        raise HTTPException(404, 'Không tìm thấy đơn')
    if data.status not in ('paid', 'unpaid', 'refunded'):
        raise HTTPException(400, 'Trạng thái thanh toán không hợp lệ')
    method = data.method or o.payment_method
    o.payment_status = data.status
    o.payment_method = method
    db.add(Payment(order_id=o.id, amount=o.total, method=method, status=data.status))
    db.add(Notification(user_id=o.user_id, title='Thanh toán', message=f'Đơn #{o.id}: {data.status}.'))
    db.commit()
    return {'payment_status': o.payment_status}

@router.get('/api/notifications')
def notifications(db: Session=Depends(get_db), u=Depends(current)):
    return db.query(Notification).filter(Notification.user_id == u.id).order_by(Notification.created_at.desc()).limit(50).all()

@router.patch('/api/notifications/{id}/read')
def notification_read(id: int, db: Session=Depends(get_db), u=Depends(current)):
    x = db.query(Notification).filter(Notification.id == id, Notification.user_id == u.id).first()
    if not x:
        raise HTTPException(404, 'Không tìm thấy thông báo')
    x.is_read = True
    db.commit()
    return {'message': 'Đã đọc'}
