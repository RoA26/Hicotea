import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { auth, type Usuario } from '../api/cliente'

// Provisional (Fase 1): solo comprueba /api/auth/yo y permite cerrar sesión.
export default function Inicio() {
  const navegar = useNavigate()
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    auth.yo().then(setUsuario).catch(() => navegar('/login', { replace: true }))
  }, [navegar])

  async function salir() {
    await auth.logout()
    navegar('/login')
  }

  if (!usuario) return <p>Cargando…</p>
  return (
    <main>
      <h1>Hola, {usuario.nombre_completo}</h1>
      <p>Sesión iniciada como @{usuario.nombre_usuario}</p>
      <button onClick={salir}>Cerrar sesión</button>
    </main>
  )
}
