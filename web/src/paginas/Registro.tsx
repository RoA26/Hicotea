import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { auth } from '../api/cliente'
import { useSesion } from '../componentes/Globales'
import { MarcoAuth } from '../componentes/MarcoAuth'
import { AlertaError, AlertaExito, Boton, Campo, Entrada } from '../componentes/ui'
import { useEnvio } from '../lib/datos'

const VACIO = { nombre_usuario: '', nombre_completo: '', correo: '', contrasena: '', confirmacion_contrasena: '', codigo_invitacion: '' }

/** Estado del enlace de invitación (?invitacion=...): se comprueba antes de pedir datos. */
type EstadoEnlace = { tipo: 'sin-enlace' } | { tipo: 'comprobando' } | { tipo: 'valido'; correo: string | null } | { tipo: 'invalido' }

export default function Registro() {
  const navegar = useNavigate()
  const [q] = useSearchParams()
  const token = q.get('invitacion')?.trim() ?? ''
  const { setUsuario } = useSesion()
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState({ ...VACIO, codigo_invitacion: token })
  const [enlace, setEnlace] = useState<EstadoEnlace>(token ? { tipo: 'comprobando' } : { tipo: 'sin-enlace' })
  const campo = (k: keyof typeof VACIO) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
    'aria-invalid': !!errores[k] || undefined,
  })

  useEffect(() => {
    if (!token) return
    let vigente = true
    auth.invitacion(token).then(
      (r) => {
        if (!vigente) return
        setEnlace(r.valida ? { tipo: 'valido', correo: r.correo } : { tipo: 'invalido' })
        if (r.correo) setF((x) => ({ ...x, correo: r.correo ?? '' }))
      },
      () => vigente && setEnlace({ tipo: 'invalido' }),
    )
    return () => {
      vigente = false
    }
  }, [token])

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const u = await enviar(() => auth.registro({ ...f, correo: f.correo.trim() || null }))
    if (u) {
      setUsuario(u)
      navegar('/inicio', { replace: true })
    }
  }

  const conEnlace = enlace.tipo === 'valido'
  const correoFijo = conEnlace && !!enlace.correo
  return (
    <MarcoAuth
      titulo="Crear cuenta"
      subtitulo={conEnlace ? 'Te invitaron a Hicotea. Elige tu usuario y contraseña.' : 'Hicotea es solo por invitación. Usa el enlace o el código que te compartieron.'}
      pie={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-acento hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      {enlace.tipo === 'comprobando' ? (
        <p className="text-sm text-texto-suave" role="status" aria-busy="true">
          Comprobando la invitación…
        </p>
      ) : (
        <form onSubmit={alEnviar} className="space-y-4" noValidate={false}>
          {conEnlace && <AlertaExito mensaje="Invitación válida." />}
          {enlace.tipo === 'invalido' && (
            <AlertaError mensaje="Este enlace de invitación no es válido, ya se usó, se revocó o venció. Pide uno nuevo a quien te invitó." />
          )}
          <Campo etiqueta="Usuario" error={errores.nombre_usuario} ayuda="Letras, números, punto, guion o guion bajo.">
            <Entrada {...campo('nombre_usuario')} autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={30} required />
          </Campo>
          <Campo etiqueta="Nombre completo" error={errores.nombre_completo}>
            <Entrada {...campo('nombre_completo')} autoComplete="name" maxLength={100} required />
          </Campo>
          <Campo
            etiqueta={correoFijo ? 'Correo' : 'Correo (opcional)'}
            error={errores.correo}
            ayuda={correoFijo ? 'La invitación es para este correo.' : 'Solo para recibir el PIN si olvidas tu contraseña.'}
          >
            <Entrada {...campo('correo')} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} readOnly={correoFijo} />
          </Campo>
          <Campo etiqueta="Contraseña" error={errores.contrasena} ayuda="Mínimo 8 caracteres. Una frase corta es fácil de recordar y difícil de adivinar.">
            <Entrada {...campo('contrasena')} type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
          </Campo>
          <Campo etiqueta="Repite la contraseña" error={errores.confirmacion_contrasena}>
            <Entrada {...campo('confirmacion_contrasena')} type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
          </Campo>
          {!conEnlace && (
            <Campo etiqueta="Código de invitación" error={errores.codigo_invitacion}>
              <Entrada {...campo('codigo_invitacion')} autoComplete="off" autoCapitalize="none" spellCheck={false} required />
            </Campo>
          )}
          {conEnlace && errores.codigo_invitacion && <AlertaError mensaje={errores.codigo_invitacion} />}
          <AlertaError mensaje={error} />
          <Boton type="submit" className="w-full" cargando={enviando}>
            Crear mi cuenta
          </Boton>
        </form>
      )}
    </MarcoAuth>
  )
}
