// Genera los íconos de la PWA desde los SVG oficiales del kit de identidad (Identidad/).
// Uso: pnpm iconos   (desde web/)
//
// Salida en web/public/:
//   favicon.svg               símbolo (copia)
//   favicon.ico               32×32 (PNG dentro de un ICO)
//   icono-192.png / 512.png   "any": cuadrado redondeado oscuro con el símbolo
//   icono-maskable-512.png    maskable: fondo a sangre, símbolo dentro de la zona segura del 80 %
//   apple-touch-icon.png      180×180 opaco (iOS redondea las esquinas por su cuenta)

import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const origen = join(raiz, '..', 'Identidad')
const destino = join(raiz, 'public')
const FONDO = '#07100C'

const leer = (n) => readFileSync(join(origen, n), 'utf8')
const simbolo = leer('s_mbolo_oficial_logo_svg.svg')
const maskable = leer('cono_maskable_pwa_logo_maskable_svg.svg')

/** Contenido interno de un <svg> (sin la etiqueta raíz ni comentarios). */
const interior = (svg) =>
  svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')

// "any": mismo encuadre que el maskable (símbolo al ~73 % centrado), pero con esquinas redondeadas al 22 %.
const redondeado = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="113" fill="${FONDO}"/>
<g transform="translate(68, 68) scale(3.133)">${interior(simbolo)}</g>
</svg>`

function png(svg, lado) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: lado }, background: 'rgba(0,0,0,0)' }).render().asPng()
}

/** ICO con una sola imagen PNG (formato admitido por todos los navegadores actuales). */
function ico(pngBuf, lado) {
  const cab = Buffer.alloc(6 + 16)
  cab.writeUInt16LE(0, 0) // reservado
  cab.writeUInt16LE(1, 2) // tipo: ícono
  cab.writeUInt16LE(1, 4) // una imagen
  cab.writeUInt8(lado >= 256 ? 0 : lado, 6)
  cab.writeUInt8(lado >= 256 ? 0 : lado, 7)
  cab.writeUInt8(0, 8) // sin paleta
  cab.writeUInt8(0, 9)
  cab.writeUInt16LE(1, 10) // planos
  cab.writeUInt16LE(32, 12) // bits por píxel
  cab.writeUInt32LE(pngBuf.length, 14)
  cab.writeUInt32LE(22, 18) // desplazamiento de la imagen
  return Buffer.concat([cab, pngBuf])
}

const salidas = {
  'favicon.svg': simbolo,
  'favicon.ico': ico(png(simbolo, 32), 32),
  'icono-192.png': png(redondeado, 192),
  'icono-512.png': png(redondeado, 512),
  'icono-maskable-512.png': png(maskable, 512),
  'apple-touch-icon.png': png(maskable, 180),
}

for (const [nombre, contenido] of Object.entries(salidas)) {
  writeFileSync(join(destino, nombre), contenido)
  console.log(`  ${nombre.padEnd(24)} ${String(Buffer.byteLength(contenido)).padStart(7)} B`)
}
