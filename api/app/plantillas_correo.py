"""Plantillas de los correos de Hicotea (texto plano + HTML).

Sin dependencias: cadenas de Python con `html.escape` en **todo** dato dinámico.
Cada plantilla devuelve un `Mensaje` (asunto, texto, html); `mensaje.para(dir)`
lo convierte en `correo.Correo`.

Diseño (identidad "Original", tema claro del kit, con variante oscura para los
clientes que respetan `prefers-color-scheme`):
 - Tablas y estilos inline (Gmail, Outlook de escritorio y móviles); 560 px de
   contenido, fluido por debajo.
 - Sin JavaScript, sin imágenes, sin fuentes remotas, sin píxeles ni enlaces de
   seguimiento: lo esencial (enlace, PIN) está en el texto. El logo oficial es
   SVG (no se ve en Gmail ni Outlook) y la identidad está en revisión con un
   diseñador: por ahora se usa el wordmark textual "Hicotea." con su punto lima.
 - Botón "a prueba de balas" (celda con fondo + enlace) y el enlace completo en
   texto debajo.

Las vigencias (horas, minutos, intentos) las pasa quien llama desde las
constantes reales de cada flujo: aquí no hay plazos propios.
"""

import html
import re
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse

from app.config import config
from app.correo import Correo
from app.modelo import reloj

# Tokens del kit (Identidad/variables_css_finales_tokens_css.md): claro y oscuro.
CLARO = {
    "fondo": "#F4FBF7", "superficie": "#FFFFFF", "superficie2": "#E6F4ED", "borde": "#C5DFD3",
    "texto": "#071912", "suave": "#3E6052", "acento": "#047857", "vivo": "#3F6212", "sobre_acento": "#FFFFFF",
    "marca": "#34D399", "aviso": "#D97706",
}
OSCURO = {
    "fondo": "#07100C", "superficie": "#0E1A15", "superficie2": "#16261F", "borde": "#223C30",
    "texto": "#ECFDF5", "suave": "#94B2A5", "acento": "#34D399", "vivo": "#A3E635", "sobre_acento": "#07100C",
}
FUENTE = "'Plus Jakarta Sans','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif"
MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace"

_MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
          "septiembre", "octubre", "noviembre", "diciembre")


@dataclass(frozen=True)
class Mensaje:
    asunto: str
    texto: str
    html: str

    def para(self, direccion: str) -> Correo:
        return Correo(para=direccion, asunto=self.asunto, texto=self.texto, html=self.html)


# ====================================================================== utilidades


def e(valor: object) -> str:
    """Escapa para HTML (texto y atributos)."""
    return html.escape(str(valor), quote=True)


def linea(valor: object) -> str:
    """Para el texto plano: sin caracteres de control (un nombre no puede
    "fabricar" líneas nuevas en el correo)."""
    return re.sub(r"[\x00-\x1f\x7f]+", " ", str(valor)).strip()


def url_segura(url: str) -> str:
    """Solo http(s) absolutas: un `javascript:` o una ruta relativa no entran a un href."""
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.netloc:
        raise ValueError("URL no permitida en un correo")
    return url


def url_publica(ruta: str = "") -> str:
    return url_segura(f"{config().url_publica.rstrip('/')}{ruta}")


def fecha_legible(momento: datetime) -> str:
    """Fecha en la zona de Hicotea (Colombia): un vencimiento a medianoche UTC es la tarde anterior allá."""
    if momento.tzinfo is not None:
        momento = momento.astimezone(reloj.ZONA)
    return f"{momento.day} de {_MESES[momento.month - 1]} de {momento.year}"


def _plural(n: int, singular: str, plural: str) -> str:
    return f"{n} {singular if n == 1 else plural}"


# ====================================================================== piezas HTML


def _p(contenido_html: str, *, suave: bool = False, tam: int = 16, margen: int = 16) -> str:
    color = CLARO["suave"] if suave else CLARO["texto"]
    clase = "h-suave" if suave else "h-texto"
    return (f'<p class="{clase}" style="margin:0 0 {margen}px 0;font-family:{FUENTE};font-size:{tam}px;'
            f'line-height:1.6;color:{color};">{contenido_html}</p>')


def _titulo(texto: str) -> str:
    return (f'<h1 class="h-texto" style="margin:0 0 16px 0;font-family:{FUENTE};font-size:24px;line-height:1.3;'
            f'font-weight:800;letter-spacing:-0.01em;color:{CLARO["texto"]};">{e(texto)}</h1>')


def _boton(url: str, etiqueta: str) -> str:
    u = e(url_segura(url))
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">'
        f'<tr><td class="h-boton" bgcolor="{CLARO["acento"]}" style="border-radius:10px;background:{CLARO["acento"]};">'
        f'<a class="h-boton-texto" href="{u}" target="_blank" rel="noopener" style="display:inline-block;'
        f'padding:14px 28px;font-family:{FUENTE};font-size:16px;font-weight:700;line-height:1.2;'
        f'color:{CLARO["sobre_acento"]};text-decoration:none;border-radius:10px;">{e(etiqueta)}</a>'
        "</td></tr></table>"
    )


def _enlace_alterno(url: str) -> str:
    u = e(url_segura(url))
    return (
        _p("¿El botón no funciona? Copia este enlace en tu navegador:", suave=True, tam=14, margen=6)
        + f'<p style="margin:0 0 24px 0;font-family:{MONO};font-size:13px;line-height:1.5;word-break:break-all;">'
        f'<a class="h-acento" href="{u}" target="_blank" rel="noopener" style="color:{CLARO["acento"]};'
        f'text-decoration:underline;">{u}</a></p>'
    )


def _codigo(codigo: str) -> str:
    """Bloque del PIN: grande, monoespaciado, fácil de leer y copiar."""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px 0;">'
        f'<tr><td class="h-caja" align="center" bgcolor="{CLARO["superficie2"]}" style="padding:20px 12px;'
        f'border-radius:12px;background:{CLARO["superficie2"]};border:1px solid {CLARO["borde"]};">'
        f'<span class="h-texto" style="font-family:{MONO};font-size:34px;line-height:1;font-weight:700;'
        f'letter-spacing:0.28em;color:{CLARO["texto"]};">{e(codigo)}</span>'
        "</td></tr></table>"
    )


def _detalles(filas: list[tuple[str, str]]) -> str:
    """Pares etiqueta/valor (datos de la cuenta, nunca financieros)."""
    celdas = "".join(
        f'<tr><td class="h-suave" style="padding:6px 16px 6px 0;font-family:{FUENTE};font-size:14px;'
        f'color:{CLARO["suave"]};white-space:nowrap;vertical-align:top;">{e(k)}</td>'
        f'<td class="h-texto" style="padding:6px 0;font-family:{FUENTE};font-size:14px;font-weight:600;'
        f'color:{CLARO["texto"]};word-break:break-word;">{e(v)}</td></tr>'
        for k, v in filas
    )
    return f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">{celdas}</table>'


def _nota(contenido_html: str, *, alerta: bool = False) -> str:
    """Recuadro con borde lateral: aclaraciones de seguridad."""
    borde = CLARO["aviso"] if alerta else CLARO["marca"]
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">'
        f'<tr><td class="h-nota" bgcolor="{CLARO["superficie2"]}" style="padding:14px 16px;background:{CLARO["superficie2"]};'
        f'border-left:4px solid {borde};border-radius:8px;font-family:{FUENTE};font-size:14px;line-height:1.55;'
        f'color:{CLARO["texto"]};"><span class="h-texto">{contenido_html}</span></td></tr></table>'
    )


def _estilos_oscuros() -> str:
    o = OSCURO
    return f"""<style>
  :root {{ color-scheme: light dark; supported-color-schemes: light dark; }}
  @media (max-width: 600px) {{
    .h-contenedor {{ padding: 24px 20px !important; }}
    .h-exterior {{ padding: 16px 8px !important; }}
  }}
  @media (prefers-color-scheme: dark) {{
    .h-fondo {{ background: {o['fondo']} !important; }}
    .h-tarjeta {{ background: {o['superficie']} !important; border-color: {o['borde']} !important;
                  border-top-color: {CLARO['marca']} !important; }}
    .h-caja {{ background: {o['superficie2']} !important; border-color: {o['borde']} !important; }}
    .h-nota {{ background: {o['superficie2']} !important; }}
    .h-texto {{ color: {o['texto']} !important; }}
    .h-suave {{ color: {o['suave']} !important; }}
    .h-acento {{ color: {o['acento']} !important; }}
    .h-vivo {{ color: {o['vivo']} !important; }}
    .h-boton {{ background: {o['acento']} !important; }}
    .h-boton-texto {{ color: {o['sobre_acento']} !important; }}
  }}
</style>"""


def _marco(*, asunto: str, preencabezado: str, cuerpo: str, motivo: str) -> str:
    """Documento completo. `motivo` explica en el pie por qué llega el correo."""
    c = CLARO
    inicio = e(url_publica("/"))
    dominio = e(urlparse(config().url_publica).netloc)
    # Relleno tras el preencabezado para que el cliente no muestre el cuerpo en la vista previa.
    relleno = "&#847;&zwnj;&nbsp;" * 40
    return f"""<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{e(asunto)}</title>
{_estilos_oscuros()}
</head>
<body class="h-fondo" style="margin:0;padding:0;background:{c['fondo']};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:{c['fondo']};">{e(preencabezado)}{relleno}</div>
<table role="presentation" class="h-fondo" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{c['fondo']}" style="background:{c['fondo']};">
<tr><td class="h-exterior" align="center" style="padding:32px 16px;">
  <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
    <tr><td style="padding:0 4px 18px 4px;">
      <a href="{inicio}" target="_blank" rel="noopener" style="text-decoration:none;font-family:{FUENTE};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:{c['texto']};"><span class="h-texto" style="color:{c['texto']};">Hicotea</span><span class="h-vivo" style="color:{c['vivo']};">.</span></a>
    </td></tr>
    <tr><td class="h-tarjeta h-contenedor" bgcolor="{c['superficie']}" style="background:{c['superficie']};border:1px solid {c['borde']};border-top:4px solid {c['marca']};border-radius:16px;padding:32px 32px 28px 32px;">
{cuerpo}
    </td></tr>
    <tr><td style="padding:20px 8px 0 8px;">
      {_p(e(motivo), suave=True, tam=12, margen=6)}
      {_p(f'Correo automático de Hicotea · <a class="h-suave" href="{inicio}" target="_blank" rel="noopener" style="color:{c["suave"]};text-decoration:underline;">{dominio}</a> · No respondas a este mensaje.', suave=True, tam=12, margen=0)}
    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
"""


def _pie_texto(motivo: str) -> str:
    return f"\n\n—\n{motivo}\nCorreo automático de Hicotea ({config().url_publica.rstrip('/')}). No respondas a este mensaje."


# ====================================================================== plantillas


def verificacion(nombre: str, usuario: str, enlace: str, horas: int) -> Mensaje:
    asunto = "Confirma tu correo en Hicotea"
    vigencia = _plural(horas, "hora", "horas")
    motivo = "Recibes este correo porque alguien escribió esta dirección en una cuenta de Hicotea."
    texto = (
        f"Hola, {linea(nombre)}.\n\n"
        f"Para usar esta dirección en tu cuenta de Hicotea ({linea(usuario)}), abre este enlace:\n\n"
        f"{url_segura(enlace)}\n\n"
        f"Vence en {vigencia} y sirve una sola vez. Mientras no lo abras, "
        "esta dirección no recibirá el PIN de recuperación.\n\n"
        "Si no lo pediste, ignora este correo: nada cambia."
        + _pie_texto(motivo)
    )
    cuerpo = (
        _titulo("Confirma tu correo")
        + _p(f"Hola, {e(nombre)}.")
        + _p(f"Para usar esta dirección en tu cuenta de Hicotea <strong>{e(usuario)}</strong>, confírmala con el botón:")
        + _boton(enlace, "Confirmar mi correo")
        + _enlace_alterno(enlace)
        + _nota(f"El enlace vence en <strong>{e(vigencia)}</strong> y sirve una sola vez. Mientras no lo abras, "
                "esta dirección no recibirá el PIN de recuperación.")
        + _p("Si no lo pediste, ignora este correo: nada cambia en tu cuenta.", suave=True, tam=14, margen=0)
    )
    html_ = _marco(asunto=asunto, preencabezado=f"Abre el enlace en las próximas {vigencia} para confirmar tu correo.",
                   cuerpo=cuerpo, motivo=motivo)
    return Mensaje(asunto, texto, html_)


def recuperacion_pin(nombre: str, usuario: str, pin: str, minutos: int, intentos: int) -> Mensaje:
    asunto = "Tu PIN para restablecer la contraseña de Hicotea"
    vigencia = _plural(minutos, "minuto", "minutos")
    n_intentos = _plural(intentos, "intento", "intentos")
    pagina = url_publica("/restablecer")
    motivo = "Recibes este correo porque se pidió restablecer la contraseña de la cuenta que usa esta dirección."
    texto = (
        f"Hola, {linea(nombre)}.\n\n"
        f"Tu PIN es: {linea(pin)}\n\n"
        f"Escríbelo en Hicotea junto con tu usuario ({linea(usuario)}) para elegir una contraseña nueva:\n"
        f"{pagina}\n\n"
        f"Vence en {vigencia} y admite {n_intentos}.\n\n"
        "Si no lo pediste, ignora este correo: tu contraseña no cambia. Nadie de Hicotea te pedirá este PIN."
        + _pie_texto(motivo)
    )
    cuerpo = (
        _titulo("Restablece tu contraseña")
        + _p(f"Hola, {e(nombre)}. Este es tu PIN:")
        + _codigo(pin)
        + _p(f"Escríbelo en Hicotea junto con tu usuario <strong>{e(usuario)}</strong> para elegir una contraseña nueva.")
        + _boton(pagina, "Ir a restablecer")
        + _nota(f"Vence en <strong>{e(vigencia)}</strong> y admite <strong>{e(n_intentos)}</strong>. "
                "Nadie de Hicotea te pedirá este PIN: no lo compartas.")
        + _p("Si no lo pediste, ignora este correo: tu contraseña no cambia.", suave=True, tam=14, margen=0)
    )
    # El PIN no va en el asunto ni en el preencabezado (se ven en notificaciones de pantalla bloqueada).
    html_ = _marco(asunto=asunto, preencabezado=f"Tu PIN vence en {vigencia}.", cuerpo=cuerpo, motivo=motivo)
    return Mensaje(asunto, texto, html_)


def invitacion(enlace: str, expira_en: datetime, nota: str | None = None) -> Mensaje:
    """Preparada, **sin integrar**: hoy el enlace lo comparte quien administra por
    un canal privado (ver docs/correo-transaccional.md)."""
    asunto = "Te invitaron a Hicotea"
    vence = fecha_legible(expira_en)
    motivo = "Recibes este correo porque quien administra Hicotea te invitó a crear una cuenta."
    texto = (
        "Hola.\n\n"
        "Te invitaron a crear una cuenta en Hicotea, una app personal para llevar tus ingresos, gastos y ahorros.\n\n"
        + (f"Mensaje: {linea(nota)}\n\n" if nota else "")
        + f"Crea tu cuenta con este enlace:\n{url_segura(enlace)}\n\n"
        f"Vence el {vence} y sirve una sola vez.\n\n"
        "Si no esperabas esta invitación, ignora este correo."
        + _pie_texto(motivo)
    )
    cuerpo = (
        _titulo("Te invitaron a Hicotea")
        + _p("Hicotea es una app personal para llevar tus ingresos, gastos y ahorros, a paso lento pero seguro.")
        + (_nota(e(nota)) + '<div style="height:12px;line-height:12px;">&nbsp;</div>' if nota else "")
        + _boton(enlace, "Crear mi cuenta")
        + _enlace_alterno(enlace)
        + _p(f"La invitación vence el <strong>{e(vence)}</strong> y sirve una sola vez.", suave=True, tam=14)
        + _p("Si no la esperabas, ignora este correo.", suave=True, tam=14, margen=0)
    )
    html_ = _marco(asunto=asunto, preencabezado=f"Crea tu cuenta antes del {vence}.", cuerpo=cuerpo, motivo=motivo)
    return Mensaje(asunto, texto, html_)


def aviso_seguridad(
    *, asunto: str, titulo: str, nombre: str, parrafos: list[str], detalles: list[tuple[str, str]] | None = None
) -> Mensaje:
    """Base de los avisos de seguridad: qué pasó, datos de la cuenta y qué hacer
    si no fue la persona. `parrafos` es texto plano (se escapa aquí)."""
    motivo = "Recibes este aviso de seguridad porque esta es la dirección verificada de tu cuenta de Hicotea."
    accion = "Si no fuiste tú, avisa de inmediato a quien administra Hicotea."
    texto = (
        f"Hola, {linea(nombre)}.\n\n"
        + "\n\n".join(linea(p) for p in parrafos)
        + ("\n\n" + "\n".join(f"{linea(k)}: {linea(v)}" for k, v in detalles) if detalles else "")
        + f"\n\n{accion}"
        + _pie_texto(motivo)
    )
    cuerpo = (
        _titulo(titulo)
        + _p(f"Hola, {e(nombre)}.")
        + "".join(_p(e(p)) for p in parrafos)
        + (_detalles(detalles) if detalles else "")
        + _nota(f"<strong>{e(accion)}</strong>", alerta=True)
    )
    html_ = _marco(asunto=asunto, preencabezado=linea(parrafos[0]) if parrafos else titulo, cuerpo=cuerpo, motivo=motivo)
    return Mensaje(asunto, texto, html_)


def aviso_contrasena_cambiada(nombre: str, usuario: str, *, desde_perfil: bool) -> Mensaje:
    que = ("La contraseña de tu cuenta se cambió desde tu perfil y se cerraron tus otras sesiones."
           if desde_perfil else
           "La contraseña de tu cuenta se restableció con un PIN y se cerraron todas tus sesiones.")
    return aviso_seguridad(
        asunto="Tu contraseña de Hicotea cambió", titulo="Tu contraseña cambió", nombre=nombre,
        parrafos=[que], detalles=[("Usuario", usuario)],
    )


def aviso_correo_cambiado(nombre: str, usuario: str, nuevo: str) -> Mensaje:
    return aviso_seguridad(
        asunto="El correo de tu cuenta de Hicotea cambió", titulo="Tu correo cambió", nombre=nombre,
        parrafos=["El correo de tu cuenta se cambió por otro. Desde ahora el PIN de recuperación y los avisos "
                  "llegarán a la dirección nueva, no a esta."],
        detalles=[("Usuario", usuario), ("Correo nuevo", nuevo)],
    )


def prueba() -> Mensaje:
    """Para `python -m app.cli correo probar`: sin datos de ninguna cuenta."""
    asunto = "Prueba de correo de Hicotea"
    motivo = "Recibes este correo porque quien administra Hicotea probó la configuración de envío con esta dirección."
    texto = ("Si lees esto, Hicotea puede enviar correos con la configuración actual.\n\n"
             "No contiene datos de ninguna cuenta." + _pie_texto(motivo))
    cuerpo = (
        _titulo("El correo funciona")
        + _p("Si lees esto, Hicotea puede enviar correos con la configuración actual.")
        + _nota("Revisa que haya llegado a la bandeja de entrada (no a spam) y que el remitente se vea bien.")
        + _p("No contiene datos de ninguna cuenta.", suave=True, tam=14, margen=0)
    )
    return Mensaje(asunto, texto, _marco(asunto=asunto, preencabezado="La configuración de envío funciona.",
                                         cuerpo=cuerpo, motivo=motivo))
