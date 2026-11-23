"""Correo: composición MIME, plantillas, escape, configuración SMTP, errores y CLI.
Sin red ni base de datos: el servidor SMTP es un doble de prueba."""

import email
import logging
import smtplib
import socket
import ssl
from datetime import UTC, datetime
from email import policy

import pytest

from app import cli, correo
from app import plantillas_correo as plantillas
from app.config import Config

SECRETO = "re_clave-super-secreta-123"
VALIDA = dict(
    correo_modo="smtp", correo_remitente="Hicotea <no-responder@hicotea.example.co>",
    smtp_host="smtp.proveedor.test", smtp_puerto=465, smtp_usuario="resend", smtp_contrasena=SECRETO,
    smtp_seguridad="ssl", url_publica="https://hicotea.duckdns.org",
)


def cfg(**cambios) -> Config:
    return Config(_env_file=None, **{**VALIDA, **cambios})


@pytest.fixture
def usar_config(monkeypatch):
    """Reemplaza la configuración global (correo, plantillas y CLI la leen con config())."""
    def fijar(c: Config) -> Config:
        for modulo in (correo, plantillas, cli):
            monkeypatch.setattr(modulo, "config", lambda: c)
        return c
    fijar(cfg())
    return fijar


@pytest.fixture(autouse=True)
def sin_reemplazo():
    correo.usar_transporte(None)
    yield
    correo.usar_transporte(None)


class ServidorFalso:
    """Doble de smtplib.SMTP / SMTP_SSL que registra lo que se le pide."""

    instancias: list["ServidorFalso"] = []
    falla: BaseException | None = None

    def __init__(self, host, puerto, timeout=None, context=None):
        self.host, self.puerto, self.timeout, self.context = host, puerto, timeout, context
        self.pasos: list[str] = []
        self.login_con: tuple[str, str] | None = None
        self.mensaje = None
        ServidorFalso.instancias.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.pasos.append("quit")

    def starttls(self, context=None):
        self.pasos.append("starttls")

    def login(self, usuario, contrasena):
        self.pasos.append("login")
        self.login_con = (usuario, contrasena)
        if ServidorFalso.falla:
            raise ServidorFalso.falla

    def send_message(self, mensaje):
        self.pasos.append("send")
        self.mensaje = mensaje


@pytest.fixture
def smtp_falso(monkeypatch):
    ServidorFalso.instancias = []
    ServidorFalso.falla = None
    planos, seguros = [], []

    def plano(*a, **k):
        s = ServidorFalso(*a, **k)
        planos.append(s)
        return s

    def seguro(*a, **k):
        s = ServidorFalso(*a, **k)
        seguros.append(s)
        return s

    monkeypatch.setattr(smtplib, "SMTP", plano)
    monkeypatch.setattr(smtplib, "SMTP_SSL", seguro)
    return {"planos": planos, "seguros": seguros}


# ====================================================================== MIME


def test_solo_texto_es_text_plain():
    m = correo.componer(correo.Correo("a@ejemplo.co", "Hola", "Texto ñ"), "Hicotea <no-responder@hicotea.co>")
    assert m.get_content_type() == "text/plain"
    assert m.get_content().strip() == "Texto ñ"
    assert m["Auto-Submitted"] == "auto-generated" and m["Message-ID"].endswith("@hicotea.co>") and m["Date"]


def test_con_html_es_multipart_alternative_con_texto_primero():
    c = correo.Correo("a@ejemplo.co", "Hola", "Versión texto", html="<p>Versión <b>HTML</b></p>")
    crudo = bytes(correo.componer(c, "Hicotea <no-responder@hicotea.co>"))
    m = email.message_from_bytes(crudo, policy=policy.default)
    assert m.get_content_type() == "multipart/alternative"
    partes = list(m.iter_parts())
    assert [p.get_content_type() for p in partes] == ["text/plain", "text/html"]
    assert all(p.get_content_charset() == "utf-8" for p in partes)
    assert partes[0].get_content().strip() == "Versión texto"
    assert "<b>HTML</b>" in partes[1].get_content()


def test_cabeceras_no_admiten_saltos_de_linea():
    c = correo.Correo("a@ejemplo.co\nBcc: otro@ejemplo.co", "Hola", "x")
    with pytest.raises(ValueError):
        correo.componer(c, "Hicotea <no-responder@hicotea.co>")


# ====================================================================== plantillas


def _todas(usar_config):
    return {
        "verificacion": plantillas.verificacion("Ana", "ana", "https://hicotea.duckdns.org/verificar-correo?token=abc", 24),
        "pin": plantillas.recuperacion_pin("Ana", "ana", "042917", 15, 5),
        "invitacion": plantillas.invitacion("https://hicotea.duckdns.org/registro?invitacion=abc",
                                            datetime(2026, 11, 21, 15, tzinfo=UTC)),
        "contrasena": plantillas.aviso_contrasena_cambiada("Ana", "ana", desde_perfil=True),
        "correo": plantillas.aviso_correo_cambiado("Ana", "ana", "nueva@ejemplo.co"),
        "prueba": plantillas.prueba(),
    }


def test_todas_las_plantillas_tienen_texto_y_html_sin_recursos_externos(usar_config):
    for nombre, m in _todas(usar_config).items():
        assert m.asunto and m.texto.strip() and m.html.startswith("<!doctype html>"), nombre
        bajo = m.html.lower()
        # Sin JavaScript, imágenes, píxeles, hojas de estilo o fuentes remotas.
        for prohibido in ("<script", "<img", "src=", "<link", "@import", "url(", "javascript:"):
            assert prohibido not in bajo, (nombre, prohibido)
        # Todo enlace va a la URL pública configurada (sin dominios de seguimiento).
        import re
        for href in re.findall(r'href="([^"]+)"', m.html):
            assert href.startswith("https://hicotea.duckdns.org"), (nombre, href)
        assert "max-width:560px" in m.html and 'lang="es"' in m.html


def test_el_dato_dinamico_se_escapa(usar_config):
    malicioso = '<script>alert(1)</script>"><img src=x onerror=alert(2)>'
    m = plantillas.verificacion(malicioso, malicioso, "https://hicotea.duckdns.org/verificar-correo?token=a&b=<c>", 24)
    assert "<script>" not in m.html and "<img" not in m.html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in m.html
    assert 'token=a&amp;b=&lt;c&gt;"' in m.html  # también dentro del href
    a = plantillas.aviso_correo_cambiado(malicioso, "ana", "x@ejemplo.co")
    assert "<script>" not in a.html


def test_el_texto_plano_no_admite_lineas_fabricadas(usar_config):
    m = plantillas.verificacion("Ana\n\nTu PIN es: 000000", "ana", "https://hicotea.duckdns.org/v?token=x", 24)
    assert "Hola, Ana Tu PIN es: 000000." in m.texto
    assert "\n\nTu PIN es" not in m.texto


def test_solo_urls_http_absolutas(usar_config):
    for mala in ("javascript:alert(1)", "/verificar-correo?token=x", "data:text/html,hola", "ftp://x.co/a"):
        with pytest.raises(ValueError):
            plantillas.verificacion("Ana", "ana", mala, 24)


def test_vigencias_reales_y_pin_fuera_del_asunto(usar_config):
    v = plantillas.verificacion("Ana", "ana", "https://hicotea.duckdns.org/v?token=x", 24)
    assert "24 horas" in v.texto and "24 horas" in v.html
    p = plantillas.recuperacion_pin("Ana", "ana", "042917", 15, 5)
    assert "15 minutos" in p.texto and "5 intentos" in p.texto and "042917" in p.texto and "042917" in p.html
    assert "042917" not in p.asunto
    # El preencabezado (vista previa de la bandeja) tampoco lleva el PIN.
    preencabezado = p.html.split('mso-hide:all')[1].split("</div>")[0]
    assert "042917" not in preencabezado
    uno = plantillas.recuperacion_pin("Ana", "ana", "1", 1, 1)
    assert "1 minuto " in uno.texto and "1 intento." in uno.texto


def test_invitacion_muestra_la_fecha_en_hora_de_colombia(usar_config):
    # 03:00 UTC del 22 = 22:00 del 21 en Bogotá.
    m = plantillas.invitacion("https://hicotea.duckdns.org/registro?invitacion=x", datetime(2026, 11, 22, 3, tzinfo=UTC))
    assert "21 de noviembre de 2026" in m.texto


def test_los_avisos_no_llevan_datos_financieros(usar_config):
    for m in _todas(usar_config).values():
        for palabra in ("saldo", "$", "cajita", "movimiento", "ingresos de", "monto"):
            assert palabra not in m.texto.lower(), palabra


# ====================================================================== configuración SMTP


def test_configuracion_completa_esta_disponible(usar_config):
    assert correo.problemas_smtp() == []
    assert correo.disponible() is True


@pytest.mark.parametrize("cambios, fragmento", [
    ({"smtp_host": None}, "Falta HICOTEA_SMTP_HOST"),
    ({"smtp_host": "  "}, "Falta HICOTEA_SMTP_HOST"),
    ({"smtp_contrasena": None}, "falta HICOTEA_SMTP_CONTRASENA"),
    ({"smtp_usuario": None}, "falta HICOTEA_SMTP_USUARIO"),
    ({"smtp_seguridad": "ninguna", "smtp_puerto": 25}, "sin cifrar"),
    ({"correo_remitente": "Hicotea <no-responder@localhost>"}, "dominio de ejemplo o local"),
    ({"correo_remitente": "no es un correo"}, "no es una dirección válida"),
    ({"correo_remitente": "Hicotea <x@sinpunto>"}, "no es una dirección válida"),
    ({"correo_remitente": "x@example.com"}, "dominio de ejemplo"),
    ({"url_publica": "hicotea.duckdns.org"}, "HICOTEA_URL_PUBLICA"),
])
def test_configuracion_incompleta_no_habilita_el_correo(usar_config, cambios, fragmento):
    usar_config(cfg(**cambios))
    problemas = " ".join(correo.problemas_smtp())
    assert fragmento in problemas
    assert SECRETO not in problemas
    assert correo.disponible() is False
    assert correo.enviar(correo.Correo("a@ejemplo.co", "x", "y")) is False


def test_relay_local_sin_credenciales_ni_cifrado_es_valido(usar_config):
    usar_config(cfg(smtp_usuario=None, smtp_contrasena=None, smtp_seguridad="ninguna", smtp_puerto=25))
    assert correo.disponible() is True


def test_avisos_de_puerto_y_url(usar_config):
    assert any("ssl" in a for a in correo.avisos_smtp(cfg(smtp_seguridad="starttls", smtp_puerto=465)))
    assert any("starttls" in a for a in correo.avisos_smtp(cfg(smtp_seguridad="ssl", smtp_puerto=587)))
    assert any("este equipo" in a for a in correo.avisos_smtp(cfg(url_publica="http://localhost:5173")))
    assert correo.avisos_smtp(cfg()) == []


def test_la_contrasena_no_aparece_en_la_representacion_de_la_config():
    c = cfg()
    assert SECRETO not in repr(c) and SECRETO not in str(c.model_dump())


def test_al_arrancar_explica_la_configuracion_incompleta_sin_secretos(usar_config, caplog):
    usar_config(cfg(smtp_host=None))
    with caplog.at_level(logging.ERROR, logger="hicotea.correo"):
        correo.revisar_al_arrancar()
    assert "HICOTEA_SMTP_HOST" in caplog.text and SECRETO not in caplog.text


# ====================================================================== transporte SMTP


def test_ssl_implicito(usar_config, smtp_falso):
    usar_config(cfg(smtp_seguridad="ssl", smtp_puerto=465, smtp_timeout=7))
    assert correo.enviar(plantillas.prueba().para("dest@ejemplo.co")) is True
    s = smtp_falso["seguros"][0]
    assert not smtp_falso["planos"]
    assert (s.host, s.puerto, s.timeout) == ("smtp.proveedor.test", 465, 7)
    assert isinstance(s.context, ssl.SSLContext) and s.context.verify_mode == ssl.CERT_REQUIRED
    assert s.pasos == ["login", "send", "quit"] and s.login_con == ("resend", SECRETO)
    assert s.mensaje.get_content_type() == "multipart/alternative"
    assert s.mensaje["From"] == "Hicotea <no-responder@hicotea.example.co>"


def test_starttls_antes_de_autenticar(usar_config, smtp_falso):
    usar_config(cfg(smtp_seguridad="starttls", smtp_puerto=587))
    assert correo.enviar(correo.Correo("dest@ejemplo.co", "x", "y")) is True
    s = smtp_falso["planos"][0]
    assert s.pasos == ["starttls", "login", "send", "quit"]


def test_sin_credenciales_no_hay_login(usar_config, smtp_falso):
    usar_config(cfg(smtp_usuario=None, smtp_contrasena=None, smtp_seguridad="starttls", smtp_puerto=587))
    correo.enviar(correo.Correo("dest@ejemplo.co", "x", "y"))
    assert smtp_falso["planos"][0].pasos == ["starttls", "send", "quit"]


def test_un_fallo_se_registra_sin_secretos_ni_contenido(usar_config, smtp_falso, caplog):
    ServidorFalso.falla = smtplib.SMTPAuthenticationError(535, f"Invalid API key {SECRETO}".encode())
    with caplog.at_level(logging.ERROR, logger="hicotea.correo"):
        ok = correo.enviar(correo.Correo("dest@ejemplo.co", "Asunto", "PIN 042917", html="<p>PIN 042917</p>"))
    assert ok is False
    assert "SMTPAuthenticationError" in caplog.text and "usuario o la contraseña" in caplog.text
    for filtrado in (SECRETO, "042917", "dest@ejemplo.co"):
        assert filtrado not in caplog.text


@pytest.mark.parametrize("error, fragmento", [
    (smtplib.SMTPAuthenticationError(535, b"no"), "usuario o la contraseña"),
    (smtplib.SMTPSenderRefused(550, b"no", "x@y.co"), "remitente"),
    (smtplib.SMTPRecipientsRefused({}), "destino"),
    (ssl.SSLError("wrong version"), "TLS"),
    (TimeoutError(), "a tiempo"),
    (socket.gaierror(), "host"),
    (ConnectionRefusedError(), "rechazó la conexión"),
    (smtplib.SMTPServerDisconnected(), "cerró la conexión"),
    (smtplib.SMTPDataError(554, b"Domain not verified"), "554"),
    (correo.ConfiguracionIncompleta("Falta X."), "Configuración incompleta"),
])
def test_errores_explicados(error, fragmento):
    texto = correo.describir_error(error)
    assert fragmento in texto
    assert "Domain not verified" not in texto  # no repite la respuesta del servidor


def test_timeout_por_defecto_y_limites():
    assert Config(_env_file=None).smtp_timeout == 15
    with pytest.raises(ValueError):
        Config(_env_file=None, smtp_timeout=0)
    with pytest.raises(ValueError):
        Config(_env_file=None, smtp_puerto=70000)


# ====================================================================== consola y memoria


def test_consola_escribe_el_texto_y_menciona_el_html(usar_config, caplog):
    usar_config(cfg(correo_modo="consola"))
    with caplog.at_level(logging.WARNING, logger="hicotea.correo"):
        assert correo.enviar(correo.Correo("a@ejemplo.co", "Asunto", "Cuerpo", html="<p>x</p>")) is True
    assert "Cuerpo" in caplog.text and "versión HTML" in caplog.text and "<p>x</p>" not in caplog.text


def test_buzon_de_memoria_guarda_texto_y_html():
    b = correo.BuzonMemoria()
    correo.usar_transporte(b)
    assert correo.disponible()
    correo.enviar(correo.Correo("a@ejemplo.co", "A", "t", html="<p>h</p>"))
    correo.enviar(correo.Correo("b@ejemplo.co", "B", "t"))  # compatible: sin HTML
    assert [(c.para, c.html) for c in b.enviados] == [("a@ejemplo.co", "<p>h</p>"), ("b@ejemplo.co", None)]


# ====================================================================== CLI


def test_cli_estado_no_muestra_secretos(usar_config, capsys):
    assert cli.main(["correo", "estado"]) == 0
    salida = capsys.readouterr().out
    assert "Disponible: sí" in salida and "definida" in salida and SECRETO not in salida


def test_cli_estado_incompleto(usar_config, capsys):
    usar_config(cfg(smtp_host=None))
    assert cli.main(["correo", "estado"]) == 1
    assert "Falta HICOTEA_SMTP_HOST" in capsys.readouterr().out


def test_cli_probar_envia_solo_a_la_direccion_indicada(usar_config, smtp_falso, capsys):
    assert cli.main(["correo", "probar", "yo@ejemplo.co", "--si"]) == 0
    s = smtp_falso["seguros"][0]
    assert s.mensaje["To"] == "yo@ejemplo.co" and s.mensaje["Subject"] == "Prueba de correo de Hicotea"
    assert SECRETO not in capsys.readouterr().out


def test_cli_probar_explica_el_fallo(usar_config, smtp_falso, capsys):
    ServidorFalso.falla = smtplib.SMTPAuthenticationError(535, SECRETO.encode())
    assert cli.main(["correo", "probar", "yo@ejemplo.co", "--si"]) == 1
    err = capsys.readouterr().err
    assert "usuario o la contraseña" in err and SECRETO not in err


def test_cli_probar_rechaza_direcciones_raras_y_sin_confirmacion(usar_config, smtp_falso, monkeypatch, capsys):
    assert cli.main(["correo", "probar", "a@b.co, c@d.co", "--si"]) == 2
    assert cli.main(["correo", "probar", "no-es-correo", "--si"]) == 2
    monkeypatch.setattr("sys.stdin.isatty", lambda: False)
    assert cli.main(["correo", "probar", "yo@ejemplo.co"]) == 2  # sin --si ni terminal: no envía
    assert not smtp_falso["seguros"] and not smtp_falso["planos"]


def test_cli_probar_con_correo_deshabilitado(usar_config, capsys):
    usar_config(cfg(correo_modo="ninguno"))
    assert cli.main(["correo", "probar", "yo@ejemplo.co", "--si"]) == 1


def test_cli_vista_previa_con_datos_ficticios(usar_config, tmp_path):
    assert cli.main(["correo", "vista-previa", str(tmp_path)]) == 0
    archivos = sorted(p.name for p in tmp_path.iterdir())
    assert len(archivos) == 18 and "verificacion.eml" in archivos
    eml = email.message_from_bytes((tmp_path / "recuperacion-pin.eml").read_bytes(), policy=policy.default)
    assert eml.get_content_type() == "multipart/alternative"
    assert "&lt;Prueba&gt; &amp; Cía" in (tmp_path / "verificacion.html").read_text()
