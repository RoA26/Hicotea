from fastapi import APIRouter, HTTPException, Request, Response, status

from app.config import config
from app.errores import ReglaNegocio
from app.esquemas.auth import (
    InvitacionConsulta,
    InvitacionEstado,
    LoginForm,
    RecuperarForm,
    RegistroForm,
    RestablecerForm,
    UsuarioOut,
)
from app.esquemas.salidas import Mensaje
from app.seguridad.dependencias import Con, UsuarioActual
from app.seguridad.limitador import limitador, limitador_pin, limitador_recuperacion, limitador_registro
from app.seguridad.sesion import borrar_cookie, poner_cookie
from app.servicios import auth as servicio
from app.servicios import invitaciones, recuperacion

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _ip(request: Request) -> str:
    # Detrás de Caddy, uvicorn debe correr con --proxy-headers para que esto sea la IP real.
    return request.client.host if request.client else "desconocida"


DEMASIADOS = "Demasiados intentos. Espera unos minutos e intenta de nuevo."


def _frenar(limitador_x, ip: str, clave: str) -> None:
    if limitador_x.esta_bloqueado(ip, clave):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, DEMASIADOS)


@router.post("/registro", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def registro(form: RegistroForm, request: Request, respuesta: Response, con: Con):
    ip = _ip(request)
    _frenar(limitador_registro, ip, "registro")
    try:
        usuario, token = servicio.registrar(con, form)
    except ReglaNegocio as e:
        if e.campo == "codigo_invitacion":  # solo los intentos con invitación inválida cuentan
            limitador_registro.registrar_fallo(ip, "registro")
        raise
    poner_cookie(respuesta, token)
    return usuario


@router.post("/invitacion", response_model=InvitacionEstado)
def consultar_invitacion(form: InvitacionConsulta, request: Request, con: Con):
    """Para la pantalla de registro: si el enlace sirve y a qué correo está asociado."""
    ip = _ip(request)
    _frenar(limitador_registro, ip, "registro")
    inv = invitaciones.consultar(con, form.token)
    if inv is None:
        limitador_registro.registrar_fallo(ip, "registro")
        return {"valida": False}
    return {"valida": True, "correo": inv["correo"]}


@router.post("/login", response_model=UsuarioOut)
def login(form: LoginForm, request: Request, respuesta: Response, con: Con):
    ip, nombre = _ip(request), servicio.normalizar(form.nombre_usuario)
    # Se corta antes de verificar la contraseña: el atacante tampoco consume CPU con argon2.
    if limitador.esta_bloqueado(ip, nombre):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo."
        )
    try:
        usuario, token = servicio.iniciar_sesion(con, form)
    except servicio.CredencialesInvalidas:
        limitador.registrar_fallo(ip, nombre)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos")
    except servicio.CuentaBloqueada:
        # Solo llega aquí quien escribió la contraseña correcta.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Tu cuenta está bloqueada. Habla con quien administra Hicotea."
        )
    limitador.registrar_exito(ip, nombre)
    poner_cookie(respuesta, token)
    return usuario


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, respuesta: Response, con: Con):
    servicio.cerrar_sesion(con, request.cookies.get(config().cookie_nombre))
    borrar_cookie(respuesta)


@router.get("/yo", response_model=UsuarioOut)
def yo(usuario: UsuarioActual):
    return usuario


@router.post("/recuperar", response_model=Mensaje)
def recuperar(form: RecuperarForm, request: Request, con: Con):
    ip, ident = _ip(request), form.nombre_usuario.strip().lower()
    _frenar(limitador_recuperacion, ip, ident)
    limitador_recuperacion.registrar_fallo(ip, ident)  # cada solicitud cuenta
    recuperacion.solicitar(con, form.nombre_usuario)
    # Misma respuesta exista o no la cuenta, tenga o no correo.
    return {
        "mensaje": "Si la cuenta existe, generamos un PIN. Si registraste un correo te llegará allí; "
        "si no, pídeselo a quien administra Hicotea."
    }


@router.post("/restablecer", response_model=Mensaje)
def restablecer(form: RestablecerForm, request: Request, con: Con):
    ip, ident = _ip(request), form.nombre_usuario.strip().lower()
    _frenar(limitador_pin, ip, ident)
    try:
        recuperacion.restablecer(con, form.nombre_usuario, form.pin, form.contrasena, form.confirmacion_contrasena)
    except ReglaNegocio as e:
        if e.campo == "pin":
            limitador_pin.registrar_fallo(ip, ident)
        raise
    return {"mensaje": "Listo. Ya puedes iniciar sesión con tu nueva contraseña."}
