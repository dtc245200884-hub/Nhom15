from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core import Ingredient, InventoryMovement, IngredientIn, StockMovementIn, get_db, roles
router = APIRouter()

@router.get('/api/ingredients')
def ingredients(db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    return db.query(Ingredient).order_by(Ingredient.name).all()

@router.post('/api/ingredients')
def ingredient_create(data: IngredientIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    x = Ingredient(**data.model_dump())
    db.add(x)
    db.commit()
    db.refresh(x)
    return x

@router.put('/api/ingredients/{id}')
def ingredient_update(id: int, data: IngredientIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    x = db.get(Ingredient, id)
    if not x:
        raise HTTPException(404, 'Không tìm thấy nguyên liệu')
    for k, v in data.model_dump().items():
        setattr(x, k, v)
    db.commit()
    return x

@router.post('/api/inventory/movement')
def inventory_movement(data: StockMovementIn, db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    x = db.get(Ingredient, data.ingredient_id)
    if not x:
        raise HTTPException(404, 'Không tìm thấy nguyên liệu')
    if data.movement_type not in ('in', 'out'):
        raise HTTPException(400, 'movement_type phải là in hoặc out')
    if data.movement_type == 'out' and x.quantity < data.quantity:
        raise HTTPException(400, 'Tồn kho nguyên liệu không đủ')
    x.quantity += data.quantity if data.movement_type == 'in' else -data.quantity
    db.add(InventoryMovement(**data.model_dump()))
    db.commit()
    return {'message': 'Đã cập nhật kho', 'quantity': x.quantity}

@router.get('/api/inventory/movements')
def inventory_movements(db: Session=Depends(get_db), u=Depends(roles('admin', 'staff'))):
    rows = db.query(InventoryMovement).order_by(InventoryMovement.created_at.desc()).limit(100).all()
    return [{'id': r.id, 'ingredient': r.ingredient.name, 'type': r.movement_type, 'quantity': r.quantity, 'note': r.note, 'created_at': r.created_at} for r in rows]
