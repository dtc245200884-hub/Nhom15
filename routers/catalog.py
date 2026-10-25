from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from core import Category, Food, Menu, MenuItem, CategoryIn, FoodIn, MenuIn, get_db, roles
router = APIRouter()

@router.get('/api/categories')
def categories(db: Session=Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()

@router.post('/api/categories')
def category(data: CategoryIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    if db.query(Category).filter(Category.name == data.name).first():
        raise HTTPException(400, 'Danh mục đã tồn tại')
    x = Category(**data.model_dump())
    db.add(x)
    db.commit()
    db.refresh(x)
    return x

@router.put('/api/categories/{id}')
def category_update(id: int, data: CategoryIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    x = db.get(Category, id)
    if not x:
        raise HTTPException(404, 'Không tìm thấy danh mục')
    x.name = data.name
    x.description = data.description
    db.commit()
    return x

@router.delete('/api/categories/{id}')
def category_delete(id: int, db: Session=Depends(get_db), u=Depends(roles('admin'))):
    x = db.get(Category, id)
    if not x:
        raise HTTPException(404, 'Không tìm thấy danh mục')
    if db.query(Food).filter(Food.category_id == id, Food.is_active == True).first():
        raise HTTPException(400, 'Danh mục đang có món, hãy chuyển món trước')
    db.delete(x)
    db.commit()
    return {'message': 'Đã xóa'}

@router.get('/api/foods')
def foods(search: str='', category_id: Optional[int]=None, min_price: Optional[float]=None, max_price: Optional[float]=None, in_stock: bool=False, db: Session=Depends(get_db)):
    if min_price is not None and min_price < 0:
        raise HTTPException(status_code=422, detail='min_price không được âm')
    if max_price is not None and max_price < 0:
        raise HTTPException(status_code=422, detail='max_price không được âm')
    if min_price is not None and max_price is not None and (min_price > max_price):
        raise HTTPException(status_code=422, detail='min_price phải nhỏ hơn hoặc bằng max_price')
    q = db.query(Food).filter(Food.is_active.is_(True))
    if search:
        q = q.filter(or_(Food.name.ilike(f'%{search}%'), Food.description.ilike(f'%{search}%')))
    if category_id:
        q = q.filter(Food.category_id == category_id)
    if min_price is not None:
        q = q.filter(Food.price >= min_price)
    if max_price is not None:
        q = q.filter(Food.price <= max_price)
    if in_stock:
        q = q.filter(Food.stock > 0)
    return q.order_by(Food.id.desc()).all()

@router.post('/api/foods')
def food_create(data: FoodIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    x = Food(**data.model_dump())
    db.add(x)
    db.commit()
    db.refresh(x)
    return x

@router.put('/api/foods/{id}')
def food_update(id: int, data: FoodIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    x = db.get(Food, id)
    if not x:
        raise HTTPException(404, 'Không tìm thấy món')
    for k, v in data.model_dump().items():
        setattr(x, k, v)
    db.commit()
    db.refresh(x)
    return x

@router.delete('/api/foods/{id}')
def food_delete(id: int, db: Session=Depends(get_db), u=Depends(roles('admin'))):
    x = db.get(Food, id)
    if not x:
        raise HTTPException(404, 'Không tìm thấy món')
    x.is_active = False
    db.commit()
    return {'message': 'Đã ẩn món'}

@router.get('/api/menus')
def menus(db: Session=Depends(get_db)):
    return [{'id': m.id, 'menu_date': m.menu_date, 'title': m.title, 'is_active': m.is_active, 'items': [{'id': i.id, 'food_id': i.food_id, 'name': i.food.name, 'price': i.food.price, 'stock': i.food.stock} for i in m.items]} for m in db.query(Menu).order_by(Menu.menu_date.desc()).all()]

@router.post('/api/menus')
def menu_create(data: MenuIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    x = Menu(**data.model_dump())
    db.add(x)
    db.commit()
    db.refresh(x)
    return x

@router.post('/api/menus/{menu_id}/items/{food_id}')
def menu_add(menu_id: int, food_id: int, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    if not db.get(Menu, menu_id) or not db.get(Food, food_id):
        raise HTTPException(404, 'Menu hoặc món không tồn tại')
    if db.query(MenuItem).filter(MenuItem.menu_id == menu_id, MenuItem.food_id == food_id).first():
        raise HTTPException(400, 'Món đã có trong thực đơn')
    db.add(MenuItem(menu_id=menu_id, food_id=food_id))
    db.commit()
    return {'message': 'Đã thêm món vào thực đơn'}

@router.delete('/api/menus/items/{item_id}')
def menu_item_delete(item_id: int, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    x = db.get(MenuItem, item_id)
    if not x:
        raise HTTPException(404, 'Không tìm thấy món trong thực đơn')
    db.delete(x)
    db.commit()
    return {'message': 'Đã xóa'}
