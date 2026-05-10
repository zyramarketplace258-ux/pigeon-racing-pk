'use client'
import { useEffect, useState } from 'react'
import { Playfair_Display } from 'next/font/google'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700'], style: ['italic'] })

export default function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('splashShown')) { setVisible(false); return }
    sessionStorage.setItem('splashShown', '1')
    const fadeTimer = setTimeout(() => setFading(true), 1400)
    const hideTimer = setTimeout(() => setVisible(false), 1900)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-b from-[#1b5e20] to-[#2e7d32]"
      style={{ transition: 'opacity 0.5s ease', opacity: fading ? 0 : 1 }}
    >
      <img src="/pigeon.png" alt="" className="w-28 h-28 object-contain drop-shadow-xl mb-4" />
      <h1 className={`${playfair.className} text-white text-3xl leading-tight text-center`}>
        High Fly Pigeons
      </h1>
      <p className="text-green-300 text-xs tracking-widest uppercase mt-1">Love for the Loft</p>
    </div>
  )
}
