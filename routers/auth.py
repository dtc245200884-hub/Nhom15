from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, or_, update
from sqlalchemy.orm import Session
from core import User, Login, Register, ENVIRONMENT, get_demo_credentials, get_db, hashpw, verify, token, current
router = APIRouter()

@router.get('/api/health')
def health():
    return {'status': 'ok', 'project': 'Nhom15 Canteen AI', 'version': '3.1.0', 'python': True}

@router.get('/api/auth/demo-credentials')
def demo_credentials():
    if ENVIRONMENT != 'development':
        raise HTTPException(status_code=404, detail='Not found')
    credentials = get_demo_credentials()
    if not credentials:
        raise HTTPException(status_code=404, detail='Not found')
    return {'accounts': credentials}

@router.post('/api/auth/register')
def register(data: Register, db: Session=Depends(get_db)):
    email = str(data.email).lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, 'Email đã tồn tại')
    u = User(email=email, password_hash=hashpw(data.password), full_name=' '.join(data.full_name.split()), role='student')
    db.add(u)
    db.commit()
    db.refresh(u)
    return {'access_token': token(u), 'token_type': 'bearer', 'role': u.role, 'full_name': u.full_name, 'email': u.email}

@router.post('/api/auth/login')
def login(data: Login, db: Session=Depends(get_db)):
    u = db.query(User).filter(User.email == str(data.email).lower()).with_for_update().first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not u or (u.locked_until is not None and u.locked_until > now):
        raise HTTPException(status_code=401, detail='Email hoặc mật khẩu không đúng')
    if not verify(data.password, u.password_hash):
        expired_lock = and_(User.locked_until.is_not(None), User.locked_until <= now)
        next_count = case(
            (expired_lock, 1),
            else_=User.failed_login_count + 1,
        )
        db.execute(
            update(User)
            .where(
                User.id == u.id,
                or_(User.locked_until.is_(None), User.locked_until <= now),
            )
            .values(
                failed_login_count=next_count,
                locked_until=case(
                    (next_count >= 5, now + timedelta(minutes=15)),
                    else_=None,
                ),
            )
            .execution_options(synchronize_session=False)
        )
        db.commit()
        raise HTTPException(status_code=401, detail='Email hoặc mật khẩu không đúng')
    if u.status != 'active':
        raise HTTPException(status_code=403, detail='Tài khoản đã bị khóa')
    db.execute(
        update(User)
        .where(
            User.id == u.id,
            User.status == 'active',
            or_(User.locked_until.is_(None), User.locked_until <= now),
        )
        .values(failed_login_count=0, locked_until=None)
        .execution_options(synchronize_session=False)
    )
    db.expire(u, ['status', 'locked_until'])
    if u.status != 'active':
        db.rollback()
        raise HTTPException(status_code=403, detail='Tài khoản đã bị khóa')
    if u.locked_until is not None and u.locked_until > now:
        db.rollback()
        raise HTTPException(status_code=401, detail='Email hoặc mật khẩu không đúng')
    db.commit()
    return {'access_token': token(u), 'token_type': 'bearer', 'role': u.role, 'full_name': u.full_name, 'email': u.email}

@router.get('/api/auth/me')
def me(u=Depends(current)):
    return {'id': u.id, 'email': u.email, 'full_name': u.full_name, 'role': u.role, 'status': u.status}
