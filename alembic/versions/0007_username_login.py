"""username + password login and its failed-try log (admin 6018: two static test accounts)

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-19 12:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # lower-case login name; only accounts made by scripts/make_accounts.py have one (guests stay null)
    op.add_column('users', sa.Column('username', sa.Text(), nullable=True))
    op.create_index('ux_users_username', 'users', ['username'], unique=True)
    # every POST /v1/auth/login try; failed ones in the last 15 minutes drive the rate limit (works across workers)
    op.create_table(
        'login_attempts',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('username', sa.Text(), nullable=False),
        sa.Column('ip', sa.Text(), nullable=False, server_default=''),
        sa.Column('ok', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_login_attempts_user_at', 'login_attempts', ['username', 'at'])
    op.create_index('ix_login_attempts_ip_at', 'login_attempts', ['ip', 'at'])
    op.create_index('ix_login_attempts_at', 'login_attempts', ['at'])


def downgrade() -> None:
    op.drop_table('login_attempts')
    op.drop_index('ux_users_username', table_name='users')
    op.drop_column('users', 'username')
