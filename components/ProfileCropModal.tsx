'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  file: File
  onSave: (blob: Blob) => void
  onCancel: () => void
}

const SIZE = 260
const OUTPUT = 250

export default function ProfileCropModal({ file, onSave, onCancel }: Props) {
  const [src, setSrc] = useState('')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(url)
  }, [file])

  const baseScale = imgNatural.w && imgNatural.h
    ? Math.max(SIZE / imgNatural.w, SIZE / imgNatural.h)
    : 1

  const rW = imgNatural.w * baseScale * zoom
  const rH = imgNatural.h * baseScale * zoom
  const maxX = Math.max(0, (rW - SIZE) / 2)
  const maxY = Math.max(0, (rH - SIZE) / 2)
  const cx = Math.max(-maxX, Math.min(maxX, offset.x))
  const cy = Math.max(-maxY, Math.min(maxY, offset.y))
  const imgLeft = (SIZE - rW) / 2 + cx
  const imgTop = (SIZE - rH) / 2 + cy

  const startDrag = (clientX: number, clientY: number) => {
    drag.current = { sx: clientX, sy: clientY, ox: cx, oy: cy }
  }

  const onMove = useCallback((clientX: number, clientY: number) => {
    if (!drag.current) return
    setOffset({ x: drag.current.ox + clientX - drag.current.sx, y: drag.current.oy + clientY - drag.current.sy })
  }, [])

  const stopDrag = () => { drag.current = null }

  useEffect(() => {
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const tm = (e: TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY)
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', stopDrag)
    window.addEventListener('touchmove', tm, { passive: true })
    window.addEventListener('touchend', stopDrag)
    return () => {
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', stopDrag)
      window.removeEventListener('touchmove', tm)
      window.removeEventListener('touchend', stopDrag)
    }
  }, [onMove])

  const save = () => {
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')!
    const s = OUTPUT / SIZE
    ctx.drawImage(img, imgLeft * s, imgTop * s, rW * s, rH * s)
    canvas.toBlob(b => { if (b) onSave(b) }, 'image/jpeg', 0.78)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-xs shadow-2xl">
        <h3 className="text-white font-bold text-center mb-1">Adjust Photo</h3>
        <p className="text-green-500 text-xs text-center mb-4">Drag to reposition · + / − to zoom</p>

        <div
          className="relative mx-auto cursor-grab active:cursor-grabbing select-none overflow-hidden"
          style={{ width: SIZE, height: SIZE, borderRadius: '50%', background: '#2a2a2a', border: '3px solid #4ade80' }}
          onMouseDown={e => startDrag(e.clientX, e.clientY)}
          onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt="crop"
              onLoad={() => {
                const img = imgRef.current
                if (img) setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
              }}
              draggable={false}
              style={{
                position: 'absolute',
                width: rW,
                height: rH,
                left: imgLeft,
                top: imgTop,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-4 mt-5">
          <button
            onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.1) * 10) / 10))}
            className="w-10 h-10 rounded-full bg-[#2a2a2a] text-white text-xl font-bold hover:bg-[#3a3a3a] transition flex items-center justify-center"
          >−</button>
          <span className="text-green-400 text-sm font-semibold w-10 text-center">{zoom.toFixed(1)}×</span>
          <button
            onClick={() => setZoom(z => Math.min(3, Math.round((z + 0.1) * 10) / 10))}
            className="w-10 h-10 rounded-full bg-[#2a2a2a] text-white text-xl font-bold hover:bg-[#3a3a3a] transition flex items-center justify-center"
          >+</button>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-[#2a2a2a] text-white text-sm font-semibold hover:bg-[#333] transition">
            Cancel
          </button>
          <button onClick={save}
            className="flex-1 py-2.5 rounded-xl bg-secondary hover:bg-accent text-dark text-sm font-bold transition">
            Save Photo
          </button>
        </div>
      </div>
    </div>
  )
}
