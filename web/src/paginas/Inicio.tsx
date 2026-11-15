import { useEffect, useState } from 'react'
import { RecordatorioAyer } from '../componentes/RecordatorioAyer'
import { atajos as apiAtajos, recurrentes, tablero } from '../api/cliente'
import type { Atajo, Recurrente } from '../api/tipos'
import { ConfirmarRecurrente } from '../componentes/ConfirmarRecurrente'
import { FormProducido } from '../componentes/FormProducido'
import { useAvisar, useSaldo, useSesion } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import { VistaTablero } from '../componentes/VistaTablero'
import { Boton, BotonEnlace, Cargando, cx, Encabezado, ErrorCarga, Insignia, Seccion, Tarjeta } from '../componentes/ui'
import { esRecurrenteAvanzado } from '../lib/correcciones'
import { useCatalogos } from '../lib/catalogos'
import { useDatos } from '../lib/datos'
import { dinero, fechaCorta, fechaDia } from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'

function BotonesRapidos({ atajos, alProducido }: { atajos: Atajo[]; alProducido: () => void }) {
  const registrado = useRegistroRapido()
  const avisar = useAvisar()
  const [usando, setUsando] = useState<number | null>(null)

  async function usar(a: Atajo) {
    setUsando(a.id)
    try {
      registrado(await apiAtajos.usar(a.id))
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    } finally {
      setUsando(null)
    }
  }

  return (
    <Seccion titulo="Registrar">
      <div className="grid grid-cols-3 gap-2">
        <Boton onClick={alProducido}>Producido</Boton>
        <BotonEnlace to="/movimientos/nuevo?tipo=INGRESO" variante="secundario">
          + Ingreso
        </BotonEnlace>
        <BotonEnlace to="/movimientos/nuevo?tipo=GASTO" variante="secundario">
          − Gasto
        </BotonEnlace>
      </div>
      {atajos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {atajos.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={usando !== null}
              onClick={() => usar(a)}
              className={cx(
                'cifra min-h-11 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-50',
                a.tipo === 'INGRESO' ? 'border-ingreso/30 hover:bg-ingreso/10' : 'border-gasto/30 hover:bg-gasto/10',
              )}
            >
              <Icono nombre="atajos" className="mr-1 inline size-3.5" />
              {a.nombre} · {a.tipo === 'INGRESO' ? '+ ' : '− '}
              {dinero(a.monto)}
            </button>
          ))}
        </div>
      )}
    </Seccion>
  )
}

function Pendientes({ lista, alConfirmar, alOmitir }: { lista: Recurrente[]; alConfirmar: (r: Recurrente) => void; alOmitir: (r: Recurrente) => void }) {
  if (!lista.length) return null
  return (
    <Seccion titulo="Pendientes por confirmar">
      <div className="space-y-2">
        {lista.map((r) => (
          <Tarjeta key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {r.nombre} {r.vencido && <Insignia tono="gasto">Vencido</Insignia>}
              </p>
              <p className="cifra text-xs text-texto-suave">
                {r.tipo === 'INGRESO' ? '+' : '−'} {dinero(r.monto)} · {fechaCorta(r.proxima_fecha)}
              </p>
            </div>
            <div className="flex gap-2">
              <Boton chico variante="fantasma" onClick={() => alOmitir(r)}>
                Omitir
              </Boton>
              <Boton chico onClick={() => alConfirmar(r)}>
                Confirmar
              </Boton>
            </div>
          </Tarjeta>
        ))}
      </div>
    </Seccion>
  )
}

export default function Inicio() {
  const { usuario } = useSesion()
  const { version } = useSaldo()
  const avisar = useAvisar()
  const t = useDatos(tablero.ver, [version])
  const atajos = useDatos(apiAtajos.listar)
  const cat = useCatalogos()
  const [producido, setProducido] = useState(false)
  const [confirmando, setConfirmando] = useState<Recurrente | null>(null)

  // Los catálogos (fuentes nuevas, cajitas) pueden cambiar entre visitas.
  useEffect(() => {
    if (producido) void cat.recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producido])

  async function omitir(r: Recurrente) {
    try {
      const n = await recurrentes.omitir(r.id, r.proxima_fecha)
      avisar(`${r.nombre} omitido. Próxima fecha: ${fechaCorta(n.proxima_fecha)}.`)
      void t.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
      if (esRecurrenteAvanzado(e)) void t.recargar()
    }
  }

  const nombre = usuario?.nombre_completo.split(' ')[0]
  return (
    <>
      <Encabezado titulo={`Hola, ${nombre}`} subtitulo={t.datos ? fechaDia(t.datos.hoy) : undefined} />
      {t.error && !t.datos ? (
        <ErrorCarga error={t.error} reintentar={t.recargar} />
      ) : !t.datos ? (
        <Cargando />
      ) : (
        <VistaTablero
          t={t.datos}
          extra={
            <>
              {t.datos.ayer_sin_registros && <RecordatorioAyer hoy={t.datos.hoy} />}
              <BotonesRapidos atajos={atajos.datos ?? []} alProducido={() => setProducido(true)} />
              <Pendientes lista={t.datos.pendientes} alConfirmar={setConfirmando} alOmitir={omitir} />
            </>
          }
        />
      )}

      <Modal abierto={producido} onCerrar={() => setProducido(false)} titulo="Producido del día">
        {cat.datos ? <FormProducido catalogos={cat.datos} alTerminar={() => setProducido(false)} /> : <Cargando />}
      </Modal>
      <ConfirmarRecurrente recurrente={confirmando} onCerrar={() => setConfirmando(null)} alTerminar={() => setConfirmando(null)} recargar={() => void t.recargar()} />
    </>
  )
}
