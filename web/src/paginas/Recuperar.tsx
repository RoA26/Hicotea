import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { auth } from '../api/cliente'
import { MarcoAuth } from '../componentes/MarcoAuth'
import { AlertaError, Boton, Campo, Entrada } from '../componentes/ui'
import { useEnvio } from '../lib/datos'

export default function Recuperar() {
  const navegar = useNavigate()
  const { enviando, error, enviar } = useEnvio()
  const [usuario, setUsuario] = useState('')

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => auth.recuperar(usuario))
    if (r) navegar('/restablecer', { state: { usuario, mensaje: r.mensaje } })
  }

  return (
    <MarcoAuth
      titulo="Recuperar contraseña"
      subtitulo="Generamos un PIN de 6 dígitos. Quien administra Hicotea te lo dará; vence en 15 minutos."
      pie={
        <Link to="/login" className="hover:text-texto hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      <form onSubmit={alEnviar} className="space-y-4">
        <Campo etiqueta="Usuario">
          <Entrada value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoCapitalize="none" required />
        </Campo>
        <AlertaError mensaje={error} />
        <Boton type="submit" className="w-full" cargando={enviando}>
          Pedir PIN
        </Boton>
        <p className="text-center text-sm">
          <Link to="/restablecer" className="text-texto-suave hover:text-texto hover:underline">
            Ya tengo un PIN
          </Link>
        </p>
      </form>
    </MarcoAuth>
  )
}
