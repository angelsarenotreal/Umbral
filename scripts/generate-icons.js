const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

function isInsideUmbralLogo(x, y) {
  // 1. Eclipse Core Circle at (12, 6.5) with radius 2.8
  const cdx = x - 12
  const cdy = y - 6.5
  if (cdx * cdx + cdy * cdy <= 2.8 * 2.8) return true

  // 2. Umbral 'U' Monogram Outer Boundary (Edge-to-Edge)
  let insideOuter = false
  if (x >= 2 && x <= 22 && y >= 1.5 && y <= 12.5) {
    insideOuter = true
  } else if (y > 12.5 && y <= 22.5) {
    const udx = x - 12
    const udy = y - 12.5
    if (udx * udx + udy * udy <= 10 * 10 && x >= 2 && x <= 22) {
      insideOuter = true
    }
  }

  if (!insideOuter) return false

  // 3. Inner 'U' Cutout
  let insideInner = false
  if (x > 7.5 && x < 16.5 && y >= 1.5 && y <= 12.5) {
    insideInner = true
  } else if (y > 12.5 && y <= 17) {
    const udx = x - 12
    const udy = y - 12.5
    if (udx * udx + udy * udy < 4.5 * 4.5) {
      insideInner = true
    }
  }

  return !insideInner
}

// Distance from point to rounded rect boundary
function roundedRectCoverage(x, y, w, h, r) {
  const cx = w / 2
  const cy = h / 2
  const halfW = w / 2
  const halfH = h / 2

  const dx = Math.abs(x - cx) - (halfW - r)
  const dy = Math.abs(y - cy) - (halfH - r)

  if (dx <= 0 && dy <= 0) return 1.0
  if (dx <= 0 || dy <= 0) {
    const outside = Math.max(dx, dy)
    return outside <= r ? 1.0 : 0.0
  }
  const dist = Math.sqrt(dx * dx + dy * dy)
  return dist <= r ? 1.0 : 0.0
}

function createPng(width, height, isTray = false) {
  const bytesPerPixel = 4
  const rowSize = 1 + width * bytesPerPixel
  const rawData = Buffer.alloc(rowSize * height)

  const supersample = 4
  const cornerRadius = isTray ? width * 0.20 : width * 0.22
  const margin = isTray ? width * 0.04 : width * 0.05

  for (let py = 0; py < height; py++) {
    const rowOffset = py * rowSize
    rawData[rowOffset] = 0 // Filter: None

    for (let px = 0; px < width; px++) {
      let iconSamples = 0
      let bgSamples = 0
      const totalSamples = supersample * supersample

      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const sampleX = px + (sx + 0.5) / supersample
          const sampleY = py + (sy + 0.5) / supersample

          // Check rounded rect background coverage
          const inBg = roundedRectCoverage(sampleX, sampleY, width, height, cornerRadius)
          if (inBg > 0.5) {
            bgSamples++

            // Map sample to 24x24 SVG coordinate space inside the inset
            const iconAreaW = width - 2 * margin
            const iconAreaH = height - 2 * margin
            const svgX = ((sampleX - margin) / iconAreaW) * 24
            const svgY = ((sampleY - margin) / iconAreaH) * 24

            if (svgX >= 0 && svgX <= 24 && svgY >= 0 && svgY <= 24) {
              if (isInsideUmbralLogo(svgX, svgY)) {
                iconSamples++
              }
            }
          }
        }
      }

      const pixelOffset = rowOffset + 1 + px * bytesPerPixel
      const bgAlpha = bgSamples / totalSamples
      const iconAlpha = iconSamples / totalSamples

      if (bgAlpha === 0) {
        rawData[pixelOffset] = 0
        rawData[pixelOffset + 1] = 0
        rawData[pixelOffset + 2] = 0
        rawData[pixelOffset + 3] = 0
      } else {
        // Pure dark black background #000000 with full crisp white logo #ffffff on top
        const r = Math.round(255 * iconAlpha)
        const g = Math.round(255 * iconAlpha)
        const b = Math.round(255 * iconAlpha)
        const a = Math.round(255 * bgAlpha)

        rawData[pixelOffset] = r
        rawData[pixelOffset + 1] = g
        rawData[pixelOffset + 2] = b
        rawData[pixelOffset + 3] = a
      }
    }
  }

  const deflated = zlib.deflateSync(rawData, { level: 9 })
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function crc32(buf) {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i]
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (-(c & 1) & 0xedb88320)
      }
    }
    return (c ^ 0xffffffff) >>> 0
  }

  function makeChunk(type, data) {
    const len = data.length
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUInt32BE(len, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crc = crc32(Buffer.concat([typeBuf, data]))
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc, 0)
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 8 bits
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflated),
    makeChunk('IEND', Buffer.alloc(0))
  ])
}

// Ensure resources directory exists
const resDir = path.join(__dirname, '..', 'resources')
if (!fs.existsSync(resDir)) {
  fs.mkdirSync(resDir, { recursive: true })
}

// 1. App Icon PNG (256x256)
const icon256 = createPng(256, 256, false)
fs.writeFileSync(path.join(resDir, 'icon.png'), icon256)

// 2. Tray Icon PNG (32x32)
const tray32 = createPng(32, 32, true)
fs.writeFileSync(path.join(resDir, 'tray.png'), tray32)

// 3. Multi-resolution ICO generator (256x256, 48x48, 32x32, 16x16)
function createIco(pngBuffers) {
  const count = pngBuffers.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type 1 = ICO
  header.writeUInt16LE(count, 4) // Number of images

  let offset = 6 + count * 16
  const dirEntries = []
  const imageBodies = []

  for (const { width, height, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(width >= 256 ? 0 : width, 0)
    entry.writeUInt8(height >= 256 ? 0 : height, 1)
    entry.writeUInt8(0, 2) // Colors in palette
    entry.writeUInt8(0, 3) // Reserved
    entry.writeUInt16LE(1, 4) // Color planes
    entry.writeUInt16LE(32, 6) // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8) // Size of image data
    entry.writeUInt32LE(offset, 12) // Offset of image data
    dirEntries.push(entry)
    imageBodies.push(buffer)
    offset += buffer.length
  }

  return Buffer.concat([header, ...dirEntries, ...imageBodies])
}

const icon16 = createPng(16, 16, true)
const icon48 = createPng(48, 48, false)
const icoFile = createIco([
  { width: 256, height: 256, buffer: icon256 },
  { width: 48, height: 48, buffer: icon48 },
  { width: 32, height: 32, buffer: tray32 },
  { width: 16, height: 16, buffer: icon16 }
])
fs.writeFileSync(path.join(resDir, 'icon.ico'), icoFile)

console.log('Successfully generated resources/icon.png, resources/tray.png, and resources/icon.ico with Umbral brand logo!')
