"""/api/cuenta: perfil de la cuenta propia (datos, correo, contraseña y sesiones).

Todo exige sesión salvo `POST /correo/verificar`: el enlace llega por correo y
puede abrirse en otro dispositivo; el token por sí solo demuestra que la
persona controla esa dirección (el cambio ya se autorizó con la contraseña)."""

from fastapi import APIRouter, HTTPException, Request, status

from app.config import config
from app.esquemas.auth import (
    ContrasenaForm,
    CorreoForm,
    DatosPerfilForm,
    PerfilOut,
    SesionesCerradas,
    VerificacionOut,
    VerificarCorreoForm,
)
from app.esquemas.salidas import Mensaje
from app.errores import ReglaNegocio
from app.seguridad.dependencias import Con, UsuarioActual
from app.seguridad.limitador import limitador_reautenticacion, limitador_verificacion
from app.seguridad.sesion import hash_token
from app.servicios import cuenta as servicio

router = APIRouter(prefix="/api/cuenta", tags=["cuenta"])

DEMASIADOS = "Demasiados intentos. Espera unos minutos e intenta de nuevo."


def _ip(request: Request) -> str:
    return request.client.host if request.client else "desconocida"


def _token_actual(request: Request) -> str:
    return hash_token(request.cookies.get(config().cookie_nombre, ""))


def _con_reautenticacion(request: Request, usuario: dict, accion):
    """Cuenta los intentos con la contraseña actual equivocada (por cuenta e IP)."""
    ip, clave = _ip(request), f"u{usuario['id']}"
    if limitador_reautenticacion.esta_bloqueado(ip, clave):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, DEMASIADOS)
    try:
        return accion()
    except servicio.ContrasenaIncorrecta:
        limitador_reautenticacion.registrar_fallo(ip, clave)
        raise


@router.get("", response_model=PerfilOut)
def ver(usuario: UsuarioActual, con: Con):
    return servicio.perfil(con, usuario["id"])


@router.patch("", response_model=PerfilOut)
def actualizar(form: DatosPerfilForm, usuario: UsuarioActual, con: Con):
    return servicio.actualizar_datos(con, usuario["id"], form.nombre_completo)


@router.post("/correo", response_model=Mensaje)
def solicitar_correo(form: CorreoForm, request: Request, usuario: UsuarioActual, con: Con):
    mensaje = _con_reautenticacion(
        request, usuario, lambda: servicio.solicitar_correo(con, usuario, form.correo, form.contrasena_actual)
    )
    return {"mensaje": mensaje}


@router.delete("/correo/pendiente", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_pendiente(usuario: UsuarioActual, con: Con):
    servicio.cancelar_pendiente(con, usuario["id"])


@router.post("/correo/verificar", response_model=VerificacionOut)
def verificar_correo(form: VerificarCorreoForm, request: Request, con: Con):
    ip = _ip(request)
    if limitador_verificacion.esta_bloqueado(ip, "verificacion"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, DEMASIADOS)
    try:
        return servicio.verificar(con, form.token)
    except ReglaNegocio as e:
        if e.estado == 422:  # enlace inválido, usado o vencido
            limitador_verificacion.registrar_fallo(ip, "verificacion")
        raise


@router.post("/contrasena", response_model=SesionesCerradas)
def cambiar_contrasena(form: ContrasenaForm, request: Request, usuario: UsuarioActual, con: Con):
    cerradas = _con_reautenticacion(
        request,
        usuario,
        lambda: servicio.cambiar_contrasena(
            con, usuario, form.contrasena_actual, form.contrasena, form.confirmacion_contrasena, _token_actual(request)
        ),
    )
    return {"mensaje": "Listo. Tu contraseña cambió y se cerraron tus otras sesiones.", "cerradas": cerradas}


@router.post("/sesiones/cerrar-otras", response_model=SesionesCerradas)
def cerrar_otras(request: Request, usuario: UsuarioActual, con: Con):
    n = servicio.cerrar_otras_sesiones(con, usuario["id"], _token_actual(request))
    texto = "No había otras sesiones abiertas." if n == 0 else f"Cerramos {n} sesión{'' if n == 1 else 'es'} en otros dispositivos."
    return {"mensaje": texto, "cerradas": n}
