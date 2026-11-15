import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ContadorAnimado } from '../animacion/ContadorAnimado'
import type { Tablero } from '../api/tipos'
import { dinero, fechaCorta, formatoPorcentaje, nombreMes, NOMBRE_PROPOSITO, numero } from '../lib/formato'
import { GraficaCategorias, GraficaDias, GraficaMeses } from './Graficas'
import { ListaMovimientos } from './ListaMovimientos'
import { Barra, cx, Divulgable, Insignia, Seccion, Tarjeta, Vacio } from './ui'

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
        <div className="rounded-tarjeta border border-aviso/30 bg-aviso/10 p-4 text-sm">
          <p className="font-semibold text-aviso">Tu disponible está en negativo</p>
          <p className="mt-1 text-texto-suave">
            Tienes <span className="cifra font-medium text-texto">{dinero(t.total_cajitas)}</span> en cajitas, pero
            entre lo que entró y lo que salió falta <span className="cifra font-medium text-texto">{dinero(-disponible)}</span>.
            Suele pasar al corregir o borrar un ingreso que ya habías repartido. Para equilibrarlo, retira{' '}
            <span className="cifra font-medium text-texto">{dinero(-disponible)}</span> de una cajita o registra el ingreso
            que falte.
          </p>
          {enlaces && (
            <Link to="/caparazon" className="mt-2 inline-block text-acento hover:underline">
              Ir al Caparazón
            </Link>
          )}
        </div>
      )}
      {inactivas.length > 0 && (
        <div className="rounded-tarjeta border border-aviso/30 bg-aviso/10 p-4 text-sm">
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
 * Contenido del tablero, en orden de prioridad: saldo, el mes (ingresos y
 * gastos), acciones (`extra`), avisos, últimos movimientos y el ahorro; el
 * análisis (gráficas y fuentes) queda plegado detrás de "Análisis del mes".
 * Lo usan el inicio (con `extra` para registrar y pendientes) y la vista de
 * solo lectura de una cuenta compartida (`enlaces` = false).
 */
export function VistaTablero({ t, extra, enlaces = true }: { t: Tablero; extra?: ReactNode; enlaces?: boolean }) {
  const ver = (a: string, texto = 'Ver todo') =>
    enlaces ? (
      <Link to={a} className="-my-2 inline-flex min-h-11 items-center text-sm text-acento hover:underline">
        {texto}
      </Link>
    ) : null
  const m = t.mes_actual
  const gastos = numero(m.gastos_personales) + numero(m.costos_operativos)
  const hayCostos = numero(m.costos_operativos) > 0
  const hayGraficas = !t.sin_movimientos
  return (
    <>
      <Tarjeta className="p-5">
        <p className="text-sm text-texto-suave">Saldo total</p>
        <p className="cifra texto-degradado truncate text-4xl font-bold tracking-tight sm:text-5xl">
          <ContadorAnimado valor={t.saldo_total} />
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-borde pt-4">
          <div className="min-w-0">
            <dt className="text-xs text-texto-suave">Disponible</dt>
            <dd className="cifra truncate text-lg font-semibold">
              <ContadorAnimado valor={t.disponible} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-texto-suave">En cajitas</dt>
            <dd className="cifra truncate text-lg font-semibold">
              <ContadorAnimado valor={t.total_cajitas} />
            </dd>
          </div>
        </dl>
      </Tarjeta>

      <section className="mt-3" aria-labelledby="titulo-mes">
        <h2 id="titulo-mes" className="sr-only">
          Este mes, {nombreMes(t.mes)}
        </h2>
        <dl className="grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-tarjeta border border-borde bg-superficie px-4 py-3">
            <dt className="text-xs text-texto-suave">Ingresos de {nombreMes(t.mes).split(' ')[0].toLowerCase()}</dt>
            <dd className="cifra truncate text-lg font-semibold text-ingreso">{dinero(m.ingresos)}</dd>
            <dd>
              <Variacion actual={m.ingresos} anterior={t.mes_anterior.ingresos} />
            </dd>
          </div>
          <div className="min-w-0 rounded-tarjeta border border-borde bg-superficie px-4 py-3">
            <dt className="text-xs text-texto-suave">Gastos{hayCostos ? ' y costos' : ''}</dt>
            <dd className="cifra truncate text-lg font-semibold text-gasto">{dinero(gastos)}</dd>
            {hayCostos && (
              <dd className="cifra truncate text-xs text-texto-suave">
                {dinero(m.gastos_personales)} personales · {dinero(m.costos_operativos)} costos
              </dd>
            )}
          </div>
        </dl>
      </section>

      <AvisosIntegridad t={t} enlaces={enlaces} />

      {extra}

      {t.alertas_presupuesto.length > 0 && (
        <Seccion titulo="Presupuestos en alerta" acciones={ver('/presupuestos')}>
          <ul className="divide-y divide-borde rounded-tarjeta border border-borde bg-superficie">
            {t.alertas_presupuesto.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="mb-2 flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{p.categoria}</span>
                  <span className="cifra shrink-0 text-texto-suave">
                    {dinero(p.gastado)} de {dinero(p.presupuestado)}
                  </span>
                </div>
                <Barra porcentaje={p.porcentaje_barra} tono={p.excedido ? 'gasto' : 'aviso'} etiqueta={`Presupuesto de ${p.categoria}`} />
                <p className={p.excedido ? 'mt-1 text-xs text-gasto' : 'mt-1 text-xs text-texto-suave'}>
                  {p.excedido ? `Te pasaste por ${dinero(-numero(p.restante))}` : `Vas en ${p.porcentaje}%`}
                </p>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {t.sin_movimientos ? (
        <Seccion titulo="Movimientos">
          <Vacio>Todavía no hay movimientos. Registra tu primer ingreso o gasto y aquí verás el resumen.</Vacio>
        </Seccion>
      ) : (
        t.ultimos_movimientos.length > 0 && (
          <Seccion titulo="Últimos movimientos" acciones={ver('/movimientos')}>
            <ListaMovimientos
              movimientos={t.ultimos_movimientos.slice(0, 5)}
              enlace={enlaces ? (x) => (x.editable ? `/movimientos/${x.id}` : null) : undefined}
            />
          </Seccion>
        )
      )}

      {(t.cajitas.length > 0 || t.metas.length > 0) && (
        <Seccion titulo="Ahorro" acciones={ver('/caparazon', 'Ver Caparazón')}>
          <div className="rounded-tarjeta border border-borde bg-superficie">
            {t.cajitas.length > 0 && (
              <ul className="divide-y divide-borde">
                {t.cajitas.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.nombre}</p>
                      <p className="truncate text-xs text-texto-suave">
                        {NOMBRE_PROPOSITO[c.proposito]} · {c.es_resto ? 'Resto' : formatoPorcentaje(c.porcentaje)}
                      </p>
                    </div>
                    <span className="cifra shrink-0 font-semibold">{dinero(c.saldo)}</span>
                  </li>
                ))}
                {t.cajitas.length > 4 && (
                  <li className="px-4 py-2 text-xs text-texto-suave">y {t.cajitas.length - 4} cajitas más</li>
                )}
              </ul>
            )}
            {t.metas.length > 0 && (
              <ul className={cx('space-y-3 px-4 py-3', t.cajitas.length > 0 && 'border-t border-borde')}>
                {t.metas.slice(0, 3).map((x) => (
                  <li key={x.id}>
                    <div className="mb-1.5 flex justify-between gap-2 text-sm">
                      <span className="truncate">Meta: {x.nombre}</span>
                      {x.cumplida ? <Insignia tono="acento">Cumplida</Insignia> : <span className="cifra shrink-0 text-texto-suave">{x.porcentaje}%</span>}
                    </div>
                    <Barra porcentaje={x.porcentaje} etiqueta={`Progreso de ${x.nombre}`} />
                    <p className="cifra mt-1 truncate text-xs text-texto-suave">
                      {dinero(x.saldo_cajita)} de {dinero(x.monto_objetivo)}
                      {x.fecha_objetivo ? ` · para el ${fechaCorta(x.fecha_objetivo)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Seccion>
      )}

      {hayGraficas && (
        <Divulgable
          clave="tablero-analisis"
          titulo="Análisis del mes"
          resumen={`Balance ${dinero(m.balance)} · por mes, por categoría${t.fuentes.length ? ' y por fuente' : ''}`}
        >
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
                <ul className="divide-y divide-borde rounded-tarjeta border border-borde bg-superficie">
                  {t.fuentes.map((f) => (
                    <li key={f.id_fuente} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">
                          {f.nombre} {!f.activa && <Insignia>Inactiva</Insignia>}
                        </span>
                        <span className="cifra shrink-0 font-semibold whitespace-nowrap">{dinero(f.utilidad)}</span>
                      </div>
                      <p className="cifra text-xs text-texto-suave">
                        {dinero(f.bruto)} − {dinero(f.costos)} · {f.dias_trabajados} días · {dinero(f.promedio_diario)}/día
                        {f.margen !== null ? ` · margen ${f.margen}%` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}
          </div>
        </Divulgable>
      )}
    </>
  )
}
