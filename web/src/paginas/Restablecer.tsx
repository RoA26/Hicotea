import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { auth } from '../api/cliente'
import { useAvisar } from '../componentes/Globales'
import { MarcoAuth } from '../componentes/MarcoAuth'
import { AlertaError, AlertaExito, Boton, Campo, Entrada } from '../componentes/ui'
import { useEnvio } from '../lib/datos'

export default function Restablecer() {
  const navegar = useNavigate()
  const avisar = useAvisar()
  const estado = useLocation().state as { usuario?: string; mensaje?: string } | null
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState({ nombre_usuario: estado?.usuario ?? '', pin: '', contrasena: '', confirmacion_contrasena: '' })
  const campo = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
    'aria-invalid': !!errores[k] || undefined,
  })

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => auth.restablecer(f))
    if (r) {
      avisar(r.mensaje)
      navegar('/login', { replace: true })
    }
  }

  return (
    <MarcoAuth
      titulo="Nueva contraseña"
      pie={
        <Link to="/login" className="hover:text-texto hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      <form onSubmit={alEnviar} className="space-y-4">
        <AlertaExito mensaje={estado?.mensaje ?? null} />
        <Campo etiqueta="Usuario o correo" error={errores.nombre_usuario} ayuda="El mismo que usaste para pedir el PIN.">
          <Entrada {...campo('nombre_usuario')} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required />
        </Campo>
        <Campo etiqueta="PIN" error={errores.pin}>
          <Entrada {...campo('pin')} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="cifra tracking-[0.4em]" required />
        </Campo>
        <Campo etiqueta="Contraseña nueva" error={errores.contrasena} ayuda="Mínimo 8 caracteres. Al cambiarla se cierran tus sesiones abiertas.">
          <Entrada {...campo('contrasena')} type="password" autoComplete="new-password" minLength={8} required />
        </Campo>
        <Campo etiqueta="Repite la contraseña" error={errores.confirmacion_contrasena}>
          <Entrada {...campo('confirmacion_contrasena')} type="password" autoComplete="new-password" minLength={8} required />
        </Campo>
        <AlertaError mensaje={error} />
        <Boton type="submit" className="w-full" cargando={enviando}>
          Cambiar contraseña
        </Boton>
      </form>
    </MarcoAuth>
  )
}
