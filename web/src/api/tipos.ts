// Tipos de las respuestas de la api (espejo de api/app/esquemas/salidas.py).
// Los montos llegan como string con dos decimales ("85000.00").

export type Monto = string

export type TipoCategoria = 'INGRESO' | 'GASTO' | 'COSTO_OPERATIVO'
export type TipoMovimiento = 'INGRESO' | 'GASTO' | 'APORTE' | 'RETIRO' | 'RENDIMIENTO' | 'SALDO_INICIAL'
export type TipoIngresoGasto = 'INGRESO' | 'GASTO'
export type OperacionCajita = 'APORTE' | 'RETIRO' | 'RENDIMIENTO' | 'SALDO_INICIAL'
export type Frecuencia = 'DIARIA' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL'
export type PropositoCajita = 'CAPITAL' | 'COMPRAS' | 'EMERGENCIA' | 'LIBRE'
export type Periodicidad = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'ANUAL'

export type Rol = 'USUARIO' | 'ADMIN'

export type Usuario = {
  id: number
  nombre_usuario: string
  nombre_completo: string
  correo: string | null
  /** El correo recibe el PIN de recuperación solo si está verificado. */
  correo_verificado: boolean
  rol: Rol
  fecha_registro: string
}

/** Perfil propio (/api/cuenta). */
export type Perfil = Usuario & {
  /** Dirección esperando verificación (nueva, o la actual sin verificar). No es la que está en uso. */
  correo_pendiente: string | null
  correo_pendiente_expira_en: string | null
  /** False si el servidor no puede enviar correos: no se puede verificar nada. */
  correo_disponible: boolean
  sesiones_activas: number
}

export type Mensaje = { mensaje: string }

export type Categoria = { id: number; nombre: string; tipo: TipoCategoria; activa: boolean }

export type Fuente = {
  id: number
  nombre: string
  frecuencia: Frecuencia
  activa: boolean
  fecha_creacion: string
}

export type Movimiento = {
  id: number
  tipo: TipoMovimiento
  fecha: string
  monto: Monto
  id_categoria: number | null
  id_fuente: number | null
  id_cajita: number | null
  id_relacionado: number | null
  descripcion: string | null
  nombre_categoria: string | null
  tipo_categoria: TipoCategoria | null
  nombre_fuente: string | null
  nombre_cajita: string | null
  id_cajita_origen: number | null
  nombre_cajita_origen: string | null
  entrada: boolean
  editable: boolean
  eliminable: boolean
}

export type PaginaMovimientos = {
  movimientos: Movimiento[]
  pagina: number
  tamano: number
  total_registros: number
  total_ingresos: Monto
  total_gastos: Monto
  balance: Monto
  hay_anterior: boolean
  hay_siguiente: boolean
  desde: string | null
  hasta: string | null
}

export type ResumenPeriodo = {
  ingresos: Monto
  gastos_personales: Monto
  costos_operativos: Monto
  gastos_totales: Monto
  balance: Monto
}

export type ResumenFuente = {
  id_fuente: number
  nombre: string
  /** Una fuente inactiva aparece si tuvo movimientos en el periodo (D-F4). */
  activa: boolean
  bruto: Monto
  costos: Monto
  dias_trabajados: number
  utilidad: Monto
  promedio_diario: Monto
  margen: number | null
}

/** D-F1: dinero en una cajita desactivada (inconsistencia histórica): se cuenta en el total y se avisa. */
export type CajitaInactivaConSaldo = { id: number; nombre: string; saldo: Monto }

export type Saldo = {
  disponible: Monto
  /** Incluye cajitas inactivas con saldo (D-F1). */
  en_cajitas: Monto
  total: Monto
  mes: ResumenPeriodo
  cajitas_inactivas_con_saldo: CajitaInactivaConSaldo[]
}

export type RespuestaConSaldo = {
  mensaje: string
  id_movimiento: number | null
  tipo: TipoMovimiento | null
  saldo: Saldo
}

export type Cajita = {
  id: number
  nombre: string
  descripcion: string | null
  proposito: PropositoCajita
  porcentaje: Monto
  es_resto: boolean
  activa: boolean
  saldo: Monto
}

export type LineaReparto = { id_cajita: number; nombre: string; monto: Monto }

export type PropuestaReparto = {
  disponible: Monto
  monto_a_repartir: Monto
  lineas: LineaReparto[]
  sobrante: Monto
  suma_porcentajes: Monto
  hay_resto: boolean
  porcentajes_incompletos: boolean
}

export type Meta = {
  id: number
  nombre: string
  monto_objetivo: Monto
  fecha_objetivo: string | null
  id_cajita: number
  nombre_cajita: string
  saldo_cajita: Monto
  activa: boolean
  porcentaje: number
  faltante: Monto
  meses_restantes: number | null
  aporte_mensual: Monto | null
  cumplida: boolean
  vencida: boolean
  cajita_activa: boolean
  /** Fecha en que el usuario reconoció el logro. */
  cumplida_en: string | null
  /** Primera fecha en que el saldo de la cajita llegó al objetivo (según el historial). */
  alcanzada_en: string | null
  monto_logrado: Monto | null
}

export type Presupuesto = {
  id: number
  id_categoria: number
  categoria: string
  tipo_categoria: TipoCategoria
  presupuestado: Monto
  gastado: Monto
  porcentaje: number
  porcentaje_barra: number
  restante: Monto
  excedido: boolean
  en_alerta: boolean
}

export type PresupuestosDelMes = {
  mes: string
  presupuestos: Presupuesto[]
  total_presupuestado: Monto
  total_gastado: Monto
}

export type Recurrente = {
  id: number
  nombre: string
  tipo: TipoMovimiento
  monto: Monto
  id_categoria: number
  id_fuente: number | null
  id_cajita_origen: number | null
  periodicidad: Periodicidad
  dia_ancla: number
  proxima_fecha: string
  dias_aviso: number
  activo: boolean
  nombre_categoria: string
  nombre_fuente: string | null
  nombre_cajita_origen: string | null
  pendiente: boolean
  vencido: boolean
}

export type Atajo = {
  id: number
  nombre: string
  tipo: TipoMovimiento
  monto: Monto
  id_categoria: number
  id_fuente: number | null
  nombre_categoria: string
}

export type Acceso = {
  id: number
  id_titular: number
  nombre_completo_titular: string
  id_invitado: number
  nombre_usuario_invitado: string
  nombre_completo_invitado: string
  fecha_concesion: string
}

export type Tablero = {
  hoy: string
  mes: string
  disponible: Monto
  /** Incluye cajitas inactivas con saldo (D-F1). */
  total_cajitas: Monto
  saldo_total: Monto
  cajitas_inactivas_con_saldo: CajitaInactivaConSaldo[]
  /** C-05: ayer, dentro del historial, sin registros y sin confirmar. */
  ayer_sin_registros: boolean
  mes_actual: ResumenPeriodo
  mes_anterior: ResumenPeriodo
  cajitas: Cajita[]
  fuentes: ResumenFuente[]
  ultimos_movimientos: Movimiento[]
  sin_movimientos: boolean
  graficas: {
    por_mes: { mes: string; ingresos: Monto; gastos: Monto }[]
    gastos_por_categoria: { id_categoria: number; categoria: string; tipo: TipoCategoria; total: Monto }[]
    producido_por_dia: { dia: number; total: Monto }[]
  }
  pendientes: Recurrente[]
  alertas_presupuesto: Presupuesto[]
  metas: Meta[]
}

export type CompromisoPrevisto = { id: number; nombre: string; tipo: TipoIngresoGasto; monto: Monto }

/** Calendario vivo (C-01): los estados pueden coexistir. */
export type DiaCalendario = {
  fecha: string
  del_mes: boolean
  hoy: boolean
  futuro: boolean
  ingresos: Monto
  gastos: Monto
  /** Operaciones de ahorro: flujos internos disponible ↔ cajitas, no ingresos ni gastos. */
  aportes: Monto
  retiros: Monto
  rendimientos: Monto
  operaciones_ahorro: number
  registros: number
  /** Pasado, desde el comienzo del historial, sin ningún registro. No es un error. */
  sin_registros: boolean
  /** Confirmado por el usuario como día sin actividad (C-04). Un movimiento real tiene prioridad. */
  sin_actividad: boolean
  compromisos: CompromisoPrevisto[]
  con_producido: boolean
  sin_producido: boolean
}

export type MesCalendario = {
  mes: string
  mes_anterior: string
  mes_siguiente: string
  semanas: DiaCalendario[][]
  total_ingresos: Monto
  total_gastos: Monto
  dias_con_producido: number
  dias_sin_producido: number
  hoy: string
  inicio_historial: string | null
}

export type FiltroMovimientos = {
  desde?: string
  hasta?: string
  tipo?: TipoMovimiento
  id_categoria?: number
  id_fuente?: number
  pagina?: number
}

// ------------------------------------------------------------------ administración (espejo de esquemas/admin.py)
// Ninguno de estos tipos lleva datos financieros.

export type Pagina<T> = { elementos: T[]; pagina: number; total: number; hay_anterior: boolean; hay_siguiente: boolean }

export type EstadoInvitacion = 'PENDIENTE' | 'USADA' | 'EXPIRADA' | 'REVOCADA'

export type CuentaAdmin = {
  id: number
  nombre_usuario: string
  nombre_completo: string
  correo: string | null
  correo_verificado: boolean
  rol: Rol
  activo: boolean
  bloqueado_en: string | null
  fecha_registro: string
  ultimo_ingreso_en: string | null
  sesiones_activas: number
}

export type InvitacionAdmin = {
  id: number
  correo: string | null
  nota: string | null
  estado: EstadoInvitacion
  creada_en: string
  expira_en: string
  usada_en: string | null
  revocada_en: string | null
  creada_por: string | null
  usada_por: string | null
  revocada_por: string | null
}

/** Solo en la respuesta de creación: el enlace no se puede volver a consultar. */
export type InvitacionCreada = InvitacionAdmin & { enlace: string }

export type EventoAuditoria = {
  id: number
  fecha: string
  admin_nombre: string
  accion: string
  recurso_tipo: string
  recurso_id: number | null
  recurso_nombre: string | null
  resultado: 'EXITO' | 'RECHAZADO'
  detalle: string | null
}

export type ResumenAdmin = {
  cuentas: { total: number; activas: number; bloqueadas: number; administradores: number }
  invitaciones: Record<EstadoInvitacion, number>
  actividad_reciente: EventoAuditoria[]
}
