export type Usuario = {
  id: number
  nombre_usuario: string
  nombre_completo: string
  fecha_registro: string
}

/** Errores de la api: {"detail": "mensaje", "errores": {"campo": "mensaje"}}. */
export class ErrorApi extends Error {
  estado: number
  errores: Record<string, string>
  constructor(estado: number, mensaje: string, errores: Record<string, string> = {}) {
    super(mensaje)
    this.estado = estado
    this.errores = errores
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
    throw new ErrorApi(r.status, cuerpo?.detail ?? `Error ${r.status}`, cuerpo?.errores ?? {})
  }
  return cuerpo as T
}

export const auth = {
  registro: (datos: {
    nombre_usuario: string
    nombre_completo: string
    contrasena: string
    confirmacion_contrasena: string
    codigo_invitacion: string
  }) =>
    pedir<Usuario>('/auth/registro', { method: 'POST', body: JSON.stringify(datos) }),
  login: (datos: { nombre_usuario: string; contrasena: string }) =>
    pedir<Usuario>('/auth/login', { method: 'POST', body: JSON.stringify(datos) }),
  logout: () => pedir<void>('/auth/logout', { method: 'POST' }),
  yo: () => pedir<Usuario>('/auth/yo'),
}
