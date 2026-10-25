"""Application entry point for the School Canteen AI system."""
import logging
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from core import Base, ENVIRONMENT, engine, seed
from routers import auth, catalog, inventory, orders, admin_ai

logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO').upper())
BASE_DIR = Path(__file__).resolve().parent
app = FastAPI(title='Canteen AI - Nhóm 15', version='3.1.0', description='Hệ thống quản lý căng tin trường học tích hợp AI')
allowed_origins = [item.strip() for item in os.getenv('CORS_ORIGINS', 'http://127.0.0.1:8000,http://localhost:8000').split(',') if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_credentials=True, allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allow_headers=['Authorization', 'Content-Type'])

Base.metadata.create_all(bind=engine)
if ENVIRONMENT == 'development':
    with Session(engine) as session:
        seed(session)

for route_module in (auth, catalog, inventory, orders, admin_ai):
    app.include_router(route_module.router)

app.mount('/static', StaticFiles(directory=str(BASE_DIR / 'static')), name='static')

@app.get('/favicon.ico', include_in_schema=False)
def favicon():
    return FileResponse(BASE_DIR / 'static' / 'favicon.svg', media_type='image/svg+xml')

@app.get('/')
def root():
    return FileResponse(BASE_DIR / 'static' / 'index.html')

@app.get('/login')
def login_page():
    return FileResponse(BASE_DIR / 'static' / 'login.html')

@app.get('/register')
def register_page():
    return FileResponse(BASE_DIR / 'static' / 'register.html')

@app.get('/admin')
def admin_page():
    return FileResponse(BASE_DIR / 'static' / 'admin.html')
