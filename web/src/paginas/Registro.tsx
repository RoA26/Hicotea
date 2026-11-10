import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { auth } from '../api/cliente'
import { useSesion } from '../componentes/Globales'
import { MarcoAuth } from '../componentes/MarcoAuth'
import { AlertaError, Boton, Campo, Entrada } from '../componentes/ui'
import { useEnvio } from '../lib/datos'

const VACIO = { nombre_usuario: '', nombre_completo: '', contrasena: '', confirmacion_contrasena: '', codigo_invitacion: '' }

export default function Registro() {
  const navegar = useNavigate()
  const { setUsuario } = useSesion()
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState(VACIO)
  const campo = (k: keyof typeof VACIO) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
    'aria-invalid': !!errores[k] || undefined,
  })

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const u = await enviar(() => auth.registro(f))
    if (u) {
      setUsuario(u)
      navegar('/inicio', { replace: true })
    }
  }

  return (
    <MarcoAuth
      titulo="Crear cuenta"
      subtitulo="Necesitas el código de invitación que te compartieron."
      pie={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-acento hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={alEnviar} className="space-y-4">
        <Campo etiqueta="Usuario" error={errores.nombre_usuario} ayuda="Letras, números, punto, guion o guion bajo.">
          <Entrada {...campo('nombre_usuario')} autoComplete="username" autoCapitalize="none" minLength={3} maxLength={30} required />
        </Campo>
        <Campo etiqueta="Nombre completo" error={errores.nombre_completo}>
          <Entrada {...campo('nombre_completo')} autoComplete="name" maxLength={100} required />
        </Campo>
        <Campo etiqueta="Contraseña" error={errores.contrasena} ayuda="Mínimo 8 caracteres.">
          <Entrada {...campo('contrasena')} type="password" autoComplete="new-password" minLength={8} required />
        </Campo>
        <Campo etiqueta="Repite la contraseña" error={errores.confirmacion_contrasena}>
          <Entrada {...campo('confirmacion_contrasena')} type="password" autoComplete="new-password" minLength={8} required />
        </Campo>
        <Campo etiqueta="Código de invitación" error={errores.codigo_invitacion}>
          <Entrada {...campo('codigo_invitacion')} autoComplete="off" autoCapitalize="none" required />
        </Campo>
        <AlertaError mensaje={error} />
        <Boton type="submit" className="w-full" cargando={enviando}>
          Registrarme
        </Boton>
      </form>
    </MarcoAuth>
  )
}
