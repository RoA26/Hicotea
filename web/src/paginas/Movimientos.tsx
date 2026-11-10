import { useSearchParams } from 'react-router'
import { movimientos } from '../api/cliente'
import type { FiltroMovimientos, TipoMovimiento } from '../api/tipos'
import { useAvisar, useConfirmar, useSaldo } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { ListaMovimientos, tituloMovimiento } from '../componentes/ListaMovimientos'
import { SelectorCategoria, SelectorFuente } from '../componentes/Selectores'
import { Boton, BotonEnlace, Campo, Cargando, Cifra, Encabezado, Entrada, ErrorCarga, Selector, Tarjeta, Vacio } from '../componentes/ui'
import { useCatalogos } from '../lib/catalogos'
import { useDatos } from '../lib/datos'
import { dinero, mesActual, NOMBRE_TIPO_MOVIMIENTO, primerDiaMes, ultimoDiaMes } from '../lib/formato'

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

  async function eliminar(id: number, titulo: string) {
    const ok = await confirmar({ titulo: 'Eliminar movimiento', mensaje: `Se eliminará "${titulo}". No se puede deshacer.`, aceptar: 'Eliminar', peligro: true })
    if (!ok) return
    try {
      const r = await movimientos.eliminar(id)
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
            <BotonEnlace to="/producido" variante="secundario">
              Producido del día
            </BotonEnlace>
            <BotonEnlace to="/movimientos/nuevo">
              <Icono nombre="mas" /> Nuevo
            </BotonEnlace>
          </>
        }
      />

      <Tarjeta className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <Tarjeta className="mb-4 grid grid-cols-3 gap-3">
            <Cifra etiqueta="Ingresos" valor={p.total_ingresos} tono="ingreso" />
            <Cifra etiqueta="Gastos" valor={p.total_gastos} tono="gasto" />
            <Cifra etiqueta="Balance" valor={p.balance} />
          </Tarjeta>
          {p.movimientos.length === 0 ? (
            <Vacio accion={<BotonEnlace to="/movimientos/nuevo">Registrar un movimiento</BotonEnlace>}>No hay movimientos con estos filtros.</Vacio>
          ) : (
            <ListaMovimientos
              movimientos={p.movimientos}
              acciones={(m) => (
                <>
                  {m.editable && (
                    <BotonEnlace to={`/movimientos/${m.id}`} variante="fantasma" chico aria-label="Editar">
                      <Icono nombre="lapiz" className="size-4" />
                    </BotonEnlace>
                  )}
                  {m.eliminable && (
                    <Boton variante="fantasma" chico aria-label="Eliminar" onClick={() => eliminar(m.id, tituloMovimiento(m))}>
                      <Icono nombre="basura" className="size-4" />
                    </Boton>
                  )}
                </>
              )}
            />
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-texto-suave">
            <span>
              {p.total_registros} {p.total_registros === 1 ? 'movimiento' : 'movimientos'} · balance {dinero(p.balance)}
            </span>
            <div className="flex gap-2">
              <Boton variante="secundario" chico disabled={!p.hay_anterior} onClick={() => setFiltro({ ...filtro, pagina: p.pagina - 1 })}>
                <Icono nombre="izquierda" className="size-4" /> Anterior
              </Boton>
              <Boton variante="secundario" chico disabled={!p.hay_siguiente} onClick={() => setFiltro({ ...filtro, pagina: p.pagina + 1 })}>
                Siguiente <Icono nombre="derecha" className="size-4" />
              </Boton>
            </div>
          </div>
        </>
      )}
    </>
  )
}
