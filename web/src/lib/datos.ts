import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorApi } from '../api/cliente'

export type Estado<T> = {
  datos: T | undefined
  error: ErrorApi | null
  cargando: boolean
  recargar: () => Promise<void>
  /** Reemplaza los datos sin pedirlos (p. ej. con la respuesta de un guardado). */
  poner: (d: T) => void
}

/** Carga `pedir()` al montar y cada vez que cambian `deps`. Ignora respuestas viejas. */
export function useDatos<T>(pedir: () => Promise<T>, deps: unknown[] = []): Estado<T> {
  const [datos, setDatos] = useState<T>()
  const [error, setError] = useState<ErrorApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const turno = useRef(0)
  const pedirRef = useRef(pedir)
  useEffect(() => {
    pedirRef.current = pedir
  })

  const recargar = useCallback(async () => {
    const mio = ++turno.current
    setCargando(true)
    try {
      const d = await pedirRef.current()
      if (mio === turno.current) {
        setDatos(d)
        setError(null)
      }
    } catch (e) {
      if (mio === turno.current) setError(e instanceof ErrorApi ? e : new ErrorApi(0, String(e)))
    } finally {
      if (mio === turno.current) setCargando(false)
    }
  }, [])

  useEffect(() => {
    void recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { datos, error, cargando, recargar, poner: setDatos }
}

/** Estado de un formulario que se envía a la api: mensaje general + errores por campo. */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  const enviar = useCallback(async <R,>(accion: () => Promise<R>): Promise<R | undefined> => {
    setEnviando(true)
    setError(null)
    setErrores({})
    try {
      return await accion()
    } catch (e) {
      if (e instanceof ErrorApi) {
        setError(e.message)
        setErrores(e.errores)
      } else {
        setError('Algo salió mal. Intenta de nuevo.')
      }
      return undefined
    } finally {
      setEnviando(false)
    }
  }, [])

  const limpiar = useCallback(() => {
    setError(null)
    setErrores({})
  }, [])

  return { enviando, error, errores, enviar, limpiar }
}
