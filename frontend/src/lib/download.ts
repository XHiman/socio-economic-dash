let logo: Promise<HTMLImageElement | null> | null = null

/** MITRA logo for the watermark; resolves null if it can't be loaded so exports still work. */
function loadLogo(): Promise<HTMLImageElement | null> {
  logo ??= new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = `${import.meta.env.BASE_URL}MITRALogo.svg`
  })
  return logo
}

export interface LegendItem { label: string; color: string }

const FONT = "system-ui, 'Segoe UI', sans-serif"

/**
 * Stitch chart canvases into one PNG on a white background, with a title, per-chart captions
 * (from an enclosing <figure>'s <figcaption>), an optional legend, the data-source line and the
 * MITRA watermark, and download it.
 */
export async function exportPng(
  canvases: HTMLCanvasElement[], opts: { title: string; subtitle?: string; reference?: string; legend?: LegendItem[] },
): Promise<void> {
  if (!canvases.length) return
  const first = canvases[0]!
  const k = Math.max(1, first.width / (first.clientWidth || first.width)) // device-pixel ratio of the live chart
  const captions = canvases.map((c) => c.closest('figure')?.querySelector('figcaption')?.textContent ?? '')
  const pad = 20 * k, gap = 24 * k, headH = (opts.subtitle ? 60 : 44) * k, footH = 48 * k
  const capH = captions.some(Boolean) ? 28 * k : 0
  const legH = opts.legend?.length ? 32 * k : 0
  const chartH = Math.max(...canvases.map((c) => c.height))
  const out = document.createElement('canvas')
  out.width = canvases.reduce((w, c) => w + c.width, 0) + gap * (canvases.length - 1) + pad * 2
  out.height = chartH + headH + capH + legH + footH + pad
  const ctx = out.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#0f172a'
  ctx.font = `700 ${18 * k}px ${FONT}`
  const titleY = opts.subtitle ? pad / 2 + headH / 2 - 9 * k : pad / 2 + headH / 2
  ctx.fillText(opts.title, pad, titleY)
  if (opts.subtitle) {
    ctx.fillStyle = '#475569'
    ctx.font = `${13 * k}px ${FONT}`
    ctx.fillText(opts.subtitle, pad, titleY + 22 * k)
  }

  let x = pad
  canvases.forEach((c, i) => {
    if (captions[i]) {
      ctx.fillStyle = '#0f172a'
      ctx.font = `700 ${14 * k}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(captions[i]!, x + c.width / 2, headH + capH / 2)
      ctx.textAlign = 'left'
    }
    ctx.drawImage(c, x, headH + capH)
    x += c.width + gap
  })

  if (opts.legend?.length) {
    ctx.font = `${13 * k}px ${FONT}`
    const sw = 12 * k, space = 18 * k
    const widths = opts.legend.map((l) => sw + 6 * k + ctx.measureText(l.label).width)
    let lx = (out.width - (widths.reduce((a, b) => a + b, 0) + space * (widths.length - 1))) / 2
    const ly = headH + capH + chartH + legH / 2
    opts.legend.forEach((l, i) => {
      ctx.fillStyle = l.color
      ctx.fillRect(lx, ly - sw / 2, sw, sw)
      ctx.fillStyle = '#475569'
      ctx.fillText(l.label, lx + sw + 6 * k, ly)
      lx += widths[i]! + space
    })
  }

  const footY = out.height - footH / 2 - pad / 2
  if (opts.reference) {
    ctx.fillStyle = '#64748b'
    ctx.font = `${12 * k}px ${FONT}`
    ctx.fillText(`Source: ${opts.reference}`, pad, footY)
  }
  const img = await loadLogo()
  if (img) {
    const h = 38 * k, w = h * (img.naturalWidth / img.naturalHeight || 1)
    ctx.globalAlpha = 0.75
    ctx.drawImage(img, out.width - pad - w, footY - h / 2, w, h)
    ctx.globalAlpha = 1
  }

  const a = document.createElement('a')
  a.download = `${opts.title.replace(/[^\w]+/g, '_')}.png`
  a.href = out.toDataURL('image/png')
  a.click()
}
