"""D-F3: serialización de las operaciones de dinero por usuario.

Toda operación que valida un saldo (disponible o cajita) y luego escribe un
movimiento, o que cambia una invariante de las cajitas (suma de porcentajes,
cajita activa con saldo 0), llama a `serializar_finanzas` **antes de leer los
saldos que valida**. Así dos peticiones simultáneas del mismo usuario se
ejecutan una detrás de otra y la segunda ve lo que confirmó la primera.

Por qué un bloqueo de fila sobre `usuario` y no `pg_advisory_xact_lock`:
- La clave es la propia fila del usuario: no hay que repartir un espacio de
  claves de 64 bits ni arriesgar colisiones con otros usos de advisory locks.
- `FOR NO KEY UPDATE` no choca con el `FOR KEY SHARE` que PostgreSQL toma al
  validar claves foráneas (insertar movimientos, sesiones…), así que solo
  espera otra operación de dinero del mismo usuario.
- Se libera solo al terminar la transacción (una por petición, `app/db.py`).
- Es reentrante dentro de la misma transacción: si un servicio que ya lo
  tomó llama a otro que también lo pide (recurrentes → movimientos), no hay
  bloqueo ni costo extra relevante.
- Cada transacción toma como mucho un bloqueo de este tipo, y siempre del
  mismo usuario: no hay orden de adquisición que pueda producir interbloqueos.
"""

from sqlalchemy import Connection, text

from app.errores import NoEncontrado


def serializar_finanzas(con: Connection, id_usuario: int) -> None:
    fila = con.execute(
        text("SELECT id FROM usuario WHERE id = :u FOR NO KEY UPDATE"), {"u": id_usuario}
    ).first()
    if fila is None:
        raise NoEncontrado("Usuario no encontrado")
