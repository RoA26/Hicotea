import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { auth } from '../api/cliente'

export default function Login() {
  const navegar = useNavigate()
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setError(null)
    try {
      await auth.login({
        nombre_usuario: String(f.get('nombre_usuario')),
        contrasena: String(f.get('contrasena')),
      })
      navegar('/inicio')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <main>
      <h1>Iniciar sesión</h1>
      <form onSubmit={enviar}>
        <p>
          <label>
            Usuario <input name="nombre_usuario" autoComplete="username" required />
          </label>
        </p>
        <p>
          <label>
            Contraseña <input name="contrasena" type="password" autoComplete="current-password" required />
          </label>
        </p>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Entrar</button>
      </form>
      <p>
        ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
      </p>
    </main>
  )
}
