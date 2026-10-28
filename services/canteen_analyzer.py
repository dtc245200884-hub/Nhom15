from sqlalchemy import func
from models import Food, OrderItem

def menu_facts(db):
    foods=db.query(Food).filter(Food.is_active==True).all()
    return [{"id":f.id,"name":f.name,"price":f.price,"stock":f.stock,"category":f.category.name if f.category else None} for f in foods]

def sales_facts(db):
    rows=(db.query(OrderItem.food_id, Food.name, Food.price, func.sum(OrderItem.quantity))
          .join(Food, Food.id==OrderItem.food_id)
          .group_by(OrderItem.food_id, Food.name, Food.price).all())
    return [{"food_id":r[0],"name":r[1],"price":r[2],"quantity":int(r[3] or 0)} for r in rows]
