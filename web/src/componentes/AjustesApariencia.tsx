import { ESTILOS, PALETAS, usePreferencias, type Apariencia, type Movimiento } from '../tema/preferencias'
import { cx, Segmentos } from './ui'

/**
 * Selector de los cuatro ejes visuales (estilo, paleta, apariencia y
 * movimiento). Los cambios se aplican al instante y se guardan en este
 * dispositivo. No tocan datos ni reglas financieras.
 */
export function AjustesApariencia() {
  const { preferencias: p, cambiar, claro } = usePreferencias()
  const paletas = PALETAS[p.estilo]

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-texto-suave">Estilo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ESTILOS.map((e) => (
            <label
              key={e.id}
              className={cx(
                'flex cursor-pointer gap-3 rounded-control border p-3 text-sm transition-colors',
                p.estilo === e.id ? 'border-acento bg-acento/10' : 'border-borde hover:border-acento/50',
                !e.disponible && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type="radio"
                name="estilo"
                className="mt-0.5 accent-[var(--acento)]"
                checked={p.estilo === e.id}
                disabled={!e.disponible}
                onChange={() => cambiar({ estilo: e.id })}
              />
              <span>
                <span className="block font-semibold">{e.nombre}</span>
                <span className="text-xs text-texto-suave">{e.descripcion}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {paletas.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-texto-suave">Paleta</legend>
          <div className="flex flex-wrap gap-2">
            {paletas.map((x) => (
              <label
                key={x.id}
                className={cx(
                  'flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm',
                  p.paleta === x.id ? 'border-acento bg-acento/10 font-semibold' : 'border-borde hover:border-acento/50',
                )}
              >
                <input type="radio" name="paleta" className="sr-only" checked={p.paleta === x.id} onChange={() => cambiar({ paleta: x.id })} />
                <span aria-hidden className="flex overflow-hidden rounded-full border border-borde">
                  <span className="size-4" style={{ background: x.muestra[0] }} />
                  <span className="size-4" style={{ background: claro ? x.muestra[1] : x.muestra[2] }} />
                </span>
                {x.nombre}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-texto-suave">Apariencia</p>
        <Segmentos<Apariencia>
          valor={p.apariencia}
          onCambio={(apariencia) => cambiar({ apariencia })}
          opciones={[
            { valor: 'oscuro', etiqueta: 'Oscura' },
            { valor: 'claro', etiqueta: 'Clara' },
            { valor: 'sistema', etiqueta: 'Sistema' },
          ]}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-texto-suave">Movimiento</p>
        <Segmentos<Movimiento>
          valor={p.movimiento}
          onCambio={(movimiento) => cambiar({ movimiento })}
          opciones={[
            { valor: 'completo', etiqueta: 'Completo' },
            { valor: 'sutil', etiqueta: 'Sutil' },
            { valor: 'reducido', etiqueta: 'Reducido' },
          ]}
        />
        <p className="mt-1 text-xs text-texto-suave">
          Si tu dispositivo pide reducir el movimiento, Hicotea lo respeta siempre.
        </p>
      </div>
    </div>
  )
}
