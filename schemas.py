"""Pydantic request schemas for the canteen API."""
from datetime import date
from typing import Optional, Literal
from pydantic import BaseModel, Field, EmailStr, field_validator

class Login(BaseModel):
    email: EmailStr
    password: str

class Register(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)

    @field_validator('full_name')
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        value = ' '.join(value.split())
        if len(value) < 2:
            raise ValueError('Họ tên phải có ít nhất 2 ký tự')
        return value

class FoodIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str = Field(default='', max_length=4000)
    price: float = Field(gt=0, allow_inf_nan=False)
    stock: int = Field(ge=0)
    category_id: Optional[int] = None
    image: str = Field(default='', max_length=500)
    is_active: bool = True

    @field_validator('name')
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = ' '.join(value.split())
        if not value:
            raise ValueError('Tên món không được để trống')
        return value

class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=300)

    @field_validator('name')
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = ' '.join(value.split())
        if not value:
            raise ValueError('Tên danh mục không được để trống')
        return value

class IngredientIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    unit: str = Field(min_length=1, max_length=30)
    quantity: float = Field(ge=0, allow_inf_nan=False)
    min_quantity: float = Field(ge=0, allow_inf_nan=False)
    cost_per_unit: float = Field(ge=0, allow_inf_nan=False)

    @field_validator('name', 'unit')
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = ' '.join(value.split())
        if not value:
            raise ValueError('Trường này không được để trống')
        return value

class StockMovementIn(BaseModel):
    ingredient_id: int
    movement_type: Literal['in', 'out']
    quantity: float = Field(gt=0)
    note: str = ''

class OrderLine(BaseModel):
    food_id: int
    quantity: int = Field(gt=0)

class OrderIn(BaseModel):
    items: list[OrderLine] = Field(min_length=1, max_length=50)
    payment_method: Literal['cash', 'transfer'] = 'cash'
    note: str = Field(default='', max_length=500)

class StatusIn(BaseModel):
    status: Literal['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']

class PaymentIn(BaseModel):
    status: Literal['paid', 'unpaid', 'refunded'] = 'paid'
    method: Optional[Literal['cash', 'transfer']] = None

class AIQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=4000)

class MenuIn(BaseModel):
    menu_date: date
    title: str = Field(min_length=1, max_length=200)

    @field_validator('title')
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = ' '.join(value.split())
        if not value:
            raise ValueError('Tên thực đơn không được để trống')
        return value

class UserStatusIn(BaseModel):
    status: Literal['active', 'blocked']
