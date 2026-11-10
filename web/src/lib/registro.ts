import { useCallback } from 'react'
import { movimientos } from '../api/cliente'
import type { RespuestaConSaldo } from '../api/tipos'
import { useAvisar, useSaldo } from '../componentes/Globales'

/** Tras un registro rápido: actualiza el saldo, avisa y ofrece "Deshacer" (borra el movimiento). */
export function useRegistroRapido() {
  const avisar = useAvisar()
  const { setSaldo, avisarCambio } = useSaldo()

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
                  const d = await movimientos.eliminar(id)
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
    [avisar, setSaldo, avisarCambio],
  )
}
