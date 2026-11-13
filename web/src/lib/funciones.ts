/**
 * Interruptores de funciones visibles en la web. Ocultar una función aquí no
 * toca la API ni la base de datos: los datos y permisos se conservan y las
 * rutas siguen respondiendo a quien tenga el enlace.
 *
 * Para volver a mostrar Compartir: VITE_COMPARTIR=1 en web/.env (o cambiar el valor por defecto).
 */
export const FUNCIONES = {
  compartir: import.meta.env.VITE_COMPARTIR === '1',
} as const
