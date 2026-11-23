"""Comandos de operación (se ejecutan en el servidor, no desde la web).

    uv run python -m app.cli admin listar
    uv run python -m app.cli admin otorgar <usuario>
    uv run python -m app.cli admin revocar <usuario>
    uv run python -m app.cli invitacion crear [--dias 7] [--correo x@y.co] [--nota "Para Ana"]
    uv run python -m app.cli correo estado
    uv run python -m app.cli correo probar <direccion> [--si]
    uv run python -m app.cli correo vista-previa <carpeta>

En producción, dentro del contenedor de la API:
    docker compose -f docker-compose.prod.yml exec api python -m app.cli admin otorgar <usuario>

Quien puede ejecutar estos comandos ya controla el servidor y la base de
datos; por eso son la forma de crear el primer administrador. Cada cambio
queda en `auditoria_admin` con el autor "cli:<usuario del sistema>".
"""

import argparse
import getpass
import os
import sys
from datetime import UTC, datetime, timedelta

from app import correo
from app import plantillas_correo as plantillas
from app.config import config
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


# ====================================================================== correo


def correo_estado() -> int:
    """Muestra la configuración de envío sin revelar secretos."""
    c = config()
    print(f"Modo:          {c.correo_modo}")
    print(f"Remitente:     {c.correo_remitente}")
    print(f"URL pública:   {c.url_publica}")
    if c.correo_modo == "smtp":
        print(f"Host:          {c.smtp_host or '(vacío)'}")
        print(f"Puerto:        {c.smtp_puerto}")
        print(f"Seguridad:     {c.smtp_seguridad}")
        print(f"Usuario:       {'definido' if c.smtp_usuario else '(vacío)'}")
        print(f"Contraseña:    {'definida' if c.smtp_contrasena and c.smtp_contrasena.get_secret_value() else '(vacía)'}")
        print(f"Tiempo límite: {c.smtp_timeout:g} s")
        for problema in correo.problemas_smtp(c):
            print(f"  ✗ {problema}")
        for aviso in correo.avisos_smtp(c):
            print(f"  ! {aviso}")
    print()
    if correo.disponible():
        print("Disponible: sí. La verificación de correo y el PIN por correo están habilitados.")
        return 0
    print("Disponible: no. Hicotea no ofrece verificar correos y el PIN queda en el log del servidor.")
    return 1


def correo_probar(direccion: str, confirmado: bool) -> int:
    """Envía un correo de prueba (sin datos de cuentas) a una dirección explícita."""
    direccion = direccion.strip()
    if "@" not in direccion or any(ch in direccion for ch in "\r\n,; <>"):
        print("Escribe una sola dirección de correo válida.", file=sys.stderr)
        return 2
    c = config()
    if not correo.disponible():
        print("El correo no está disponible con la configuración actual:", file=sys.stderr)
        for problema in correo.problemas_smtp(c) if c.correo_modo == "smtp" else [f"HICOTEA_CORREO_MODO={c.correo_modo}."]:
            print(f"  ✗ {problema}", file=sys.stderr)
        return 1
    destino = "se escribirá en el log (modo consola)" if c.correo_modo == "consola" else f"saldrá por {c.smtp_host}:{c.smtp_puerto} ({c.smtp_seguridad})"
    print(f"Se enviará un correo de prueba a {direccion}; {destino}.")
    if not confirmado:
        if not sys.stdin.isatty():
            print("Sin terminal interactiva: confirma con --si.", file=sys.stderr)
            return 2
        if input("¿Enviar? Escribe 'si' para continuar: ").strip().lower() not in ("si", "sí"):
            print("Cancelado. No se envió nada.")
            return 1
    try:
        correo.enviar_o_fallar(plantillas.prueba().para(direccion))
    except Exception as e:  # noqa: BLE001 — se explica sin el detalle del servidor
        print(f"No se pudo enviar. {correo.describir_error(e)}", file=sys.stderr)
        return 1
    print("Enviado. El servidor lo aceptó; revisa la bandeja de entrada y la carpeta de spam.")
    return 0


def correo_vista_previa(carpeta: str) -> int:
    """Escribe cada plantilla (.html, .txt y .eml) con datos ficticios."""
    os.makedirs(carpeta, exist_ok=True)
    base = config().url_publica.rstrip("/")
    falso = "TOKEN-FICTICIO-de-vista-previa-0000000000"
    nombre = "Ana <Prueba> & Cía"  # muestra el escape
    muestras = {
        "verificacion": plantillas.verificacion(nombre, "ana", f"{base}/verificar-correo?token={falso}", 24),
        "recuperacion-pin": plantillas.recuperacion_pin(nombre, "ana", "042917", 15, 5),
        "invitacion": plantillas.invitacion(f"{base}/registro?invitacion={falso}",
                                            datetime.now(UTC) + timedelta(days=7), "Para Ana, de parte de Rosa."),
        "aviso-contrasena": plantillas.aviso_contrasena_cambiada(nombre, "ana", desde_perfil=True),
        "aviso-correo": plantillas.aviso_correo_cambiado(nombre, "ana", "ana.nueva@ejemplo.co"),
        "prueba": plantillas.prueba(),
    }
    for clave, m in muestras.items():
        with open(os.path.join(carpeta, f"{clave}.html"), "w", encoding="utf-8") as f:
            f.write(m.html)
        with open(os.path.join(carpeta, f"{clave}.txt"), "w", encoding="utf-8") as f:
            f.write(f"Asunto: {m.asunto}\n\n{m.texto}\n")
        with open(os.path.join(carpeta, f"{clave}.eml"), "wb") as f:
            f.write(bytes(correo.componer(m.para("ana@ejemplo.co"), "Hicotea <no-responder@ejemplo.co>")))
    print(f"{len(muestras)} plantillas en {carpeta} (.html, .txt y .eml, datos ficticios).")
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

    co = sub.add_parser("correo", help="Envío de correos")
    sco = co.add_subparsers(dest="accion", required=True)
    sco.add_parser("estado", help="Configuración actual, sin secretos")
    pr = sco.add_parser("probar", help="Envía un correo de prueba a una dirección explícita")
    pr.add_argument("direccion")
    pr.add_argument("--si", action="store_true", help="No pedir confirmación")
    vp = sco.add_parser("vista-previa", help="Escribe las plantillas con datos ficticios")
    vp.add_argument("carpeta")

    args = p.parse_args(argv)
    if args.grupo == "correo":
        if args.accion == "estado":
            return correo_estado()
        if args.accion == "probar":
            return correo_probar(args.direccion, args.si)
        return correo_vista_previa(args.carpeta)
    if args.grupo == "admin":
        if args.accion == "listar":
            return admin_listar()
        return admin_cambiar(args.usuario, "ADMIN" if args.accion == "otorgar" else "USUARIO")
    return invitacion_crear(args.dias, args.correo, args.nota)


if __name__ == "__main__":
    sys.exit(main())
