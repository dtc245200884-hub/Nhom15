from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Date, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__='users'
    id=Column(Integer,primary_key=True,index=True); email=Column(String(255),unique=True,nullable=False,index=True)
    password_hash=Column(String(255),nullable=False); full_name=Column(String(150),nullable=False)
    role=Column(String(20),default='student',nullable=False); status=Column(String(20),default='active',nullable=False)
    created_at=Column(DateTime,default=datetime.utcnow)
    orders=relationship('Order',back_populates='user',cascade='all, delete-orphan'); ai_logs=relationship('AILog',back_populates='user',cascade='all, delete-orphan')
    notifications=relationship('Notification',back_populates='user',cascade='all, delete-orphan')

class Category(Base):
    __tablename__='categories'
    id=Column(Integer,primary_key=True,index=True); name=Column(String(100),unique=True,nullable=False); description=Column(String(300),default='')
    foods=relationship('Food',back_populates='category')

class Food(Base):
    __tablename__='foods'
    id=Column(Integer,primary_key=True,index=True); category_id=Column(Integer,ForeignKey('categories.id',ondelete='SET NULL'),nullable=True)
    name=Column(String(150),nullable=False,index=True); description=Column(Text,default=''); price=Column(Float,nullable=False)
    stock=Column(Integer,default=0,nullable=False); image=Column(String(500),default=''); is_active=Column(Boolean,default=True,nullable=False)
    created_at=Column(DateTime,default=datetime.utcnow); category=relationship('Category',back_populates='foods'); order_items=relationship('OrderItem',back_populates='food')

class Menu(Base):
    __tablename__='menus'
    id=Column(Integer,primary_key=True,index=True); menu_date=Column(Date,nullable=False,index=True); title=Column(String(200),nullable=False)
    is_active=Column(Boolean,default=True); items=relationship('MenuItem',back_populates='menu',cascade='all, delete-orphan')
class MenuItem(Base):
    __tablename__='menu_items'
    id=Column(Integer,primary_key=True); menu_id=Column(Integer,ForeignKey('menus.id',ondelete='CASCADE'),nullable=False); food_id=Column(Integer,ForeignKey('foods.id',ondelete='CASCADE'),nullable=False)
    menu=relationship('Menu',back_populates='items'); food=relationship('Food')

class Order(Base):
    __tablename__='orders'
    id=Column(Integer,primary_key=True,index=True); user_id=Column(Integer,ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    status=Column(String(30),default='pending',index=True); payment_status=Column(String(30),default='unpaid'); payment_method=Column(String(30),default='cash')
    total=Column(Float,default=0); note=Column(String(500),default=''); created_at=Column(DateTime,default=datetime.utcnow,index=True)
    user=relationship('User',back_populates='orders'); items=relationship('OrderItem',back_populates='order',cascade='all, delete-orphan')
class OrderItem(Base):
    __tablename__='order_items'
    id=Column(Integer,primary_key=True); order_id=Column(Integer,ForeignKey('orders.id',ondelete='CASCADE'),nullable=False); food_id=Column(Integer,ForeignKey('foods.id'),nullable=False)
    quantity=Column(Integer,nullable=False); price=Column(Float,nullable=False); order=relationship('Order',back_populates='items'); food=relationship('Food',back_populates='order_items')

class Ingredient(Base):
    __tablename__='ingredients'
    id=Column(Integer,primary_key=True,index=True); name=Column(String(150),nullable=False); unit=Column(String(30),nullable=False)
    quantity=Column(Float,default=0); min_quantity=Column(Float,default=0); cost_per_unit=Column(Float,default=0); updated_at=Column(DateTime,default=datetime.utcnow,onupdate=datetime.utcnow)
class InventoryMovement(Base):
    __tablename__='inventory_movements'
    id=Column(Integer,primary_key=True,index=True); ingredient_id=Column(Integer,ForeignKey('ingredients.id',ondelete='CASCADE'),nullable=False)
    movement_type=Column(String(20),nullable=False); quantity=Column(Float,nullable=False); note=Column(String(300),default=''); created_at=Column(DateTime,default=datetime.utcnow,index=True)
    ingredient=relationship('Ingredient')
class Payment(Base):
    __tablename__='payments'
    id=Column(Integer,primary_key=True,index=True); order_id=Column(Integer,ForeignKey('orders.id',ondelete='CASCADE'),nullable=False,index=True)
    amount=Column(Float,nullable=False); method=Column(String(30),nullable=False); status=Column(String(30),default='paid'); paid_at=Column(DateTime,default=datetime.utcnow)
    order=relationship('Order')
class Notification(Base):
    __tablename__='notifications'
    id=Column(Integer,primary_key=True,index=True); user_id=Column(Integer,ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    title=Column(String(200),nullable=False); message=Column(Text,nullable=False); is_read=Column(Boolean,default=False); created_at=Column(DateTime,default=datetime.utcnow)
    user=relationship('User',back_populates='notifications')
class AILog(Base):
    __tablename__='ai_logs'
    id=Column(Integer,primary_key=True,index=True); user_id=Column(Integer,ForeignKey('users.id',ondelete='CASCADE'),nullable=False)
    kind=Column(String(30),nullable=False); question=Column(Text,default=''); response=Column(Text,default=''); success=Column(Boolean,default=True); created_at=Column(DateTime,default=datetime.utcnow)
    user=relationship('User',back_populates='ai_logs')
Index('ix_order_user_date','orders','user_id','created_at')
