'use client'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Playfair_Display } from 'next/font/google'
import { useLanguage } from '@/lib/language-context'
import { useT } from '@/lib/translations'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700'], style: ['italic'] })

export default function SiteHeader() {
  const { lang } = useLanguage()
  const t = useT()
  const isUrdu = lang === 'ur'
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setLoggedIn(!!user))
    return () => unsub()
  }, [])

  return (
    <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-4 py-3">
      <div className="max-w-5xl mx-auto relative flex items-center justify-between">
        <Link href="/" className="block active:opacity-70 transition">
          <h1 className={`${!isUrdu ? playfair.className : ''} text-white text-lg sm:text-3xl leading-tight`}>{t('pakistanPigeon')}</h1>
          <p className="text-green-300 text-[10px] sm:text-xs tracking-widest uppercase">{t('loveForTheLoft')}</p>
        </Link>
        <img src="/pigeon.png" alt="" aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg pointer-events-none" />
        <div className="flex flex-col items-end gap-1">
          {loggedIn ? (
            <button onClick={() => signOut(auth).then(() => router.push('/'))} className="text-xs text-red-300 border border-red-700 px-2 py-1.5 rounded hover:bg-red-900 active:scale-95 transition font-medium">
              Logout
            </button>
          ) : (
            <Link href="/club/login" className="text-xs text-green-200 border border-green-600 px-2.5 py-1.5 rounded hover:bg-green-800 active:scale-95 transition font-medium">
              {t('clubLogin')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
