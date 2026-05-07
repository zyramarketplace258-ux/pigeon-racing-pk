'use client'
import { createContext, useContext, useState, useEffect } from 'react'

export type Lang = 'en' | 'ur'

interface LangCtx { lang: Lang; toggle: () => void }
const Ctx = createContext<LangCtx>({ lang: 'en', toggle: () => {} })

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('pigeon-lang') as Lang | null
    if (saved === 'ur') setLang('ur')
  }, [])

  const toggle = () => setLang(prev => {
    const next = prev === 'en' ? 'ur' : 'en'
    localStorage.setItem('pigeon-lang', next)
    return next
  })

  return <Ctx.Provider value={{ lang, toggle }}>{children}</Ctx.Provider>
}

export function useLanguage() { return useContext(Ctx) }
