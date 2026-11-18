import { useEffect, useRef } from 'react'

// Lets the phone/browser Back button close the top-most open layer (sheet, menu, detail page)
// instead of leaving the site. Each active layer owns one history entry.
interface Layer {
  id: number
  depth: number
  close: () => void
}

const layers: Layer[] = []
let nextLayerId = 1
let ignoredPops = 0
let isListening = false

// Back closes the deepest layer; ties go to the newest. Depth keeps app-level layers (tabs) below
// screen layers even when React registers them in a different order (child effects run first).
function takeTopLayer() {
  let topIndex = -1
  layers.forEach((layer, index) => {
    if (topIndex === -1 || layer.depth >= layers[topIndex].depth) topIndex = index
  })
  return topIndex === -1 ? undefined : layers.splice(topIndex, 1)[0]
}

function ensurePopListener() {
  if (isListening) return
  isListening = true
  window.addEventListener('popstate', () => {
    if (ignoredPops > 0) {
      ignoredPops -= 1
      return
    }
    takeTopLayer()?.close()
  })
}

export function useBackLayer(active: boolean, onClose: () => void, depth = 1) {
  const closeRef = useRef(onClose)
  const layerRef = useRef<Layer | null>(null)
  const releaseTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!active) return
    ensurePopListener()

    if (releaseTimerRef.current !== undefined && layerRef.current) {
      // Re-activated before the release ran (e.g. React StrictMode remount): keep the same entry.
      window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = undefined
    } else {
      const layer: Layer = { id: nextLayerId++, depth, close: () => closeRef.current() }
      layerRef.current = layer
      layers.push(layer)
      window.history.pushState({ subhamastuLayer: layer.id }, '')
    }

    return () => {
      const layer = layerRef.current
      if (!layer || !layers.includes(layer)) {
        layerRef.current = null // already removed by the Back button
        return
      }
      // Closed from the UI: drop our history entry (deferred so an immediate remount can keep it).
      releaseTimerRef.current = window.setTimeout(() => {
        releaseTimerRef.current = undefined
        const index = layers.indexOf(layer)
        layerRef.current = null
        if (index === -1) return
        layers.splice(index, 1)
        ignoredPops += 1
        window.history.back()
      }, 0)
    }
  }, [active, depth])
}
