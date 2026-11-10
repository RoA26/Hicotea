from fastapi import APIRouter, HTTPException, Request, Response, status

from app.config import config
from app.esquemas.auth import LoginForm, RegistroForm, UsuarioOut
from app.seguridad.dependencias import Con, UsuarioActual
from app.seguridad.sesion import borrar_cookie, poner_cookie
from app.servicios import auth as servicio

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/registro", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def registro(form: RegistroForm, respuesta: Response, con: Con):
    try:
        usuario, token = servicio.registrar(con, form)
    except servicio.UsuarioYaExiste:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese nombre de usuario ya está en uso")
    poner_cookie(respuesta, token)
    return usuario


@router.post("/login", response_model=UsuarioOut)
def login(form: LoginForm, respuesta: Response, con: Con):
    try:
        usuario, token = servicio.iniciar_sesion(con, form)
    except servicio.CredencialesInvalidas:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos")
    poner_cookie(respuesta, token)
    return usuario


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, respuesta: Response, con: Con):
    servicio.cerrar_sesion(con, request.cookies.get(config().cookie_nombre))
    borrar_cookie(respuesta)


@router.get("/yo", response_model=UsuarioOut)
def yo(usuario: UsuarioActual):
    return usuario
