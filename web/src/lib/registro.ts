import { useCallback } from 'react'
import { movimientos } from '../api/cliente'
import type { RespuestaConSaldo } from '../api/tipos'
import { useAvisar, useConfirmar, useSaldo } from '../componentes/Globales'
import { conConfirmacionNegativo } from './correcciones'

/** Tras un registro rápido: actualiza el saldo, avisa y ofrece "Deshacer" (borra el movimiento). */
export function useRegistroRapido() {
  const avisar = useAvisar()
  const { setSaldo, avisarCambio } = useSaldo()
  const confirmar = useConfirmar()

  return useCallback(
    (r: RespuestaConSaldo) => {
      setSaldo(r.saldo)
      avisarCambio()
      const id = r.id_movimiento
      avisar(r.mensaje, {
        accion: id
          ? {
              etiqueta: 'Deshacer',
              hacer: async () => {
                try {
                  const d = await conConfirmacionNegativo(confirmar, (ok) => movimientos.eliminar(id, ok))
                  if (!d) return
                  setSaldo(d.saldo)
                  avisarCambio()
                  avisar('Listo, se deshizo.')
                } catch (e) {
                  avisar((e as Error).message, { tono: 'error' })
                }
              },
            }
          : undefined,
      })
    },
    [avisar, setSaldo, avisarCambio, confirmar],
  )
}
