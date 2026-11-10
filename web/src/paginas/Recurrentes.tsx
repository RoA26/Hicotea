import { useState } from 'react'
import { recurrentes as api } from '../api/cliente'
import type { Recurrente } from '../api/tipos'
import { ConfirmarRecurrente } from '../componentes/ConfirmarRecurrente'
import { useAvisar, useConfirmar, useSaldo } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Boton, BotonEnlace, Cargando, Encabezado, ErrorCarga, Insignia, Tarjeta, Vacio } from '../componentes/ui'
import { useDatos } from '../lib/datos'
import { dinero, fechaLarga, NOMBRE_PERIODICIDAD } from '../lib/formato'

export default function Recurrentes() {
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const { version } = useSaldo()
  const lista = useDatos(api.listar, [version])
  const [confirmando, setConfirmando] = useState<Recurrente | null>(null)

  async function accion(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      avisar(ok)
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  async function eliminar(r: Recurrente) {
    if (await confirmar({ titulo: 'Eliminar recurrente', mensaje: `"${r.nombre}" dejará de repetirse. Los movimientos ya registrados se conservan.`, aceptar: 'Eliminar', peligro: true }))
      void accion(() => api.eliminar(r.id), 'Recurrente eliminado.')
  }

  return (
    <>
      <Encabezado
        titulo="Recurrentes"
        subtitulo="Pagos e ingresos que se repiten. Te avisamos unos días antes para confirmarlos."
        acciones={
          <BotonEnlace to="/recurrentes/nuevo">
            <Icono nombre="mas" /> Nuevo
          </BotonEnlace>
        }
      />
      {lista.error ? (
        <ErrorCarga error={lista.error} reintentar={lista.recargar} />
      ) : !lista.datos ? (
        <Cargando />
      ) : lista.datos.length === 0 ? (
        <Vacio accion={<BotonEnlace to="/recurrentes/nuevo">Crear uno</BotonEnlace>}>Arriendo, cuota del celular, quincena: regístralos una vez y Hicotea te los recuerda.</Vacio>
      ) : (
        <div className="space-y-2">
          {lista.datos.map((r) => (
            <Tarjeta key={r.id} className={r.activo ? '' : 'opacity-60'}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {r.nombre}
                    {r.vencido && <Insignia tono="gasto">Vencido</Insignia>}
                    {r.pendiente && !r.vencido && <Insignia tono="aviso">Pendiente</Insignia>}
                    {!r.activo && <Insignia>Pausado</Insignia>}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {NOMBRE_PERIODICIDAD[r.periodicidad]} · {r.nombre_categoria}
                    {r.nombre_fuente && ` · ${r.nombre_fuente}`}
                    {r.nombre_cajita_origen && ` · desde ${r.nombre_cajita_origen}`}
                  </p>
                  <p className="text-xs text-texto-suave">Próxima: {fechaLarga(r.proxima_fecha)}</p>
                </div>
                <span className={r.tipo === 'INGRESO' ? 'cifra font-semibold text-ingreso' : 'cifra font-semibold text-gasto'}>
                  {r.tipo === 'INGRESO' ? '+ ' : '− '}
                  {dinero(r.monto)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 border-t border-borde pt-3">
                {r.activo && (
                  <>
                    <Boton chico onClick={() => setConfirmando(r)}>
                      Confirmar
                    </Boton>
                    <Boton chico variante="fantasma" onClick={() => accion(() => api.omitir(r.id), `${r.nombre} omitido esta vez.`)}>
                      Omitir
                    </Boton>
                  </>
                )}
                <BotonEnlace to={`/recurrentes/${r.id}`} chico variante="fantasma">
                  Editar
                </BotonEnlace>
                <Boton chico variante="fantasma" onClick={() => accion(() => api.estado(r.id, !r.activo), r.activo ? 'Recurrente pausado.' : 'Recurrente reactivado.')}>
                  {r.activo ? 'Pausar' : 'Reactivar'}
                </Boton>
                <Boton chico variante="fantasma" className="ml-auto text-gasto" onClick={() => eliminar(r)}>
                  Eliminar
                </Boton>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
      <ConfirmarRecurrente recurrente={confirmando} onCerrar={() => setConfirmando(null)} alTerminar={() => setConfirmando(null)} />
    </>
  )
}
