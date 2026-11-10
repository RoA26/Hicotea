from fastapi import APIRouter, HTTPException, Request, Response, status

from app.config import config
from app.esquemas.auth import LoginForm, RecuperarForm, RegistroForm, RestablecerForm, UsuarioOut
from app.esquemas.salidas import Mensaje
from app.seguridad.dependencias import Con, UsuarioActual
from app.seguridad.limitador import limitador
from app.seguridad.sesion import borrar_cookie, poner_cookie
from app.servicios import auth as servicio
from app.servicios import recuperacion

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _ip(request: Request) -> str:
    # Detrás de Caddy, uvicorn debe correr con --proxy-headers para que esto sea la IP real.
    return request.client.host if request.client else "desconocida"


@router.post("/registro", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def registro(form: RegistroForm, respuesta: Response, con: Con):
    usuario, token = servicio.registrar(con, form)
    poner_cookie(respuesta, token)
    return usuario


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
def recuperar(form: RecuperarForm, con: Con):
    recuperacion.solicitar(con, form.nombre_usuario)
    # Misma respuesta exista o no la cuenta.
    return {"mensaje": "Si la cuenta existe, se generó un PIN. Pídeselo a quien administra Hicotea."}


@router.post("/restablecer", response_model=Mensaje)
def restablecer(form: RestablecerForm, con: Con):
    recuperacion.restablecer(con, form.nombre_usuario, form.pin, form.contrasena, form.confirmacion_contrasena)
    return {"mensaje": "Listo. Ya puedes iniciar sesión con tu nueva contraseña."}
