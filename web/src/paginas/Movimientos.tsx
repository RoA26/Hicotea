import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { movimientos } from '../api/cliente'
import type { FiltroMovimientos, TipoMovimiento } from '../api/tipos'
import { useAvisar, useConfirmar, useSaldo } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { ListaMovimientos, tituloMovimiento } from '../componentes/ListaMovimientos'
import { SelectorCategoria, SelectorFuente } from '../componentes/Selectores'
import { Boton, BotonEnlace, BotonIcono, Campo, Cargando, Cifra, cx, Encabezado, Entrada, ErrorCarga, Selector, Tarjeta, Vacio } from '../componentes/ui'
import { conConfirmacionNegativo } from '../lib/correcciones'
import { useCatalogos } from '../lib/catalogos'
import { useDatos } from '../lib/datos'
import { fechaCorta, mesActual, NOMBRE_TIPO_MOVIMIENTO, primerDiaMes, ultimoDiaMes } from '../lib/formato'

const TIPOS = Object.keys(NOMBRE_TIPO_MOVIMIENTO) as TipoMovimiento[]

/** Filtros en la URL para poder volver atrás y compartir el enlace. */
function useFiltro(): [FiltroMovimientos, (f: FiltroMovimientos) => void] {
  const [q, setQ] = useSearchParams()
  const n = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined)
  const filtro: FiltroMovimientos = {
    desde: q.get('desde') ?? primerDiaMes(mesActual()),
    hasta: q.get('hasta') ?? ultimoDiaMes(mesActual()),
    tipo: (q.get('tipo') as TipoMovimiento) || undefined,
    id_categoria: n('id_categoria'),
    id_fuente: n('id_fuente'),
    pagina: n('pagina') ?? 0,
  }
  const poner = (f: FiltroMovimientos) => {
    const s = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '' && !(k === 'pagina' && v === 0)) s.set(k, String(v))
    setQ(s, { replace: true })
  }
  return [filtro, poner]
}

export default function Movimientos() {
  const [filtro, setFiltro] = useFiltro()
  const clave = JSON.stringify(filtro)
  const { version } = useSaldo()
  const pagina = useDatos(() => movimientos.listar(filtro), [clave, version])
  const cat = useCatalogos()
  const confirmar = useConfirmar()
  const avisar = useAvisar()
  const { setSaldo } = useSaldo()

  const cambiar = (c: Partial<FiltroMovimientos>) => setFiltro({ ...filtro, ...c, pagina: 0 })
  // En el celular los filtros van plegados; el botón dice cuántos hay puestos además del periodo.
  const [verFiltros, setVerFiltros] = useState(false)
  const extras = [filtro.tipo, filtro.id_categoria, filtro.id_fuente].filter((x) => x !== undefined).length
  const periodo = `${filtro.desde ? fechaCorta(filtro.desde) : 'Inicio'} – ${filtro.hasta ? fechaCorta(filtro.hasta) : 'hoy'}`

  async function eliminar(id: number, titulo: string) {
    const ok = await confirmar({ titulo: 'Eliminar movimiento', mensaje: `Se eliminará "${titulo}". No se puede deshacer.`, aceptar: 'Eliminar', peligro: true })
    if (!ok) return
    try {
      const r = await conConfirmacionNegativo(confirmar, (ok) => movimientos.eliminar(id, ok))
      if (!r) return
      setSaldo(r.saldo)
      avisar(r.mensaje)
      void pagina.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  const p = pagina.datos
  return (
    <>
      <Encabezado
        titulo="Movimientos"
        acciones={
          <>
            {/* En el celular el producido está en "Registrar" (barra inferior). */}
            <span className="hidden sm:contents">
              <BotonEnlace to="/producido" variante="secundario">
                Producido del día
              </BotonEnlace>
            </span>
            <BotonEnlace to="/movimientos/nuevo">
              <Icono nombre="mas" /> Nuevo
            </BotonEnlace>
          </>
        }
      />

      <button
        type="button"
        onClick={() => setVerFiltros(!verFiltros)}
        aria-expanded={verFiltros}
        aria-controls="filtros-movimientos"
        className="mb-3 flex min-h-11 w-full items-center gap-3 rounded-control border border-borde bg-superficie px-4 text-left text-sm sm:hidden"
      >
        <Icono nombre="filtro" className="size-4 text-texto-suave" />
        <span className="min-w-0 flex-1 truncate">{periodo}</span>
        {extras > 0 && <span className="rounded-full bg-acento/15 px-2 py-0.5 text-xs font-semibold text-acento">+{extras} filtro{extras > 1 ? 's' : ''}</span>}
        <span className="text-texto-suave">{verFiltros ? 'Ocultar' : 'Filtrar'}</span>
      </button>
      <Tarjeta id="filtros-movimientos" className={cx('mb-4 grid-cols-2 gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-5', verFiltros ? 'grid' : 'hidden')}>
        <Campo etiqueta="Desde">
          <Entrada type="date" value={filtro.desde ?? ''} onChange={(e) => cambiar({ desde: e.target.value || undefined })} />
        </Campo>
        <Campo etiqueta="Hasta">
          <Entrada type="date" value={filtro.hasta ?? ''} onChange={(e) => cambiar({ hasta: e.target.value || undefined })} />
        </Campo>
        <Campo etiqueta="Tipo">
          <Selector value={filtro.tipo ?? ''} onChange={(e) => cambiar({ tipo: (e.target.value as TipoMovimiento) || undefined })}>
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO_MOVIMIENTO[t]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Categoría">
          <SelectorCategoria
            vacio="Todas"
            categorias={cat.datos?.categorias ?? []}
            valor={filtro.id_categoria ?? null}
            onCambio={(id) => cambiar({ id_categoria: id ?? undefined })}
          />
        </Campo>
        <Campo etiqueta="Fuente">
          <SelectorFuente
            fuentes={cat.datos?.fuentes ?? []}
            valor={filtro.id_fuente ?? null}
            vacio="Todas"
            onCambio={(id) => cambiar({ id_fuente: id ?? undefined })}
          />
        </Campo>
      </Tarjeta>

      {pagina.error && !p ? (
        <ErrorCarga error={pagina.error} reintentar={pagina.recargar} />
      ) : !p ? (
        <Cargando />
      ) : (
        <>
          <Tarjeta className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Cifra etiqueta="Ingresos" valor={p.total_ingresos} tono="ingreso" />
            <Cifra etiqueta="Gastos" valor={p.total_gastos} tono="gasto" />
            <div className="col-span-2 border-t border-borde pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
              <Cifra etiqueta="Balance del periodo" valor={p.balance} />
            </div>
          </Tarjeta>
          {p.movimientos.length === 0 ? (
            <Vacio accion={<BotonEnlace to="/movimientos/nuevo">Registrar un movimiento</BotonEnlace>}>No hay movimientos con estos filtros.</Vacio>
          ) : (
            <ListaMovimientos
              movimientos={p.movimientos}
              // Tocar la fila abre la edición; "Eliminar" también está dentro del formulario.
              enlace={(m) => (m.editable ? `/movimientos/${m.id}` : null)}
              acciones={(m) => {
                const borrar = m.eliminable && (
                  <BotonIcono aria-label={`Eliminar ${tituloMovimiento(m)}`} onClick={() => eliminar(m.id, tituloMovimiento(m))}>
                    <Icono nombre="basura" className="size-4" />
                  </BotonIcono>
                )
                // Editables: en el celular se tocan para editar (y se eliminan desde el formulario), así que sus
                // botones solo aparecen desde `sm`. Las operaciones de cajita no se editan: su papelera siempre se ve.
                return m.editable ? (
                  <span className="hidden gap-1 sm:flex">
                    <BotonEnlace to={`/movimientos/${m.id}`} variante="fantasma" chico aria-label={`Editar ${tituloMovimiento(m)}`}>
                      <Icono nombre="lapiz" className="size-4" />
                    </BotonEnlace>
                    {borrar}
                  </span>
                ) : (
                  borrar
                )
              }}
            />
          )}
          <div className="mt-4 flex flex-col gap-3 text-sm text-texto-suave sm:flex-row sm:items-center sm:justify-between">
            <span>
              {p.total_registros} {p.total_registros === 1 ? 'movimiento' : 'movimientos'}
              {p.total_registros > 0 && ` · página ${p.pagina + 1}`}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Boton variante="secundario" className="sm:h-9 sm:px-3 sm:text-sm" disabled={!p.hay_anterior} onClick={() => setFiltro({ ...filtro, pagina: p.pagina - 1 })}>
                <Icono nombre="izquierda" className="size-4" /> Anterior
              </Boton>
              <Boton variante="secundario" className="sm:h-9 sm:px-3 sm:text-sm" disabled={!p.hay_siguiente} onClick={() => setFiltro({ ...filtro, pagina: p.pagina + 1 })}>
                Siguiente <Icono nombre="derecha" className="size-4" />
              </Boton>
            </div>
          </div>
        </>
      )}
    </>
  )
}
