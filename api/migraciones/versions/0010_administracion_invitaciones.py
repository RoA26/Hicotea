"""Administración de plataforma: rol, bloqueo, correo, invitaciones y auditoría

Revision ID: 0010
Revises: 0009

Aditiva. Ninguna cuenta existente cambia de permisos ni de estado:
- `usuario.rol` nace en 'USUARIO' para todos. El primer administrador se
  habilita a mano con `python -m app.cli admin otorgar <usuario>` (ver
  docs/administracion-y-recuperacion.md); nunca se otorga automáticamente.
- `usuario.activo` sigue siendo la única fuente de verdad del acceso (un
  usuario bloqueado es `activo = FALSE`); `bloqueado_en` solo informa cuándo.
- `usuario.correo` es opcional: sirve para entregar el PIN de recuperación.
- `invitacion` guarda solo el SHA-256 del token: el enlace se muestra una vez.
- `auditoria_admin` registra acciones administrativas sin contraseñas, tokens
  ni datos financieros.
"""

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE usuario
            ADD COLUMN rol VARCHAR(12) NOT NULL DEFAULT 'USUARIO',
            ADD COLUMN correo VARCHAR(254),
            ADD COLUMN bloqueado_en TIMESTAMPTZ,
            ADD COLUMN ultimo_ingreso_en TIMESTAMPTZ,
            ADD CONSTRAINT ck_usuario_rol CHECK (rol IN ('USUARIO', 'ADMIN'))
        """
    )
    # Un correo pertenece a una sola cuenta, sin distinguir mayúsculas.
    op.execute("CREATE UNIQUE INDEX uq_usuario_correo ON usuario (lower(correo)) WHERE correo IS NOT NULL")

    op.execute(
        """
        CREATE TABLE invitacion (
            id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            token_hash     CHAR(64)     NOT NULL UNIQUE,
            correo         VARCHAR(254),
            nota           VARCHAR(100),
            creada_por     BIGINT       REFERENCES usuario (id) ON DELETE SET NULL,
            creada_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
            expira_en      TIMESTAMPTZ  NOT NULL,
            usada_en       TIMESTAMPTZ,
            usada_por      BIGINT       REFERENCES usuario (id) ON DELETE SET NULL,
            revocada_en    TIMESTAMPTZ,
            revocada_por   BIGINT       REFERENCES usuario (id) ON DELETE SET NULL,
            CONSTRAINT ck_invitacion_usada_o_revocada CHECK (usada_en IS NULL OR revocada_en IS NULL),
            CONSTRAINT ck_invitacion_vigencia CHECK (expira_en > creada_en)
        )
        """
    )
    op.execute("CREATE INDEX ix_invitacion_creada ON invitacion (creada_en DESC)")

    op.execute(
        """
        CREATE TABLE auditoria_admin (
            id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            fecha          TIMESTAMPTZ  NOT NULL DEFAULT now(),
            id_admin       BIGINT       REFERENCES usuario (id) ON DELETE SET NULL,
            admin_nombre   VARCHAR(30)  NOT NULL,
            accion         VARCHAR(40)  NOT NULL,
            recurso_tipo   VARCHAR(20)  NOT NULL,
            recurso_id     BIGINT,
            recurso_nombre VARCHAR(60),
            resultado      VARCHAR(10)  NOT NULL CHECK (resultado IN ('EXITO', 'RECHAZADO')),
            detalle        VARCHAR(200)
        )
        """
    )
    op.execute("CREATE INDEX ix_auditoria_fecha ON auditoria_admin (fecha DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS auditoria_admin")
    op.execute("DROP TABLE IF EXISTS invitacion")
    op.execute("DROP INDEX IF EXISTS uq_usuario_correo")
    op.execute(
        """
        ALTER TABLE usuario
            DROP CONSTRAINT IF EXISTS ck_usuario_rol,
            DROP COLUMN IF EXISTS ultimo_ingreso_en,
            DROP COLUMN IF EXISTS bloqueado_en,
            DROP COLUMN IF EXISTS correo,
            DROP COLUMN IF EXISTS rol
        """
    )
