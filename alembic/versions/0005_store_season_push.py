"""Phase D (admin msg 4839): Season Pass, premium entitlement, English Spell's own Web Push

- users.premium_until (Archmage Circle; only a fulfilled purchase sets it; payments are OFF)
- users.last_reminder_day (one push reminder a local day at most)
- season_progress (one row per player per UTC month: xp, claimed tiers, premium track)
- push_subscriptions (VAPID web push endpoints)
- purchases: a partial unique index, so the one-time Starter Pack (sku starter_pack) completes once per player

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-11 08:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('premium_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_reminder_day', sa.Date(), nullable=True))
    op.create_table(
        'season_progress',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'),
                  primary_key=True),
        sa.Column('season_id', sa.String(7), primary_key=True),
        sa.Column('xp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('premium', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('free_claimed', postgresql.ARRAY(sa.Integer()), nullable=False, server_default='{}'),
        sa.Column('premium_claimed', postgresql.ARRAY(sa.Integer()), nullable=False, server_default='{}'),
        sa.Column('xp_day', sa.Date(), nullable=True),
        sa.Column('xp_today', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False, unique=True),
        sa.Column('p256dh', sa.Text(), nullable=False),
        sa.Column('auth', sa.Text(), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=False, server_default=''),
        sa.Column('fails', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_ok_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_push_subscriptions_user_id', 'push_subscriptions', ['user_id'])
    op.create_index('ux_purchase_once', 'purchases', ['user_id', 'sku'], unique=True,
                    postgresql_where=sa.text("status = 'completed' AND sku = 'starter_pack'"))


def downgrade() -> None:
    op.drop_index('ux_purchase_once', table_name='purchases')
    op.drop_index('ix_push_subscriptions_user_id', table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
    op.drop_table('season_progress')
    op.drop_column('users', 'last_reminder_day')
    op.drop_column('users', 'premium_until')
