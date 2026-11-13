import { movimientoReducido } from '../tema/preferencias'
import { useEffect, useRef } from 'react'

interface Particula {
  x: number
  y: number
  vx: number
  vy: number
  radio: number
  alfa: number
  esVivo: boolean
}

/**
 * Campo de partículas 2D sutil para la Landing (Fase 4).
 * Reacciona suavemente al cursor y respeta prefers-reduced-motion.
 * Solo se monta en la Landing, garantizando 0 impacto en el resto de la app.
 */
export function ParticulasLanding() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Si el usuario prefiere movimiento reducido, no animamos
    const reduceMotion = movimientoReducido() // prefers-reduced-motion o preferencia "reducido"
    if (reduceMotion) return

    let animId: number
    let ancho = (canvas.width = window.innerWidth)
    let alto = (canvas.height = window.innerHeight)

    const mouse = { x: -1000, y: -1000, radio: 120 }

    // Generar partículas con densidad moderada (1 por cada ~25k px2)
    const cantidad = Math.min(Math.floor((ancho * alto) / 24000), 70)
    const particulas: Particula[] = []

    for (let i = 0; i < cantidad; i++) {
      particulas.push({
        x: Math.random() * ancho,
        y: Math.random() * alto,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radio: Math.random() * 1.8 + 0.8,
        alfa: Math.random() * 0.4 + 0.15,
        esVivo: Math.random() > 0.7, // 30% en tono acento-vivo (lima)
      })
    }

    const alMover = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }

    const alSalir = () => {
      mouse.x = -1000
      mouse.y = -1000
    }

    const alRedimensionar = () => {
      ancho = canvas.width = window.innerWidth
      alto = canvas.height = window.innerHeight
    }

    window.addEventListener('mousemove', alMover, { passive: true })
    window.addEventListener('mouseleave', alSalir)
    window.addEventListener('resize', alRedimensionar)

    const dibujar = () => {
      ctx.clearRect(0, 0, ancho, alto)

      // Dibujar y actualizar partículas
      for (let i = 0; i < particulas.length; i++) {
        const p = particulas[i]

        // Movimiento natural
        p.x += p.vx
        p.y += p.vy

        // Rebote en bordes
        if (p.x < 0 || p.x > ancho) p.vx *= -1
        if (p.y < 0 || p.y > alto) p.vy *= -1

        // Interacción suave con el cursor
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.hypot(dx, dy)

        if (dist < mouse.radio && dist > 0) {
          const fuerza = (mouse.radio - dist) / mouse.radio
          p.x -= (dx / dist) * fuerza * 1.5
          p.y -= (dy / dist) * fuerza * 1.5
        }

        // Color verde (#34D399) o lima (#A3E635) según tokens de Hicotea
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2)
        ctx.fillStyle = p.esVivo
          ? `rgba(163, 230, 53, ${p.alfa})`
          : `rgba(52, 211, 153, ${p.alfa})`
        ctx.fill()

        // Líneas tenues entre partículas cercanas
        for (let j = i + 1; j < particulas.length; j++) {
          const p2 = particulas[j]
          const djx = p.x - p2.x
          const djy = p.y - p2.y
          const d2 = Math.hypot(djx, djy)
          if (d2 < 90) {
            const alfaLinea = (1 - d2 / 90) * 0.12
            ctx.beginPath()
            ctx.strokeStyle = `rgba(52, 211, 153, ${alfaLinea})`
            ctx.lineWidth = 0.6
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(dibujar)
    }

    animId = requestAnimationFrame(dibujar)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', alMover)
      window.removeEventListener('mouseleave', alSalir)
      window.removeEventListener('resize', alRedimensionar)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-60 transition-opacity duration-700"
      aria-hidden="true"
    />
  )
}

