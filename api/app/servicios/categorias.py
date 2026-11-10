from sqlalchemy import Connection

from app.errores import NoEncontrado, ReglaNegocio
from app.esquemas.entradas import CategoriaCambio, CategoriaForm
from app.modelo.enums import TipoCategoria
from app.repos import categoria as repo

# Categorías con las que arranca cada usuario nuevo; luego puede editarlas.
POR_DEFECTO: dict[TipoCategoria, list[str]] = {
    TipoCategoria.INGRESO: ["Producido", "Salario", "Otros ingresos"],
    TipoCategoria.GASTO: ["Alimentación", "Arriendo", "Servicios públicos", "Transporte", "Salud", "Ocio", "Otros gastos"],
    TipoCategoria.COSTO_OPERATIVO: ["Combustible", "Mantenimiento", "Repuestos", "SOAT y documentos", "Otros costos"],
}


def crear_por_defecto(con: Connection, id_usuario: int) -> None:
    repo.insertar_varias(con, id_usuario, [(n, str(t)) for t, nombres in POR_DEFECTO.items() for n in nombres])


def listar(con: Connection, id_usuario: int) -> list[dict]:
    return repo.listar(con, id_usuario)


def obtener(con: Connection, id_usuario: int, id_categoria: int) -> dict:
    c = repo.buscar(con, id_usuario, id_categoria)
    if c is None:
        raise NoEncontrado("Categoría no encontrada")
    return c


def crear(con: Connection, id_usuario: int, form: CategoriaForm) -> dict:
    nombre = _nombre_valido(form.nombre)
    _validar_unico(con, id_usuario, form.tipo, nombre, None)
    return repo.insertar(con, id_usuario, nombre, str(form.tipo))


def cambiar(con: Connection, id_usuario: int, id_categoria: int, cambio: CategoriaCambio) -> dict:
    """Las categorías no se borran (tienen movimientos históricos): se renombran o se desactivan."""
    categoria = obtener(con, id_usuario, id_categoria)
    if cambio.nombre is not None:
        nombre = _nombre_valido(cambio.nombre)
        _validar_unico(con, id_usuario, categoria["tipo"], nombre, id_categoria)
        repo.actualizar_nombre(con, id_usuario, id_categoria, nombre)
    if cambio.activa is not None:
        repo.cambiar_estado(con, id_usuario, id_categoria, cambio.activa)
    return obtener(con, id_usuario, id_categoria)


def _nombre_valido(nombre: str) -> str:
    nombre = nombre.strip()
    if not nombre:
        raise ReglaNegocio("El nombre de la categoría no puede quedar vacío.", "nombre")
    return nombre


def _validar_unico(con: Connection, id_usuario: int, tipo: str, nombre: str, excluido: int | None) -> None:
    if repo.existe_nombre(con, id_usuario, str(tipo), nombre, excluido):
        raise ReglaNegocio("Ya tienes una categoría de ese tipo con ese nombre.", "nombre")
