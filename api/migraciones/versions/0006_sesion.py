"""sesion (nueva en Hicotea: Eden guardaba la sesión en memoria de Spring)

Revision ID: 0006
Revises: 0005
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

SQL = r"""
-- La cookie lleva un token aleatorio; aqui solo se guarda su SHA-256 (hex).
CREATE TABLE sesion (
    token_hash      CHAR(64)    PRIMARY KEY,
    id_usuario      BIGINT      NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en       TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_sesion_usuario ON sesion (id_usuario);
"""


def upgrade() -> None:
    op.execute(SQL)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sesion")
