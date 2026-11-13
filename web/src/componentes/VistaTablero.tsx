import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ContadorAnimado } from '../animacion/ContadorAnimado'
import type { Tablero } from '../api/tipos'
import { dinero, fechaCorta, formatoPorcentaje, nombreMes, NOMBRE_PROPOSITO, numero } from '../lib/formato'
import { GraficaCategorias, GraficaDias, GraficaMeses } from './Graficas'
import { ListaMovimientos } from './ListaMovimientos'
import { Barra, Cifra, Insignia, Seccion, Tarjeta, Vacio } from './ui'

function Variacion({ actual, anterior }: { actual: string; anterior: string }) {
  const a = numero(actual)
  const b = numero(anterior)
  if (!b) return null
  const p = Math.round(((a - b) / Math.abs(b)) * 100)
  return (
    <span className="text-xs text-texto-suave">
      {p >= 0 ? '▲' : '▼'} {Math.abs(p)}% vs. mes anterior
    </span>
  )
}

/**
 * D-F1 y D-F2: estados financieros que necesitan explicación. No ocultan nada
 * ni corrigen nada solos; solo dicen qué pasa y cómo resolverlo.
 */
function AvisosIntegridad({ t, enlaces }: { t: Tablero; enlaces: boolean }) {
  const disponible = numero(t.disponible)
  const inactivas = t.cajitas_inactivas_con_saldo ?? []
  if (disponible >= 0 && inactivas.length === 0) return null
  return (
    <div className="space-y-2" role="status">
      {disponible < 0 && (
        <div className="rounded-2xl border border-aviso/30 bg-aviso/10 p-4 text-sm">
          <p className="font-semibold text-aviso">Tu disponible está en negativo</p>
          <p className="mt-1 text-texto-suave">
            Tienes <span className="cifra font-medium text-texto">{dinero(t.total_cajitas)}</span> en cajitas, pero
            entre lo que entró y lo que salió falta <span className="cifra font-medium text-texto">{dinero(-disponible)}</span>.
            Suele pasar al corregir o borrar un ingreso que ya habías repartido. Para equilibrarlo, retira{' '}
            <span className="cifra font-medium text-texto">{dinero(-disponible)}</span> de una cajita o registra el ingreso
            que falte.
          </p>
          {enlaces && (
            <Link to="/cajitas" className="mt-2 inline-block text-acento hover:underline">
              Ir a cajitas
            </Link>
          )}
        </div>
      )}
      {inactivas.length > 0 && (
        <div className="rounded-2xl border border-aviso/30 bg-aviso/10 p-4 text-sm">
          <p className="font-semibold text-aviso">Hay dinero en cajitas desactivadas</p>
          <p className="mt-1 text-texto-suave">
            Se cuenta en tu saldo total. Actívalas para retirarlo o seguir usándolo:
          </p>
          <ul className="mt-2 space-y-1">
            {inactivas.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                {enlaces ? (
                  <Link to={`/cajitas/${c.id}`} className="truncate text-acento hover:underline">
                    {c.nombre}
                  </Link>
                ) : (
                  <span className="truncate">{c.nombre}</span>
                )}
                <span className="cifra shrink-0 font-medium">{dinero(c.saldo)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Contenido del tablero. Lo usan el inicio (con `extra` para botones rápidos y
 * pendientes) y la vista de solo lectura de una cuenta compartida (`enlaces` = false).
 */
export function VistaTablero({ t, extra, enlaces = true }: { t: Tablero; extra?: ReactNode; enlaces?: boolean }) {
  const ver = (a: string, texto = 'Ver todo') =>
    enlaces ? (
      <Link to={a} className="text-sm text-acento hover:underline">
        {texto}
      </Link>
    ) : null
  const m = t.mes_actual
  return (
    <>
      <Tarjeta className="p-5">
        <p className="text-sm text-texto-suave">Saldo total</p>
        <p className="cifra texto-degradado text-4xl font-bold tracking-tight sm:text-5xl">
          <ContadorAnimado valor={t.saldo_total} />
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-borde pt-4">
          <div>
            <p className="text-xs text-texto-suave">Disponible</p>
            <p className="cifra truncate text-lg font-semibold">
              <ContadorAnimado valor={t.disponible} />
            </p>
          </div>
          <div>
            <p className="text-xs text-texto-suave">En cajitas</p>
            <p className="cifra truncate text-lg font-semibold">
              <ContadorAnimado valor={t.total_cajitas} />
            </p>
          </div>
        </div>
      </Tarjeta>

      <AvisosIntegridad t={t} enlaces={enlaces} />

      {extra}

      {t.alertas_presupuesto.length > 0 && (
        <Seccion titulo="Presupuestos en alerta" acciones={ver('/presupuestos')}>
          <div className="space-y-2">
            {t.alertas_presupuesto.map((p) => (
              <Tarjeta key={p.id} className="py-3">
                <div className="mb-2 flex justify-between gap-2 text-sm">
                  <span className="font-medium">{p.categoria}</span>
                  <span className="cifra text-texto-suave">
                    {dinero(p.gastado)} de {dinero(p.presupuestado)}
                  </span>
                </div>
                <Barra porcentaje={p.porcentaje_barra} tono={p.excedido ? 'gasto' : 'aviso'} />
                <p className={p.excedido ? 'mt-1 text-xs text-gasto' : 'mt-1 text-xs text-aviso'}>
                  {p.excedido ? `Te pasaste por ${dinero(-numero(p.restante))}` : `Vas en ${p.porcentaje}%`}
                </p>
              </Tarjeta>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo={`Este mes · ${nombreMes(t.mes)}`}>
        <Tarjeta className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <Cifra etiqueta="Ingresos" valor={m.ingresos} tono="ingreso" />
            <Variacion actual={m.ingresos} anterior={t.mes_anterior.ingresos} />
          </div>
          <div>
            <Cifra etiqueta="Gastos personales" valor={m.gastos_personales} tono="gasto" />
          </div>
          <div>
            <Cifra etiqueta="Costos operativos" valor={m.costos_operativos} tono="gasto" />
          </div>
          <div>
            <Cifra etiqueta="Balance" valor={m.balance} />
            <Variacion actual={m.balance} anterior={t.mes_anterior.balance} />
          </div>
        </Tarjeta>
      </Seccion>

      {t.sin_movimientos ? (
        <Seccion titulo="Movimientos">
          <Vacio>Todavía no hay movimientos. Registra tu primer ingreso o gasto y aquí verás el resumen.</Vacio>
        </Seccion>
      ) : (
        <div className="grid gap-x-6 lg:grid-cols-2">
          <Seccion titulo="Ingresos y gastos por mes">
            <Tarjeta>
              <GraficaMeses datos={t.graficas.por_mes} />
            </Tarjeta>
          </Seccion>
          <Seccion titulo="Gastos del mes por categoría">
            <Tarjeta>
              {t.graficas.gastos_por_categoria.length ? (
                <GraficaCategorias datos={t.graficas.gastos_por_categoria} />
              ) : (
                <p className="text-sm text-texto-suave">Sin gastos este mes.</p>
              )}
            </Tarjeta>
          </Seccion>
          {t.graficas.producido_por_dia.some((d) => numero(d.total) > 0) && (
            <Seccion titulo="Producido por día">
              <Tarjeta>
                <GraficaDias datos={t.graficas.producido_por_dia} />
              </Tarjeta>
            </Seccion>
          )}
          {t.fuentes.length > 0 && (
            <Seccion titulo="Fuentes este mes" acciones={ver('/fuentes')}>
              <div className="space-y-2">
                {t.fuentes.map((f) => (
                  <Tarjeta key={f.id_fuente} className="py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {f.nombre} {!f.activa && <Insignia>Inactiva</Insignia>}
                      </span>
                      <span className="cifra font-semibold">{dinero(f.utilidad)}</span>
                    </div>
                    <p className="cifra text-xs text-texto-suave">
                      {dinero(f.bruto)} − {dinero(f.costos)} · {f.dias_trabajados} días · {dinero(f.promedio_diario)}/día
                      {f.margen !== null ? ` · margen ${f.margen}%` : ''}
                    </p>
                  </Tarjeta>
                ))}
              </div>
            </Seccion>
          )}
        </div>
      )}

      <div className="grid gap-x-6 lg:grid-cols-2">
        {t.cajitas.length > 0 && (
          <Seccion titulo="Cajitas" acciones={ver('/cajitas')}>
            <ul className="divide-y divide-borde rounded-2xl border border-borde bg-superficie">
              {t.cajitas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.nombre}</p>
                    <p className="text-xs text-texto-suave">
                      {NOMBRE_PROPOSITO[c.proposito]} · {c.es_resto ? 'Resto' : formatoPorcentaje(c.porcentaje)}
                    </p>
                  </div>
                  <span className="cifra font-semibold">{dinero(c.saldo)}</span>
                </li>
              ))}
            </ul>
          </Seccion>
        )}
        {t.metas.length > 0 && (
          <Seccion titulo="Metas" acciones={ver('/metas')}>
            <div className="space-y-2">
              {t.metas.map((x) => (
                <Tarjeta key={x.id} className="py-3">
                  <div className="mb-2 flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{x.nombre}</span>
                    {x.cumplida ? <Insignia tono="acento">Cumplida</Insignia> : <span className="cifra text-texto-suave">{x.porcentaje}%</span>}
                  </div>
                  <Barra porcentaje={x.porcentaje} />
                  <p className="cifra mt-1 text-xs text-texto-suave">
                    {dinero(x.saldo_cajita)} de {dinero(x.monto_objetivo)}
                    {x.fecha_objetivo ? ` · para el ${fechaCorta(x.fecha_objetivo)}` : ''}
                  </p>
                </Tarjeta>
              ))}
            </div>
          </Seccion>
        )}
      </div>

      {t.ultimos_movimientos.length > 0 && (
        <Seccion titulo="Últimos movimientos" acciones={ver('/movimientos')}>
          <ListaMovimientos movimientos={t.ultimos_movimientos} />
        </Seccion>
      )}
    </>
  )
}
