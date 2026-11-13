import type * as T from './tipos'

export type { Usuario } from './tipos'

/** Errores de la api: {"detail": "mensaje", "errores": {"campo": "mensaje"}}. */
export class ErrorApi extends Error {
  estado: number
  errores: Record<string, string>
  /** Caso concreto que la web puede tratar aparte (p. ej. "DISPONIBLE_NEGATIVO"). */
  codigo?: string
  /** Datos del caso; los montos llegan como texto decimal. */
  datos?: Record<string, string>
  constructor(
    estado: number,
    mensaje: string,
    errores: Record<string, string> = {},
    codigo?: string,
    datos?: Record<string, string>,
  ) {
    super(mensaje)
    this.estado = estado
    this.errores = errores
    this.codigo = codigo
    this.datos = datos
  }
}

/** Se emite en `window` cuando la api responde 401 fuera del login: la sesión venció. */
export const EVENTO_SESION_VENCIDA = 'hicotea:sesion-vencida'

type Consulta = Record<string, string | number | boolean | null | undefined>

function conConsulta(ruta: string, consulta?: Consulta): string {
  if (!consulta) return ruta
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(consulta)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `${ruta}?${s}` : ruta
}

async function pedir<R>(ruta: string, opciones: RequestInit = {}): Promise<R> {
  let r: Response
  try {
    r = await fetch(`/api${ruta}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    })
  } catch {
    throw new ErrorApi(0, 'Sin conexión. Revisa tu internet e intenta de nuevo.')
  }
  if (r.status === 204) return undefined as R
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) {
    if (r.status === 401 && !ruta.startsWith('/auth/')) {
      window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA))
    }
    throw new ErrorApi(r.status, cuerpo?.detail ?? `Error ${r.status}`, cuerpo?.errores ?? {}, cuerpo?.codigo, cuerpo?.datos)
  }
  return cuerpo as R
}

const get = <R>(ruta: string, consulta?: Consulta) => pedir<R>(conConsulta(ruta, consulta))
const enviar =
  (metodo: string) =>
  <R>(ruta: string, cuerpo?: unknown) =>
    pedir<R>(ruta, { method: metodo, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) })
const post = enviar('POST')
const put = enviar('PUT')
const patch = enviar('PATCH')
const del = enviar('DELETE')

// ------------------------------------------------------------------ formularios

export type MovimientoForm = {
  tipo: T.TipoIngresoGasto
  fecha: string
  monto: string
  id_categoria: number | null
  id_fuente: number | null
  id_cajita_origen?: number | null
  descripcion?: string | null
}

export type ProducidoForm = {
  id_fuente: number
  fecha: string
  monto: string
  id_categoria_ingreso: number | null
  costo?: string | null
  id_categoria_costo?: number | null
}

export type CajitaForm = {
  nombre: string
  descripcion?: string | null
  proposito: T.PropositoCajita
  porcentaje: string
  es_resto: boolean
  saldo_inicial?: string | null
  /** Solo al crear: meta opcional que se crea en la misma transacción (Caparazón). */
  meta?: { nombre?: string | null; monto_objetivo?: string | null; fecha_objetivo?: string | null } | null
}

export type MetaForm = {
  nombre: string
  monto_objetivo: string
  fecha_objetivo: string | null
  id_cajita: number | null
}

export type RecurrenteForm = {
  nombre: string
  tipo: T.TipoIngresoGasto
  monto: string
  id_categoria: number | null
  id_fuente: number | null
  id_cajita_origen: number | null
  periodicidad: T.Periodicidad
  proxima_fecha: string
  dias_aviso: number
}

export type AtajoForm = {
  nombre: string
  tipo: T.TipoIngresoGasto
  monto: string
  id_categoria: number | null
  id_fuente: number | null
}

// ------------------------------------------------------------------ endpoints

export const auth = {
  registro: (datos: {
    nombre_usuario: string
    nombre_completo: string
    contrasena: string
    confirmacion_contrasena: string
    codigo_invitacion: string
  }) => post<T.Usuario>('/auth/registro', datos),
  login: (datos: { nombre_usuario: string; contrasena: string }) => post<T.Usuario>('/auth/login', datos),
  logout: () => post<void>('/auth/logout'),
  yo: () => get<T.Usuario>('/auth/yo'),
  recuperar: (nombre_usuario: string) => post<T.Mensaje>('/auth/recuperar', { nombre_usuario }),
  restablecer: (datos: {
    nombre_usuario: string
    pin: string
    contrasena: string
    confirmacion_contrasena: string
  }) => post<T.Mensaje>('/auth/restablecer', datos),
}

export const tablero = {
  ver: () => get<T.Tablero>('/tablero'),
  saldo: () => get<T.Saldo>('/saldo'),
  calendario: (mes?: string) => get<T.MesCalendario>('/calendario', { mes }),
}

/** C-04: días confirmados sin actividad (no son movimientos ni cambian saldos). */
export const diasSinActividad = {
  marcar: (fecha: string) => put<{ fecha: string; confirmado: boolean }>(`/dias-sin-actividad/${fecha}`),
  quitar: (fecha: string) => del<{ fecha: string; confirmado: boolean }>(`/dias-sin-actividad/${fecha}`),
}

export const movimientos = {
  listar: (f: T.FiltroMovimientos = {}) => get<T.PaginaMovimientos>('/movimientos', f),
  obtener: (id: number) => get<T.Movimiento>(`/movimientos/${id}`),
  crear: (f: MovimientoForm) => post<T.RespuestaConSaldo>('/movimientos', f),
  producido: (f: ProducidoForm) => post<T.RespuestaConSaldo>('/movimientos/producido', f),
  /** `confirmarNegativo`: acepta una corrección que deja el disponible negativo (D-F2, ver lib/correcciones.ts). */
  actualizar: (id: number, f: MovimientoForm, confirmarNegativo = false) =>
    put<T.Movimiento>(`/movimientos/${id}${confirmarNegativo ? '?confirmar_negativo=true' : ''}`, f),
  eliminar: (id: number, confirmarNegativo = false) =>
    del<T.RespuestaConSaldo>(`/movimientos/${id}${confirmarNegativo ? '?confirmar_negativo=true' : ''}`),
}

export const categorias = {
  listar: () => get<T.Categoria[]>('/categorias'),
  crear: (f: { nombre: string; tipo: T.TipoCategoria }) => post<T.Categoria>('/categorias', f),
  cambiar: (id: number, c: { nombre?: string; activa?: boolean }) => patch<T.Categoria>(`/categorias/${id}`, c),
}

export const fuentes = {
  listar: () => get<T.Fuente[]>('/fuentes'),
  resumen: (desde?: string, hasta?: string) => get<T.ResumenFuente[]>('/fuentes/resumen', { desde, hasta }),
  crear: (f: { nombre: string; frecuencia: T.Frecuencia }) => post<T.Fuente>('/fuentes', f),
  actualizar: (id: number, f: { nombre: string; frecuencia: T.Frecuencia }) => put<T.Fuente>(`/fuentes/${id}`, f),
  estado: (id: number, activa: boolean) => patch<T.Fuente>(`/fuentes/${id}/estado`, { activa }),
}

export const cajitas = {
  listar: () => get<T.Cajita[]>('/cajitas'),
  /** Historial del Caparazón: operaciones de todas las cajitas, incluidas las archivadas. */
  historial: () => get<T.Movimiento[]>('/cajitas/historial'),
  obtener: (id: number) => get<T.Cajita>(`/cajitas/${id}`),
  movimientos: (id: number) => get<T.Movimiento[]>(`/cajitas/${id}/movimientos`),
  crear: (f: CajitaForm) => post<T.Cajita>('/cajitas', f),
  actualizar: (id: number, f: CajitaForm) => put<T.Cajita>(`/cajitas/${id}`, f),
  estado: (id: number, activa: boolean) => patch<T.Cajita>(`/cajitas/${id}/estado`, { activa }),
  operacion: (id: number, f: { operacion: T.OperacionCajita; fecha: string; monto: string; descripcion?: string | null }) =>
    post<T.RespuestaConSaldo>(`/cajitas/${id}/operaciones`, f),
  proponerReparto: (monto?: string) => get<T.PropuestaReparto>('/cajitas/reparto', { monto }),
  confirmarReparto: (lineas: { id_cajita: number; monto: string }[]) =>
    post<{ mensaje: string; total: T.Monto }>('/cajitas/reparto', { lineas }),
}

export const metas = {
  listar: () => get<T.Meta[]>('/metas'),
  obtener: (id: number) => get<T.Meta>(`/metas/${id}`),
  crear: (f: MetaForm) => post<T.Meta>('/metas', f),
  actualizar: (id: number, f: MetaForm) => put<T.Meta>(`/metas/${id}`, f),
  estado: (id: number, activa: boolean) => patch<T.Meta>(`/metas/${id}/estado`, { activa }),
  /** Celebrar y guardar el logro de una meta cumplida: la archiva sin mover dinero. */
  logro: (id: number) => post<T.Meta>(`/metas/${id}/logro`),
  eliminar: (id: number) => del<void>(`/metas/${id}`),
}

export const presupuestos = {
  listar: (mes?: string) => get<T.PresupuestosDelMes>('/presupuestos', { mes }),
  guardar: (id_categoria: number, monto: string) => put<T.PresupuestosDelMes>('/presupuestos', { id_categoria, monto }),
  eliminar: (id: number) => del<void>(`/presupuestos/${id}`),
}

export const recurrentes = {
  listar: () => get<T.Recurrente[]>('/recurrentes'),
  pendientes: () => get<T.Recurrente[]>('/recurrentes/pendientes'),
  obtener: (id: number) => get<T.Recurrente>(`/recurrentes/${id}`),
  crear: (f: RecurrenteForm) => post<T.Recurrente>('/recurrentes', f),
  actualizar: (id: number, f: RecurrenteForm) => put<T.Recurrente>(`/recurrentes/${id}`, f),
  estado: (id: number, activa: boolean) => patch<T.Recurrente>(`/recurrentes/${id}/estado`, { activa }),
  eliminar: (id: number) => del<void>(`/recurrentes/${id}`),
  confirmar: (id: number, f: { fecha: string; monto: string }) =>
    post<T.RespuestaConSaldo>(`/recurrentes/${id}/confirmar`, f),
  omitir: (id: number) => post<T.Recurrente>(`/recurrentes/${id}/omitir`),
}

export const atajos = {
  listar: () => get<T.Atajo[]>('/atajos'),
  crear: (f: AtajoForm) => post<T.Atajo>('/atajos', f),
  eliminar: (id: number) => del<void>(`/atajos/${id}`),
  /** `fecha` = fecha efectiva para registrar en un día pasado (C-03); sin ella, hoy. */
  usar: (id: number, fecha?: string) => post<T.RespuestaConSaldo>(`/atajos/${id}/usar`, fecha ? { fecha } : undefined),
}

export const compartir = {
  concedidos: () => get<T.Acceso[]>('/compartir'),
  recibidos: () => get<T.Acceso[]>('/compartir/recibidos'),
  conceder: (nombre_usuario: string) => post<T.Acceso[]>('/compartir', { nombre_usuario }),
  revocar: (id: number) => del<void>(`/compartir/${id}`),
  tablero: (titular: number) => get<T.Tablero>(`/compartido/${titular}/tablero`),
  movimientos: (titular: number, f: T.FiltroMovimientos = {}) =>
    get<T.PaginaMovimientos>(`/compartido/${titular}/movimientos`, f),
  calendario: (titular: number, mes?: string) => get<T.MesCalendario>(`/compartido/${titular}/calendario`, { mes }),
}
