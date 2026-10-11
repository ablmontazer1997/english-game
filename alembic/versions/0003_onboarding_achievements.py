"""onboarding state on users (onboarded_at, daily_goal, flags) + server achievements (user_achievements)

Existing players are marked as already onboarded (onboarded_at = created_at), so only new players see the intro.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-11 10:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('onboarded_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('daily_goal', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('flags', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.execute("UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL")
    op.create_table(
        'user_achievements',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'),
                  primary_key=True),
        sa.Column('ach_id', sa.Text(), primary_key=True),
        sa.Column('reward', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('claimed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('user_achievements')
    op.drop_column('users', 'flags')
    op.drop_column('users', 'daily_goal')
    op.drop_column('users', 'onboarded_at')
