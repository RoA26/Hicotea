"""Verificación de correo

Revision ID: 0011
Revises: 0010

Aditiva:
- `usuario.correo_verificado_en`: cuándo se comprobó que la persona controla
  `usuario.correo`. NULL = sin verificar. Ningún correo existente queda
  verificado: solo un enlace enviado a esa dirección lo verifica.
- `verificacion_correo`: enlaces de un solo uso para verificar una dirección
  (la actual sin verificar o una nueva). Guarda solo el SHA-256 del token.
  Mientras no se verifique, una dirección nueva no reemplaza a la actual y
  nunca recibe el PIN de recuperación.
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE usuario ADD COLUMN correo_verificado_en TIMESTAMPTZ")
    op.execute(
        """
        CREATE TABLE verificacion_correo (
            id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            id_usuario   BIGINT       NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
            correo       VARCHAR(254) NOT NULL,
            token_hash   CHAR(64)     NOT NULL UNIQUE,
            creada_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            expira_en    TIMESTAMPTZ  NOT NULL,
            usada_en     TIMESTAMPTZ,
            anulada_en   TIMESTAMPTZ,
            CONSTRAINT ck_verificacion_usada_o_anulada CHECK (usada_en IS NULL OR anulada_en IS NULL),
            CONSTRAINT ck_verificacion_vigencia CHECK (expira_en > creada_en)
        )
        """
    )
    op.execute("CREATE INDEX ix_verificacion_correo_usuario ON verificacion_correo (id_usuario, creada_en DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS verificacion_correo")
    op.execute("ALTER TABLE usuario DROP COLUMN IF EXISTS correo_verificado_en")
