"""admin 6062: no "apprentice" in user-facing text: default player name "Player", starter items renamed

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-19 14:30:00
"""
from alembic import op

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE users SET display_name = 'Player' WHERE display_name = 'Apprentice'")
    op.execute("ALTER TABLE users ALTER COLUMN display_name SET DEFAULT 'Player'")
    op.execute("UPDATE items SET name = 'Starter cap' WHERE id = 'hat_apprentice' AND name = 'Apprentice cap'")
    op.execute("UPDATE items SET name = 'Starter tunic' WHERE id = 'top_apprentice' AND name = 'Apprentice tunic'")


def downgrade() -> None:
    op.execute("UPDATE items SET name = 'Apprentice cap' WHERE id = 'hat_apprentice'")
    op.execute("UPDATE items SET name = 'Apprentice tunic' WHERE id = 'top_apprentice'")
    op.execute("UPDATE users SET display_name = 'Apprentice' WHERE display_name = 'Player'")
