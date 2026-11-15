"""Comandos de operación (se ejecutan en el servidor, no desde la web).

    uv run python -m app.cli admin listar
    uv run python -m app.cli admin otorgar <usuario>
    uv run python -m app.cli admin revocar <usuario>
    uv run python -m app.cli invitacion crear [--dias 7] [--correo x@y.co] [--nota "Para Ana"]

En producción, dentro del contenedor de la API:
    docker compose -f docker-compose.prod.yml exec api python -m app.cli admin otorgar <usuario>

Quien puede ejecutar estos comandos ya controla el servidor y la base de
datos; por eso son la forma de crear el primer administrador. Cada cambio
queda en `auditoria_admin` con el autor "cli:<usuario del sistema>".
"""

import argparse
import getpass
import sys

from app.db import motor
from app.repos import admin as repo
from app.servicios import invitaciones


def _autor() -> str:
    try:
        return f"cli:{getpass.getuser()}"[:30]
    except Exception:  # noqa: BLE001 — contenedores sin entrada en /etc/passwd
        return "cli"


def _auditar(con, accion: str, tipo: str, recurso: dict | None, **extra) -> None:
    repo.auditar(
        con, id_admin=None, admin_nombre=_autor(), accion=accion, recurso_tipo=tipo,
        recurso_id=recurso and recurso.get("id"),
        recurso_nombre=recurso and (recurso.get("nombre_usuario") or recurso.get("nota")), **extra,
    )


def admin_listar() -> int:
    with motor().connect() as con:
        filas, _ = repo.cuentas_listar(con, None, None, "ADMIN", 100, 0)
    if not filas:
        print("No hay administradores.")
    for f in filas:
        print(f"{f['nombre_usuario']:<30} {'activo' if f['activo'] else 'BLOQUEADO'}")
    return 0


def admin_cambiar(nombre: str, rol: str) -> int:
    nombre = nombre.strip().lower()
    with motor().begin() as con:
        repo.bloquear_administracion(con)
        c = repo.cuenta_por_nombre(con, nombre)
        if c is None:
            print(f"No existe la cuenta '{nombre}'.", file=sys.stderr)
            return 1
        if c["rol"] == rol:
            print(f"'{nombre}' ya tiene el rol {rol}. Nada que hacer.")
            return 0
        if rol == "USUARIO" and c["activo"] and repo.admins_activos(con, excluir=c["id"]) == 0:
            print("Es el único administrador activo: otorga el rol a otra cuenta antes de quitárselo.", file=sys.stderr)
            return 1
        if rol == "ADMIN" and not c["activo"]:
            print(f"La cuenta '{nombre}' está bloqueada. Desbloquéala primero.", file=sys.stderr)
            return 1
        repo.cuenta_cambiar_rol(con, c["id"], rol)
        _auditar(con, "OTORGAR_ADMIN" if rol == "ADMIN" else "REVOCAR_ADMIN", "USUARIO", c)
    print(f"Listo: '{nombre}' ahora es {'administrador' if rol == 'ADMIN' else 'usuario normal'}.")
    print("El cambio aplica en su próxima petición; no hace falta cerrar sesión.")
    return 0


def invitacion_crear(dias: int, correo: str | None, nota: str | None) -> int:
    if not 1 <= dias <= 30:
        print("--dias debe estar entre 1 y 30.", file=sys.stderr)
        return 1
    with motor().begin() as con:
        inv, token = invitaciones.crear(con, None, dias, (correo or "").strip().lower() or None, nota)
        _auditar(con, "CREAR_INVITACION", "INVITACION", inv, detalle=f"Vigencia: {dias} días")
    print("Invitación creada. Este enlace NO se vuelve a mostrar; compártelo por un canal privado:\n")
    print(f"  {invitaciones.enlace(token)}\n")
    print(f"Vence: {inv['expira_en']:%Y-%m-%d %H:%M %Z}. Un solo uso.")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.cli", description="Operación de Hicotea")
    sub = p.add_subparsers(dest="grupo", required=True)

    a = sub.add_parser("admin", help="Rol de administrador de plataforma")
    sa = a.add_subparsers(dest="accion", required=True)
    sa.add_parser("listar")
    for nombre in ("otorgar", "revocar"):
        x = sa.add_parser(nombre)
        x.add_argument("usuario")

    i = sub.add_parser("invitacion", help="Invitaciones de registro")
    si = i.add_subparsers(dest="accion", required=True)
    c = si.add_parser("crear")
    c.add_argument("--dias", type=int, default=7)
    c.add_argument("--correo")
    c.add_argument("--nota")

    args = p.parse_args(argv)
    if args.grupo == "admin":
        if args.accion == "listar":
            return admin_listar()
        return admin_cambiar(args.usuario, "ADMIN" if args.accion == "otorgar" else "USUARIO")
    return invitacion_crear(args.dias, args.correo, args.nota)


if __name__ == "__main__":
    sys.exit(main())
