import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { auth } from '../api/cliente'
import { useSesion } from '../componentes/Globales'
import { MarcoAuth } from '../componentes/MarcoAuth'
import { AlertaError, Boton, Campo, Entrada } from '../componentes/ui'
import { useEnvio } from '../lib/datos'

export default function Login() {
  const navegar = useNavigate()
  const destino = (useLocation().state as { desde?: string } | null)?.desde ?? '/inicio'
  const { setUsuario } = useSesion()
  const { enviando, error, enviar } = useEnvio()
  const [usuario, setNombre] = useState('')
  const [contrasena, setContrasena] = useState('')

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const u = await enviar(() => auth.login({ nombre_usuario: usuario, contrasena }))
    if (u) {
      setUsuario(u)
      navegar(destino, { replace: true })
    }
  }

  return (
    <MarcoAuth
      titulo="Iniciar sesión"
      subtitulo="Qué bueno verte de nuevo."
      pie={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-semibold text-acento hover:underline">
            Regístrate
          </Link>
        </>
      }
    >
      <form onSubmit={alEnviar} className="space-y-4">
        <Campo etiqueta="Usuario">
          <Entrada value={usuario} onChange={(e) => setNombre(e.target.value)} autoComplete="username" autoCapitalize="none" required />
        </Campo>
        <Campo etiqueta="Contraseña">
          <Entrada type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="current-password" required />
        </Campo>
        <AlertaError mensaje={error} />
        <Boton type="submit" className="w-full" cargando={enviando}>
          Entrar
        </Boton>
        <p className="text-center text-sm">
          <Link to="/recuperar" className="text-texto-suave hover:text-texto hover:underline">
            Olvidé mi contraseña
          </Link>
        </p>
      </form>
    </MarcoAuth>
  )
}
