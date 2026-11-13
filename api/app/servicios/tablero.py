"""Tablero de inicio (resumen del mes, cajitas, fuentes y gráficas), saldo
para respuestas rápidas y calendario mensual."""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import Connection

from app.modelo import calculos, reloj
from app.modelo.enums import Frecuencia
from app.repos import movimiento as repo_mov
from app.servicios import cajitas, fuentes, metas, movimientos, presupuestos, recurrentes

MESES_EN_GRAFICA = 6


def _resumen(con: Connection, id_usuario: int, desde: date, hasta: date) -> dict:
    r = repo_mov.resumen(con, id_usuario, desde, hasta)
    return calculos.resumen_periodo(r["ingresos"], r["personales"], r["costos"])


def _mes(anio: int, mes: int) -> tuple[date, date]:
    return reloj.primer_dia(anio, mes), reloj.ultimo_dia(anio, mes)


def _dinero_en_cajitas(todas: list[dict]) -> tuple[Decimal, list[dict]]:
    """D-F1, segunda protección: el total cuenta el saldo de **todas** las cajitas.
    Una cajita inactiva debería tener saldo 0; si no (datos anteriores a D-F1 o
    una inconsistencia histórica), su dinero se suma igual y se devuelve aparte
    para avisar. Nunca se corrige ningún registro automáticamente."""
    total = sum((c["saldo"] for c in todas), Decimal(0))
    inactivas = [{"id": c["id"], "nombre": c["nombre"], "saldo": c["saldo"]}
                 for c in todas if not c["activa"] and c["saldo"] != 0]
    return total, inactivas


def saldo(con: Connection, id_usuario: int) -> dict:
    """Saldo actual y resumen del mes; se devuelve tras cada registro rápido."""
    hoy = reloj.hoy()
    disponible = repo_mov.disponible(con, id_usuario)
    en_cajitas, inactivas = _dinero_en_cajitas(cajitas.listar(con, id_usuario))
    return {
        "disponible": disponible,
        "en_cajitas": en_cajitas,
        "total": disponible + en_cajitas,
        "mes": _resumen(con, id_usuario, *_mes(hoy.year, hoy.month)),
        "cajitas_inactivas_con_saldo": inactivas,
    }


def construir(con: Connection, id_usuario: int) -> dict:
    hoy = reloj.hoy()
    desde, hasta = _mes(hoy.year, hoy.month)
    anterior = reloj.sumar_meses(desde, -1)
    todas = cajitas.listar(con, id_usuario)
    activas = [c for c in todas if c["activa"]]
    total_cajitas, inactivas = _dinero_en_cajitas(todas)
    disponible = repo_mov.disponible(con, id_usuario)
    ultimos = [movimientos.detallar(m) for m in repo_mov.ultimos(con, id_usuario, 5)]
    return {
        "hoy": hoy,
        "mes": reloj.texto_mes(hoy.year, hoy.month),
        "disponible": disponible,
        "total_cajitas": total_cajitas,
        "saldo_total": disponible + total_cajitas,
        "cajitas_inactivas_con_saldo": inactivas,
        "mes_actual": _resumen(con, id_usuario, desde, hasta),
        "mes_anterior": _resumen(con, id_usuario, *_mes(anterior.year, anterior.month)),
        "cajitas": activas,
        "fuentes": fuentes.resumen(con, id_usuario, desde, hasta),
        "ultimos_movimientos": ultimos,
        "sin_movimientos": not ultimos,
        "graficas": _graficas(con, id_usuario, hoy),
        "pendientes": recurrentes.pendientes(con, id_usuario),
        "alertas_presupuesto": presupuestos.alertas_del_mes(con, id_usuario),
        "metas": metas.listar_activas(con, id_usuario),
    }


def _graficas(con: Connection, id_usuario: int, hoy: date) -> dict:
    desde_mes, hasta_mes = _mes(hoy.year, hoy.month)
    # Ingresos vs gastos de los últimos meses (se rellenan con cero los meses sin movimientos).
    primer_mes = reloj.sumar_meses(desde_mes, -(MESES_EN_GRAFICA - 1))
    por_mes = {t["mes"]: t for t in repo_mov.totales_por_mes(con, id_usuario, primer_mes, hasta_mes)}
    serie_meses = []
    for i in range(MESES_EN_GRAFICA):
        m = reloj.sumar_meses(primer_mes, i)
        clave = reloj.texto_mes(m.year, m.month)
        t = por_mes.get(clave)
        serie_meses.append({
            "mes": clave,
            "ingresos": t["ingresos"] if t else Decimal(0),
            "gastos": t["gastos"] if t else Decimal(0),
        })
    # Producido diario del mes hasta hoy.
    por_dia = {t["fecha"]: t["producido"] for t in repo_mov.totales_por_dia(con, id_usuario, desde_mes, hoy)}
    producido = [
        {"dia": d.day, "total": por_dia.get(d, Decimal(0))}
        for d in (desde_mes + timedelta(days=i) for i in range((hoy - desde_mes).days + 1))
    ]
    return {
        "por_mes": serie_meses,
        "gastos_por_categoria": repo_mov.gastos_por_categoria(con, id_usuario, desde_mes, hasta_mes),
        "producido_por_dia": producido,
    }


# ------------------------------------------------------------------ calendario


def calendario(con: Connection, id_usuario: int, anio: int, mes: int) -> dict:
    """Calendario mensual de ingresos. Marca los días en que entró dinero y,
    si hay una fuente diaria activa, los días pasados sin producido."""
    hoy = reloj.hoy()
    primero, ultimo = _mes(anio, mes)
    inicio = primero - timedelta(days=primero.weekday())  # lunes anterior o igual
    fin = ultimo + timedelta(days=6 - ultimo.weekday())  # domingo siguiente o igual
    totales = {t["fecha"]: t for t in repo_mov.totales_por_dia(con, id_usuario, inicio, fin)}
    # Desde cuándo se espera producido diario: la creación de la primera fuente diaria activa.
    diarias = [f["fecha_creacion"] for f in fuentes.listar(con, id_usuario)
               if f["activa"] and f["frecuencia"] == Frecuencia.DIARIA]
    inicio_diarias = min(diarias) if diarias else None

    semanas: list[list[dict]] = []
    total_ingresos = total_gastos = Decimal(0)
    con_producido_n = sin_producido_n = 0
    d = inicio
    while d <= fin:
        del_mes = d.month == mes and d.year == anio
        t = totales.get(d)
        ingresos = t["ingresos"] if t else Decimal(0)
        gastos = t["gastos"] if t else Decimal(0)
        con_producido = t is not None and t["producido"] > 0
        sin_producido = (del_mes and not con_producido and inicio_diarias is not None
                         and d < hoy and d >= inicio_diarias)
        if del_mes:
            total_ingresos += ingresos
            total_gastos += gastos
            con_producido_n += con_producido
            sin_producido_n += sin_producido
        if d.weekday() == 0:
            semanas.append([])
        semanas[-1].append({
            "fecha": d, "del_mes": del_mes, "hoy": d == hoy, "ingresos": ingresos, "gastos": gastos,
            "con_producido": con_producido, "sin_producido": sin_producido,
        })
        d += timedelta(days=1)
    ant = reloj.sumar_meses(primero, -1)
    sig = reloj.sumar_meses(primero, 1)
    return {
        "mes": reloj.texto_mes(anio, mes),
        "mes_anterior": reloj.texto_mes(ant.year, ant.month),
        "mes_siguiente": reloj.texto_mes(sig.year, sig.month),
        "semanas": semanas,
        "total_ingresos": total_ingresos,
        "total_gastos": total_gastos,
        "dias_con_producido": con_producido_n,
        "dias_sin_producido": sin_producido_n,
    }
