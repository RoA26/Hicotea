import { ErrorApi } from '../api/cliente'

type Confirmar = (o: { titulo: string; mensaje?: string; aceptar?: string; peligro?: boolean }) => Promise<boolean>

/** Código que la API devuelve (409) cuando una corrección histórica dejaría el disponible negativo (D-F2). */
export const DISPONIBLE_NEGATIVO = 'DISPONIBLE_NEGATIVO'

/**
 * D-F2: ejecuta una corrección histórica (eliminar o rebajar un ingreso,
 * eliminar un retiro). Si la API avisa que el disponible quedaría negativo,
 * explica por qué y pide confirmación explícita antes de repetirla con
 * `confirmarNegativo = true`. Devuelve `null` si el usuario cancela.
 * Nunca crea movimientos compensatorios: eso lo decide el usuario.
 */
export async function conConfirmacionNegativo<R>(
  confirmar: Confirmar,
  hacer: (confirmarNegativo: boolean) => Promise<R>,
): Promise<R | null> {
  try {
    return await hacer(false)
  } catch (e) {
    if (!(e instanceof ErrorApi) || e.codigo !== DISPONIBLE_NEGATIVO) throw e
    const ok = await confirmar({
      titulo: 'Tu disponible quedará negativo',
      mensaje: e.message,
      aceptar: 'Hacer la corrección',
      peligro: true,
    })
    return ok ? hacer(true) : null
  }
}
