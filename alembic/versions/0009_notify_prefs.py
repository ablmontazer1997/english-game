"""10-20 reminders (admin 6138): users.notify_prefs (on / minute / events) for the reminder planner

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-20 12:00:00
"""
from alembic import op

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_prefs JSONB NOT NULL DEFAULT '{}'::jsonb")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notify_prefs")
