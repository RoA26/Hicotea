import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { auth, cuenta, ErrorApi } from '../api/cliente'
import { useSesion } from '../componentes/Globales'
import { MarcoAuth } from '../componentes/MarcoAuth'
import { AlertaError, AlertaExito, BotonEnlace } from '../componentes/ui'

type Estado = { tipo: 'verificando' } | { tipo: 'listo'; mensaje: string } | { tipo: 'error'; mensaje: string }

/**
 * Destino del enlace de verificación (/verificar-correo?token=...). Funciona con
 * o sin sesión: el enlace puede abrirse en otro dispositivo. El token se lee una
 * sola vez y se quita de la barra de direcciones (y del historial).
 */
export default function VerificarCorreo() {
  const [q] = useSearchParams()
  const navegar = useNavigate()
  const { usuario, setUsuario } = useSesion()
  // Se lee una vez: después se quita de la URL.
  const [token] = useState(() => q.get('token')?.trim() ?? '')
  const enviado = useRef(false)
  const [estado, setEstado] = useState<Estado>(
    token ? { tipo: 'verificando' } : { tipo: 'error', mensaje: 'El enlace está incompleto. Ábrelo de nuevo desde el correo o pide otro desde tu perfil.' },
  )

  useEffect(() => {
    // Un solo intento aunque React monte dos veces en desarrollo: el enlace es de un solo uso.
    if (!token || enviado.current) return
    enviado.current = true
    navegar('/verificar-correo', { replace: true })
    cuenta.verificarCorreo(token).then(
      (r) => {
        setEstado({ tipo: 'listo', mensaje: r.mensaje })
        // Si hay sesión abierta (puede ser la misma cuenta), refresca el usuario.
        auth.yo().then(setUsuario, () => undefined)
      },
      (e) => setEstado({ tipo: 'error', mensaje: e instanceof ErrorApi ? e.message : 'No pudimos verificar el correo. Intenta de nuevo.' }),
    )
  }, [token, navegar, setUsuario])

  return (
    <MarcoAuth titulo="Verificar correo">
      <div className="space-y-4" aria-live="polite">
        {estado.tipo === 'verificando' && <p className="text-sm text-texto-suave">Verificando tu correo…</p>}
        {estado.tipo === 'listo' && <AlertaExito mensaje={estado.mensaje} />}
        {estado.tipo === 'error' && <AlertaError mensaje={estado.mensaje} />}
        {estado.tipo !== 'verificando' &&
          (usuario ? (
            <BotonEnlace to="/perfil" className="w-full">
              Ir a tu perfil
            </BotonEnlace>
          ) : (
            <BotonEnlace to="/login" className="w-full">
              Iniciar sesión
            </BotonEnlace>
          ))}
        {estado.tipo === 'error' && !usuario && (
          <p className="text-center text-sm text-texto-suave">
            <Link to="/" className="hover:text-texto hover:underline">
              Volver al inicio
            </Link>
          </p>
        )}
      </div>
    </MarcoAuth>
  )
}
