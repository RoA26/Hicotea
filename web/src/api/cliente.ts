export type Usuario = {
  id: number
  nombre_usuario: string
  nombre_completo: string
  fecha_registro: string
}

export class ErrorApi extends Error {
  estado: number
  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${ruta}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  })
  if (r.status === 204) return undefined as T
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) {
    const detalle = cuerpo?.detail
    const mensaje = Array.isArray(detalle)
      ? detalle.map((d: { msg: string }) => d.msg).join('; ')
      : (detalle ?? `Error ${r.status}`)
    throw new ErrorApi(r.status, mensaje)
  }
  return cuerpo as T
}

export const auth = {
  registro: (datos: { nombre_usuario: string; nombre_completo: string; contrasena: string }) =>
    pedir<Usuario>('/auth/registro', { method: 'POST', body: JSON.stringify(datos) }),
  login: (datos: { nombre_usuario: string; contrasena: string }) =>
    pedir<Usuario>('/auth/login', { method: 'POST', body: JSON.stringify(datos) }),
  logout: () => pedir<void>('/auth/logout', { method: 'POST' }),
  yo: () => pedir<Usuario>('/auth/yo'),
}
