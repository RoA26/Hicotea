import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { auth } from '../api/cliente'

export default function Registro() {
  const navegar = useNavigate()
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setError(null)
    try {
      await auth.registro({
        nombre_usuario: String(f.get('nombre_usuario')),
        nombre_completo: String(f.get('nombre_completo')),
        contrasena: String(f.get('contrasena')),
        confirmacion_contrasena: String(f.get('confirmacion_contrasena')),
        codigo_invitacion: String(f.get('codigo_invitacion')),
      })
      navegar('/inicio')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <main>
      <h1>Crear cuenta</h1>
      <form onSubmit={enviar}>
        <p>
          <label>
            Usuario <input name="nombre_usuario" autoComplete="username" minLength={3} maxLength={30} required />
          </label>
        </p>
        <p>
          <label>
            Nombre completo <input name="nombre_completo" autoComplete="name" maxLength={100} required />
          </label>
        </p>
        <p>
          <label>
            Contraseña <input name="contrasena" type="password" autoComplete="new-password" minLength={8} required />
          </label>
        </p>
        <p>
          <label>
            Repite la contraseña{' '}
            <input name="confirmacion_contrasena" type="password" autoComplete="new-password" minLength={8} required />
          </label>
        </p>
        <p>
          <label>
            Código de invitación <input name="codigo_invitacion" autoComplete="off" required />
          </label>
        </p>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Registrarme</button>
      </form>
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </main>
  )
}
