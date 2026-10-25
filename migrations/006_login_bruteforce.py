"""Idempotent migration adding login failure tracking to the users table.

Run manually from the project root with:
    python migrations\\006_login_bruteforce.py
"""
from pathlib import Path
import sys

from sqlalchemy import inspect

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from database import engine


def upgrade() -> list[str]:
    added = []
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not inspector.has_table('users'):
            raise RuntimeError('Không tìm thấy bảng users; hãy khởi tạo schema trước.')
        columns = {column['name'] for column in inspector.get_columns('users')}
        if 'failed_login_count' not in columns:
            connection.exec_driver_sql(
                'ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0'
            )
            added.append('failed_login_count')
        if 'locked_until' not in columns:
            connection.exec_driver_sql(
                'ALTER TABLE users ADD COLUMN locked_until DATETIME NULL'
            )
            added.append('locked_until')
    return added


if __name__ == '__main__':
    added_columns = upgrade()
    if added_columns:
        print('Đã thêm cột: ' + ', '.join(added_columns))
    else:
        print('Các cột giới hạn đăng nhập đã tồn tại.')
