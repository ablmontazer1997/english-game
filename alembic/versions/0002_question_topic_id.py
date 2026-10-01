"""questions.topic_id (Bingual grammar topic id from the pipeline)

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-01 08:40:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('questions', sa.Column('topic_id', sa.Text(), nullable=True))
    op.create_index('ix_questions_topic_id', 'questions', ['topic_id'])


def downgrade() -> None:
    op.drop_index('ix_questions_topic_id', table_name='questions')
    op.drop_column('questions', 'topic_id')
