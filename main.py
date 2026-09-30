import os
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from dotenv import load_dotenv
from database import Base, engine, get_db
from models import User, Category, Food, Menu, MenuItem, Order, OrderItem, Ingredient, InventoryMovement, Payment, Notification, AILog
from services.canteen_analyzer import menu_facts, sales_facts
from services.ai_service import ask_ai

load_dotenv(); SECRET_KEY=os.getenv('SECRET_KEY','nhom15-canteen-secret-key-change-me'); ALGORITHM='HS256'; ACCESS_TOKEN_EXPIRE_DAYS=int(os.getenv('ACCESS_TOKEN_EXPIRE_DAYS','30'))
pwd=CryptContext(schemes=['bcrypt'],deprecated='auto'); oauth=OAuth2PasswordBearer(tokenUrl='/api/auth/login')
app=FastAPI(title='Canteen AI - Nhom 15',version='3.0.0')
app.add_middleware(CORSMiddleware,allow_origins=['*'],allow_credentials=True,allow_methods=['*'],allow_headers=['*'])

class Login(BaseModel): email:EmailStr; password:str
class Register(BaseModel): email:EmailStr; password:str=Field(min_length=6); full_name:str=Field(min_length=2)
class FoodIn(BaseModel): name:str; description:str=''; price:float=Field(gt=0); stock:int=Field(ge=0); category_id:Optional[int]=None; image:str=''; is_active:bool=True
class CategoryIn(BaseModel): name:str; description:str=''
class IngredientIn(BaseModel): name:str; unit:str; quantity:float=Field(ge=0); min_quantity:float=Field(ge=0); cost_per_unit:float=Field(ge=0)
class StockMovementIn(BaseModel): ingredient_id:int; movement_type:str; quantity:float=Field(gt=0); note:str=''
class OrderLine(BaseModel): food_id:int; quantity:int=Field(gt=0)
class OrderIn(BaseModel): items:list[OrderLine]; payment_method:str='cash'; note:str=''
class StatusIn(BaseModel): status:str
class PaymentIn(BaseModel): status:str='paid'; method:Optional[str]=None
class AIQuestion(BaseModel): question:str=Field(min_length=1,max_length=4000)
class MenuIn(BaseModel): menu_date:date; title:str
class UserStatusIn(BaseModel): status:str

Base.metadata.create_all(bind=engine)
def hashpw(x): return pwd.hash(x)
def verify(x,h): return pwd.verify(x,h)
def token(user):
    now=datetime.utcnow(); exp=now+timedelta(days=max(1,ACCESS_TOKEN_EXPIRE_DAYS))
    return jwt.encode({'sub':str(user.id),'role':user.role,'iat':now,'exp':exp},SECRET_KEY,algorithm=ALGORITHM)
def current(token_value=Depends(oauth),db:Session=Depends(get_db)):
    try: uid=int(jwt.decode(token_value,SECRET_KEY,algorithms=[ALGORITHM]).get('sub'))
    except (JWTError,TypeError,ValueError): raise HTTPException(401,'Token không hợp lệ')
    user=db.get(User,uid)
    if not user or user.status!='active': raise HTTPException(401,'Tài khoản không khả dụng')
    return user
def roles(*allowed):
    def dep(user=Depends(current)):
        if user.role not in allowed: raise HTTPException(403,'Bạn không có quyền')
        return user
    return dep

def seed(db):
    if not db.query(User).first():
        db.add_all([User(email='admin@school.vn',password_hash=hashpw('Admin@123'),full_name='Quản trị viên',role='admin'),User(email='staff@school.vn',password_hash=hashpw('Staff@123'),full_name='Nhân viên căng tin',role='staff'),User(email='student@school.vn',password_hash=hashpw('Student@123'),full_name='Nguyễn Văn A',role='student')]); db.commit()
    if not db.query(Category).first(): db.add_all([Category(name='Cơm',description='Các món cơm'),Category(name='Món nước'),Category(name='Đồ uống'),Category(name='Ăn nhẹ')]); db.commit()
    if not db.query(Food).first():
        c={x.name:x.id for x in db.query(Category).all()}; db.add_all([Food(name='Cơm gà',description='Cơm gà truyền thống',price=30000,stock=50,category_id=c['Cơm']),Food(name='Phở bò',description='Phở bò nóng',price=35000,stock=40,category_id=c['Món nước']),Food(name='Mì xào',description='Mì xào rau củ',price=28000,stock=35,category_id=c['Ăn nhẹ']),Food(name='Nước cam',description='Nước cam tươi',price=15000,stock=60,category_id=c['Đồ uống'])]); db.commit()
    if not db.query(Ingredient).first(): db.add_all([Ingredient(name='Gạo',unit='kg',quantity=50,min_quantity=10,cost_per_unit=18000),Ingredient(name='Thịt gà',unit='kg',quantity=25,min_quantity=5,cost_per_unit=65000),Ingredient(name='Thịt bò',unit='kg',quantity=18,min_quantity=4,cost_per_unit=220000)]); db.commit()
with Session(engine) as db: seed(db)

def notify(db,user_id,title,message): db.add(Notification(user_id=user_id,title=title,message=message)); db.commit()

def order_dict(o): return {'id':o.id,'user_id':o.user_id,'status':o.status,'payment_status':o.payment_status,'payment_method':o.payment_method,'total':o.total,'note':o.note,'created_at':o.created_at,'items':[{'food_id':i.food_id,'name':i.food.name,'quantity':i.quantity,'price':i.price} for i in o.items]}

@app.get('/api/health')
def health(): return {'status':'ok','project':'Nhom15 Canteen AI','version':'3.0.0','python':True}
@app.post('/api/auth/register')
def register(data:Register,db:Session=Depends(get_db)):
    email=str(data.email).lower()
    if db.query(User).filter(User.email==email).first(): raise HTTPException(400,'Email đã tồn tại')
    u=User(email=email,password_hash=hashpw(data.password),full_name=' '.join(data.full_name.split()),role='student'); db.add(u); db.commit(); db.refresh(u); return {'access_token':token(u),'token_type':'bearer','role':u.role,'full_name':u.full_name,'email':u.email}
@app.post('/api/auth/login')
def login(data:Login,db:Session=Depends(get_db)):
    u=db.query(User).filter(User.email==str(data.email).lower()).first()
    if not u or not verify(data.password,u.password_hash): raise HTTPException(401,'Email hoặc mật khẩu không đúng')
    return {'access_token':token(u),'token_type':'bearer','role':u.role,'full_name':u.full_name,'email':u.email}
@app.get('/api/auth/me')
def me(u=Depends(current)): return {'id':u.id,'email':u.email,'full_name':u.full_name,'role':u.role,'status':u.status}

@app.get('/api/categories')
def categories(db:Session=Depends(get_db)): return db.query(Category).order_by(Category.name).all()
@app.post('/api/categories')
def category(data:CategoryIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    if db.query(Category).filter(Category.name==data.name).first(): raise HTTPException(400,'Danh mục đã tồn tại')
    x=Category(**data.model_dump()); db.add(x); db.commit(); db.refresh(x); return x
@app.put('/api/categories/{id}')
def category_update(id:int,data:CategoryIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    x=db.get(Category,id)
    if not x: raise HTTPException(404,'Không tìm thấy danh mục')
    x.name=data.name; x.description=data.description; db.commit(); return x
@app.delete('/api/categories/{id}')
def category_delete(id:int,db:Session=Depends(get_db),u=Depends(roles('admin'))):
    x=db.get(Category,id)
    if not x: raise HTTPException(404,'Không tìm thấy danh mục')
    if db.query(Food).filter(Food.category_id==id,Food.is_active==True).first(): raise HTTPException(400,'Danh mục đang có món, hãy chuyển món trước')
    db.delete(x); db.commit(); return {'message':'Đã xóa'}

@app.get('/api/foods')
def foods(search:str='',category_id:Optional[int]=None,min_price:Optional[float]=None,max_price:Optional[float]=None,in_stock:bool=False,db:Session=Depends(get_db)):
    q=db.query(Food).filter(Food.is_active==True)
    if search: q=q.filter(or_(Food.name.ilike(f'%{search}%'),Food.description.ilike(f'%{search}%')))
    if category_id: q=q.filter(Food.category_id==category_id)
    if min_price is not None: q=q.filter(Food.price>=min_price)
    if max_price is not None: q=q.filter(Food.price<=max_price)
    if in_stock: q=q.filter(Food.stock>0)
    return q.order_by(Food.id.desc()).all()
@app.post('/api/foods')
def food_create(data:FoodIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    x=Food(**data.model_dump()); db.add(x); db.commit(); db.refresh(x); return x
@app.put('/api/foods/{id}')
def food_update(id:int,data:FoodIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    x=db.get(Food,id)
    if not x: raise HTTPException(404,'Không tìm thấy món')
    for k,v in data.model_dump().items(): setattr(x,k,v)
    db.commit(); db.refresh(x); return x
@app.delete('/api/foods/{id}')
def food_delete(id:int,db:Session=Depends(get_db),u=Depends(roles('admin'))):
    x=db.get(Food,id)
    if not x: raise HTTPException(404,'Không tìm thấy món')
    x.is_active=False; db.commit(); return {'message':'Đã ẩn món'}

@app.get('/api/menus')
def menus(db:Session=Depends(get_db)):
    return [{'id':m.id,'menu_date':m.menu_date,'title':m.title,'is_active':m.is_active,'items':[{'id':i.id,'food_id':i.food_id,'name':i.food.name,'price':i.food.price,'stock':i.food.stock} for i in m.items]} for m in db.query(Menu).order_by(Menu.menu_date.desc()).all()]
@app.post('/api/menus')
def menu_create(data:MenuIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    x=Menu(**data.model_dump()); db.add(x); db.commit(); db.refresh(x); return x
@app.post('/api/menus/{menu_id}/items/{food_id}')
def menu_add(menu_id:int,food_id:int,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    if not db.get(Menu,menu_id) or not db.get(Food,food_id): raise HTTPException(404,'Menu hoặc món không tồn tại')
    if db.query(MenuItem).filter(MenuItem.menu_id==menu_id,MenuItem.food_id==food_id).first(): raise HTTPException(400,'Món đã có trong thực đơn')
    db.add(MenuItem(menu_id=menu_id,food_id=food_id)); db.commit(); return {'message':'Đã thêm món vào thực đơn'}
@app.delete('/api/menus/items/{item_id}')
def menu_item_delete(item_id:int,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    x=db.get(MenuItem,item_id)
    if not x: raise HTTPException(404,'Không tìm thấy món trong thực đơn')
    db.delete(x); db.commit(); return {'message':'Đã xóa'}

@app.get('/api/ingredients')
def ingredients(db:Session=Depends(get_db),u=Depends(roles('admin','staff'))): return db.query(Ingredient).order_by(Ingredient.name).all()
@app.post('/api/ingredients')
def ingredient_create(data:IngredientIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    x=Ingredient(**data.model_dump()); db.add(x); db.commit(); db.refresh(x); return x
@app.put('/api/ingredients/{id}')
def ingredient_update(id:int,data:IngredientIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    x=db.get(Ingredient,id)
    if not x: raise HTTPException(404,'Không tìm thấy nguyên liệu')
    for k,v in data.model_dump().items(): setattr(x,k,v)
    db.commit(); return x
@app.post('/api/inventory/movement')
def inventory_movement(data:StockMovementIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    x=db.get(Ingredient,data.ingredient_id)
    if not x: raise HTTPException(404,'Không tìm thấy nguyên liệu')
    if data.movement_type not in ('in','out'): raise HTTPException(400,'movement_type phải là in hoặc out')
    if data.movement_type=='out' and x.quantity<data.quantity: raise HTTPException(400,'Tồn kho nguyên liệu không đủ')
    x.quantity += data.quantity if data.movement_type=='in' else -data.quantity
    db.add(InventoryMovement(**data.model_dump())); db.commit(); return {'message':'Đã cập nhật kho','quantity':x.quantity}
@app.get('/api/inventory/movements')
def inventory_movements(db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    rows=db.query(InventoryMovement).order_by(InventoryMovement.created_at.desc()).limit(100).all()
    return [{'id':r.id,'ingredient':r.ingredient.name,'type':r.movement_type,'quantity':r.quantity,'note':r.note,'created_at':r.created_at} for r in rows]

@app.post('/api/orders')
def order_create(data:OrderIn,db:Session=Depends(get_db),u=Depends(current)):
    if not data.items: raise HTTPException(400,'Đơn hàng trống')
    if data.payment_method not in ('cash','transfer'): raise HTTPException(400,'Phương thức thanh toán không hợp lệ')
    # Validate the whole cart BEFORE changing stock, so one bad item cannot
    # leave a partially-created order or partially-deducted inventory.
    checked=[]
    for line in data.items:
        f=db.get(Food,line.food_id)
        if not f or not f.is_active: raise HTTPException(404,'Món không tồn tại hoặc đã ngừng bán')
        if f.stock<line.quantity: raise HTTPException(400,f'Món {f.name} không đủ tồn kho (còn {f.stock})')
        checked.append((line,f))
    o=Order(user_id=u.id,payment_method=data.payment_method,note=data.note); db.add(o); db.flush(); total=0
    for line,f in checked:
        f.stock-=line.quantity
        db.add(OrderItem(order_id=o.id,food_id=f.id,quantity=line.quantity,price=f.price))
        total+=f.price*line.quantity
    o.total=total
    db.add(Notification(user_id=u.id,title='Đặt món thành công',message=f'Đơn #{o.id} đã được tạo với tổng tiền {total:,.0f} đ.'))
    db.commit(); db.refresh(o)
    return order_dict(o)
@app.get('/api/orders')
def orders(status_filter:str='',db:Session=Depends(get_db),u=Depends(current)):
    q=db.query(Order)
    if u.role=='student': q=q.filter(Order.user_id==u.id)
    if status_filter: q=q.filter(Order.status==status_filter)
    return [order_dict(o) for o in q.order_by(Order.created_at.desc()).limit(200).all()]
@app.get('/api/orders/{id}')
def order_detail(id:int,db:Session=Depends(get_db),u=Depends(current)):
    o=db.get(Order,id)
    if not o or (u.role=='student' and o.user_id!=u.id): raise HTTPException(404,'Không tìm thấy đơn')
    return order_dict(o)
@app.patch('/api/orders/{id}/status')
def order_status(id:int,data:StatusIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    allowed={'pending','confirmed','preparing','ready','completed','cancelled'}
    if data.status not in allowed: raise HTTPException(400,'Trạng thái không hợp lệ')
    o=db.get(Order,id)
    if not o: raise HTTPException(404,'Không tìm thấy đơn')
    old=o.status; o.status=data.status
    if data.status=='cancelled' and old!='cancelled':
        for item in o.items: item.food.stock += item.quantity
    if old=='cancelled' and data.status!='cancelled':
        for item in o.items:
            if item.food.stock<item.quantity: raise HTTPException(400,f'Không đủ tồn kho để mở lại đơn #{o.id}')
            item.food.stock -= item.quantity
    db.commit(); notify(db,o.user_id,'Cập nhật đơn hàng',f'Đơn #{o.id}: {old} → {o.status}.'); return {'message':'Đã cập nhật','status':o.status}
@app.post('/api/orders/{id}/payment')
def payment(id:int,data:PaymentIn,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    o=db.get(Order,id)
    if not o: raise HTTPException(404,'Không tìm thấy đơn')
    if data.status not in ('paid','unpaid','refunded'): raise HTTPException(400,'Trạng thái thanh toán không hợp lệ')
    method=data.method or o.payment_method; o.payment_status=data.status; o.payment_method=method
    db.add(Payment(order_id=o.id,amount=o.total,method=method,status=data.status)); db.commit(); notify(db,o.user_id,'Thanh toán',f'Đơn #{o.id}: {data.status}.'); return {'payment_status':o.payment_status}

@app.get('/api/notifications')
def notifications(db:Session=Depends(get_db),u=Depends(current)):
    return db.query(Notification).filter(Notification.user_id==u.id).order_by(Notification.created_at.desc()).limit(50).all()
@app.patch('/api/notifications/{id}/read')
def notification_read(id:int,db:Session=Depends(get_db),u=Depends(current)):
    x=db.query(Notification).filter(Notification.id==id,Notification.user_id==u.id).first()
    if not x: raise HTTPException(404,'Không tìm thấy thông báo')
    x.is_read=True; db.commit(); return {'message':'Đã đọc'}

@app.get('/api/users')
def users(db:Session=Depends(get_db),u=Depends(roles('admin'))): return db.query(User).order_by(User.created_at.desc()).all()
@app.patch('/api/users/{id}/status')
def user_status(id:int,data:UserStatusIn,db:Session=Depends(get_db),u=Depends(roles('admin'))):
    x=db.get(User,id)
    if not x: raise HTTPException(404,'Không tìm thấy người dùng')
    if data.status not in ('active','blocked'): raise HTTPException(400,'Trạng thái không hợp lệ')
    x.status=data.status; db.commit(); return {'status':x.status}

@app.get('/api/dashboard')
def dashboard(db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    total_orders=db.query(func.count(Order.id)).scalar() or 0; revenue=db.query(func.sum(Order.total)).filter(Order.status!='cancelled').scalar() or 0
    today=date.today(); today_orders=db.query(func.count(Order.id)).filter(func.date(Order.created_at)==today,Order.status!='cancelled').scalar() or 0
    today_revenue=db.query(func.sum(Order.total)).filter(func.date(Order.created_at)==today,Order.status!='cancelled').scalar() or 0
    low_foods=db.query(func.count(Food.id)).filter(Food.is_active==True,Food.stock<10).scalar() or 0
    top=db.query(OrderItem.food_id,func.sum(OrderItem.quantity).label('qty')).join(Order).filter(Order.status!='cancelled').group_by(OrderItem.food_id).order_by(func.sum(OrderItem.quantity).desc()).limit(5).all()
    top_data=[{'food_id':x[0],'quantity':int(x[1]),'name':db.get(Food,x[0]).name} for x in top]
    low_ingredients=db.query(func.count(Ingredient.id)).filter(Ingredient.quantity<=Ingredient.min_quantity).scalar() or 0
    statuses={s:(db.query(func.count(Order.id)).filter(Order.status==s).scalar() or 0) for s in ['pending','confirmed','preparing','ready','completed','cancelled']}
    return {'total_orders':total_orders,'revenue':revenue,'today_orders':today_orders,'today_revenue':today_revenue,'low_stock':low_foods,'low_ingredients':low_ingredients,'top_foods':top_data,'order_statuses':statuses}

@app.get('/api/reports/sales')
def sales_report(days:int=7,db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    days=max(1,min(days,90)); start=datetime.utcnow()-timedelta(days=days-1); rows=[]
    for n in range(days):
        d=(start+timedelta(days=n)).date(); count=db.query(func.count(Order.id)).filter(func.date(Order.created_at)==d,Order.status!='cancelled').scalar() or 0; rev=db.query(func.sum(Order.total)).filter(func.date(Order.created_at)==d,Order.status!='cancelled').scalar() or 0
        rows.append({'date':str(d),'orders':int(count),'revenue':float(rev)})
    return rows

@app.post('/api/ai/recommend')
def ai_recommend(db:Session=Depends(get_db),u=Depends(current)):
    return {'answer':ask_ai('recommend',{'menu':menu_facts(db),'sales':sales_facts(db)},user_id=u.id,db=db)}
@app.post('/api/ai/forecast')
def ai_forecast(db:Session=Depends(get_db),u=Depends(roles('admin','staff'))):
    return {'answer':ask_ai('forecast',{'menu':menu_facts(db),'sales':sales_facts(db)},user_id=u.id,db=db)}
@app.post('/api/ai/chat')
def ai_chat(data:AIQuestion,db:Session=Depends(get_db),u=Depends(current)):
    return {'answer':ask_ai('chat',{'menu':menu_facts(db),'sales':sales_facts(db)},data.question,u.id,db)}
@app.get('/api/ai/logs')
def ai_logs(db:Session=Depends(get_db),u=Depends(roles('admin'))): return db.query(AILog).order_by(AILog.created_at.desc()).limit(100).all()

app.mount('/static',StaticFiles(directory='static'),name='static')
@app.get('/favicon.ico', include_in_schema=False)
def favicon(): return FileResponse('static/favicon.svg', media_type='image/svg+xml')

@app.get('/')
def root(): return FileResponse('static/index.html')
@app.get('/login')
def login_page(): return FileResponse('static/login.html')
@app.get('/register')
def register_page(): return FileResponse('static/register.html')
@app.get('/admin')
def admin_page(): return FileResponse('static/admin.html')
