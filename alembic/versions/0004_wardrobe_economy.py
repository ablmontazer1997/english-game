"""Phase B (UX audit 10-11): server wardrobe ownership + economy sinks

- items: price_coins, how, sort (catalogue v2: free / boss / earned / coin / gem / premium; seed fills them)
- users: look (the 3D look on the account), dyes (owned garment dyes), look_legacy (accounts that existed before
  server ownership: their first look upload keeps everything they wear; nobody loses what they have on)
- streaks.lost / lost_on (streak repair, 200 gems within 2 missed days)
- stage_sessions.continues ("+3 questions" after a loss), user_day_stats.hints_used (3 free hints a day)
- trials now cost a heart when they end with no stars (audit 5.3 A)

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-11 14:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('items', sa.Column('price_coins', sa.Integer(), nullable=True))
    op.add_column('items', sa.Column('how', sa.Text(), nullable=False, server_default=''))
    op.add_column('items', sa.Column('sort', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('look', postgresql.JSONB(), nullable=True))
    op.add_column('users', sa.Column('dyes', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column('users', sa.Column('look_legacy', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("UPDATE users SET look_legacy = true")
    op.add_column('stage_sessions', sa.Column('continues', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('user_day_stats', sa.Column('hints_used', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('streaks', sa.Column('lost', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('streaks', sa.Column('lost_on', sa.Date(), nullable=True))
    op.execute("UPDATE stages SET hearts_apply = true WHERE kind = 'trial'")


def downgrade() -> None:
    op.execute("UPDATE stages SET hearts_apply = false WHERE kind = 'trial'")
    op.drop_column('streaks', 'lost_on')
    op.drop_column('streaks', 'lost')
    op.drop_column('user_day_stats', 'hints_used')
    op.drop_column('stage_sessions', 'continues')
    op.drop_column('users', 'look_legacy')
    op.drop_column('users', 'dyes')
    op.drop_column('users', 'look')
    op.drop_column('items', 'sort')
    op.drop_column('items', 'how')
    op.drop_column('items', 'price_coins')
