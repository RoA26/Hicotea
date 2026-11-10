import { useState } from 'react'
import { useParams } from 'react-router'
import { compartir as api } from '../api/cliente'
import { Icono } from '../componentes/Iconos'
import { ListaMovimientos } from '../componentes/ListaMovimientos'
import { VistaCalendario } from '../componentes/VistaCalendario'
import { VistaTablero } from '../componentes/VistaTablero'
import { Boton, BotonEnlace, Cargando, Cifra, Encabezado, ErrorCarga, Insignia, Segmentos, Tarjeta, Vacio } from '../componentes/ui'
import { useDatos } from '../lib/datos'

type Vista = 'tablero' | 'movimientos' | 'calendario'

/** Cuenta de otra persona, solo lectura. */
export default function Compartido() {
  const titular = Number(useParams().titular)
  const [vista, setVista] = useState<Vista>('tablero')
  const [pagina, setPagina] = useState(0)
  const [mes, setMes] = useState<string | undefined>()
  const recibidos = useDatos(api.recibidos)
  const t = useDatos(() => (vista === 'tablero' ? api.tablero(titular) : Promise.resolve(undefined)), [titular, vista])
  const m = useDatos(() => (vista === 'movimientos' ? api.movimientos(titular, { pagina }) : Promise.resolve(undefined)), [titular, vista, pagina])
  const c = useDatos(() => (vista === 'calendario' ? api.calendario(titular, mes) : Promise.resolve(undefined)), [titular, vista, mes])

  const nombre = recibidos.datos?.find((a) => a.id_titular === titular)?.nombre_completo_titular ?? 'Cuenta compartida'
  const activo = { tablero: t, movimientos: m, calendario: c }[vista]

  return (
    <>
      <Encabezado
        titulo={nombre}
        subtitulo={<Insignia>Solo lectura</Insignia>}
        acciones={
          <BotonEnlace to="/compartir" variante="fantasma" chico>
            <Icono nombre="izquierda" className="size-4" /> Volver
          </BotonEnlace>
        }
      />
      <div className="mb-5 max-w-md">
        <Segmentos<Vista>
          valor={vista}
          onCambio={setVista}
          opciones={[
            { valor: 'tablero', etiqueta: 'Resumen' },
            { valor: 'movimientos', etiqueta: 'Movimientos' },
            { valor: 'calendario', etiqueta: 'Calendario' },
          ]}
        />
      </div>
      {activo.error ? (
        <ErrorCarga error={activo.error} reintentar={activo.recargar} />
      ) : !activo.datos ? (
        <Cargando />
      ) : vista === 'tablero' && t.datos ? (
        <VistaTablero t={t.datos} enlaces={false} />
      ) : vista === 'calendario' && c.datos ? (
        <VistaCalendario c={c.datos} alCambiarMes={setMes} />
      ) : m.datos ? (
        <>
          <Tarjeta className="mb-4 grid grid-cols-3 gap-3">
            <Cifra etiqueta="Ingresos del mes" valor={m.datos.total_ingresos} tono="ingreso" />
            <Cifra etiqueta="Gastos del mes" valor={m.datos.total_gastos} tono="gasto" />
            <Cifra etiqueta="Balance" valor={m.datos.balance} />
          </Tarjeta>
          {m.datos.movimientos.length === 0 ? <Vacio>Sin movimientos este mes.</Vacio> : <ListaMovimientos movimientos={m.datos.movimientos} />}
          <div className="mt-4 flex justify-end gap-2">
            <Boton variante="secundario" chico disabled={!m.datos.hay_anterior} onClick={() => setPagina(pagina - 1)}>
              Anterior
            </Boton>
            <Boton variante="secundario" chico disabled={!m.datos.hay_siguiente} onClick={() => setPagina(pagina + 1)}>
              Siguiente
            </Boton>
          </div>
        </>
      ) : null}
    </>
  )
}
