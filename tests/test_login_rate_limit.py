import importlib.util
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from threading import Barrier

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

PROJECT_ROOT = Path(__file__).resolve().parents[1]
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['ENVIRONMENT'] = 'test'
os.environ['SECRET_KEY'] = 'isolated-login-rate-test-key'

from core import User, hashpw
from database import Base
import routers.auth as auth_module
from schemas import Login

MIGRATION_PATH = PROJECT_ROOT / 'migrations' / '006_login_bruteforce.py'
MIGRATION_SPEC = importlib.util.spec_from_file_location('login_bruteforce_migration', MIGRATION_PATH)
assert MIGRATION_SPEC is not None and MIGRATION_SPEC.loader is not None
migration = importlib.util.module_from_spec(MIGRATION_SPEC)
MIGRATION_SPEC.loader.exec_module(migration)

TEST_EMAIL = 'lockout-test@example.com'
TEST_PASSWORD = 'Correct-Test-Password-42'
WRONG_PASSWORD = 'Wrong-Test-Password'


@pytest.fixture
def login_sessions():
    engine = create_engine(
        'sqlite://',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=True)
    db = factory()
    user = User(
        email=TEST_EMAIL,
        password_hash=hashpw(TEST_PASSWORD),
        full_name='Isolated Test',
        role='student',
    )
    db.add(user)
    db.commit()
    user_id = user.id
    try:
        yield db, factory, user_id
    finally:
        db.close()
        engine.dispose()


def assert_login_error(data, db, status_code=401):
    with pytest.raises(HTTPException) as caught:
        auth_module.login(data, db)
    assert caught.value.status_code == status_code
    return caught.value.detail


@pytest.mark.parametrize(
    'existing_columns',
    [
        set(),
        {'failed_login_count'},
        {'locked_until'},
        {'failed_login_count', 'locked_until'},
    ],
    ids=['neither-column', 'only-counter', 'only-lock-time', 'both-columns'],
)
def test_migration_is_idempotent_and_preserves_existing_user(tmp_path, monkeypatch, existing_columns):
    database_path = tmp_path / 'migration.sqlite'
    engine = create_engine(f'sqlite:///{database_path}')
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                'CREATE TABLE users ('
                'id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL, '
                'full_name TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, created_at DATETIME'
                ')'
            )
            if 'failed_login_count' in existing_columns:
                connection.exec_driver_sql(
                    'ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0'
                )
            if 'locked_until' in existing_columns:
                connection.exec_driver_sql('ALTER TABLE users ADD COLUMN locked_until DATETIME NULL')
            connection.execute(
                text(
                    'INSERT INTO users '
                    '(id, email, password_hash, full_name, role, status, created_at'
                    + (', failed_login_count' if 'failed_login_count' in existing_columns else '')
                    + (', locked_until' if 'locked_until' in existing_columns else '')
                    + ') VALUES (1, :email, :password_hash, :full_name, :role, :status, :created_at'
                    + (', 3' if 'failed_login_count' in existing_columns else '')
                    + (", '2030-01-02 03:04:05'" if 'locked_until' in existing_columns else '')
                    + ')'
                ),
                {
                    'email': 'preserved@example.com',
                    'password_hash': 'existing-hash',
                    'full_name': 'Existing User',
                    'role': 'student',
                    'status': 'active',
                    'created_at': '2025-01-02 03:04:05',
                },
            )

        monkeypatch.setattr(migration, 'engine', engine)
        migration.upgrade()
        migration.upgrade()

        inspector = inspect(engine)
        columns = {column['name'] for column in inspector.get_columns('users')}
        assert {'failed_login_count', 'locked_until'} <= columns
        with engine.connect() as connection:
            user = connection.execute(text('SELECT * FROM users WHERE id=1')).mappings().one()
        assert user['email'] == 'preserved@example.com'
        assert user['password_hash'] == 'existing-hash'
        assert user['full_name'] == 'Existing User'
        assert user['role'] == 'student'
        assert user['status'] == 'active'
        if 'failed_login_count' in existing_columns:
            assert user['failed_login_count'] == 3
        else:
            assert user['failed_login_count'] == 0
        if 'locked_until' in existing_columns:
            assert user['locked_until'] == '2030-01-02 03:04:05'
        else:
            assert user['locked_until'] is None
    finally:
        engine.dispose()


def test_fifth_failed_login_locks_for_fifteen_minutes(login_sessions):
    db, _, user_id = login_sessions
    credentials = Login(email=TEST_EMAIL, password=WRONG_PASSWORD)

    for expected_count in range(1, 5):
        assert_login_error(credentials, db)
        db.expire_all()
        user = db.get(User, user_id)
        assert user.failed_login_count == expected_count
        assert user.locked_until is None

    assert_login_error(credentials, db)
    db.expire_all()
    user = db.get(User, user_id)
    now = datetime.utcnow()
    assert user.failed_login_count == 5
    assert now + timedelta(minutes=14) < user.locked_until < now + timedelta(minutes=16)


def test_locked_and_unknown_accounts_have_same_response_and_no_token(login_sessions):
    db, _, user_id = login_sessions
    wrong = Login(email=TEST_EMAIL, password=WRONG_PASSWORD)
    for _ in range(5):
        assert_login_error(wrong, db)
    db.expire_all()
    locked_user = db.get(User, user_id)
    locked_user_detail = assert_login_error(Login(email=TEST_EMAIL, password=TEST_PASSWORD), db)
    unknown_user_detail = assert_login_error(
        Login(email='unknown-test@example.com', password=WRONG_PASSWORD),
        db,
    )
    assert locked_user_detail == unknown_user_detail
    assert locked_user.failed_login_count == 5


def test_expired_lock_allows_retry_and_success_resets_state(login_sessions):
    db, _, user_id = login_sessions
    for _ in range(5):
        assert_login_error(Login(email=TEST_EMAIL, password=WRONG_PASSWORD), db)
    db.query(User).filter(User.id == user_id).update(
        {User.locked_until: datetime.utcnow() - timedelta(seconds=1)},
        synchronize_session=False,
    )
    db.commit()

    assert_login_error(Login(email=TEST_EMAIL, password=WRONG_PASSWORD), db)
    db.expire_all()
    user = db.get(User, user_id)
    assert user.failed_login_count == 1
    assert user.locked_until is None

    result = auth_module.login(Login(email=TEST_EMAIL, password=TEST_PASSWORD), db)
    assert result['token_type'] == 'bearer'
    db.expire_all()
    user = db.get(User, user_id)
    assert user.failed_login_count == 0
    assert user.locked_until is None


def test_blocked_user_keeps_forbidden_response(login_sessions):
    db, _, _ = login_sessions
    blocked = User(
        email='blocked-test@example.com',
        password_hash=hashpw(TEST_PASSWORD),
        full_name='Blocked Test',
        role='student',
        status='blocked',
    )
    db.add(blocked)
    db.commit()

    assert_login_error(Login(email=blocked.email, password=TEST_PASSWORD), db, status_code=403)


def test_database_commit_error_can_be_rolled_back_without_persisting_counter(login_sessions):
    db, factory, user_id = login_sessions

    def fail_before_commit(session):
        raise RuntimeError('isolated simulated database commit failure')

    from sqlalchemy import event

    event.listen(db, 'before_commit', fail_before_commit)
    try:
        with pytest.raises(RuntimeError, match='isolated simulated database commit failure'):
            auth_module.login(Login(email=TEST_EMAIL, password=WRONG_PASSWORD), db)
        assert db.in_transaction()
    finally:
        event.remove(db, 'before_commit', fail_before_commit)
        db.rollback()

    with factory() as verify_db:
        user = verify_db.get(User, user_id)
        assert user.failed_login_count == 0
        assert user.locked_until is None


def test_concurrent_failed_logins_use_only_temporary_sqlite(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'concurrency.sqlite'}",
        connect_args={'check_same_thread': False, 'timeout': 15},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=True)
    with factory() as db:
        db.add(
            User(
                email=TEST_EMAIL,
                password_hash=hashpw(TEST_PASSWORD),
                full_name='Concurrent Test',
                role='student',
            )
        )
        db.commit()

    barrier = Barrier(5)
    original_verify = auth_module.verify

    def synchronized_verify(password, password_hash):
        barrier.wait(timeout=10)
        return original_verify(password, password_hash)

    monkeypatch.setattr(auth_module, 'verify', synchronized_verify)

    def attempt_login():
        with factory() as db:
            try:
                auth_module.login(Login(email=TEST_EMAIL, password=WRONG_PASSWORD), db)
            except HTTPException as exc:
                return exc.status_code

    try:
        with ThreadPoolExecutor(max_workers=5) as executor:
            statuses = list(executor.map(lambda _: attempt_login(), range(5)))
        assert statuses == [401] * 5
        with factory() as db:
            user = db.query(User).filter(User.email == TEST_EMAIL).one()
            assert user.failed_login_count == 5
            assert user.locked_until is not None
    finally:
        engine.dispose()
