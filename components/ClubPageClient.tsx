'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { useT, fDayOf, fPctComplete, fDaysLeft, fDaysShort } from '@/lib/translations'
import SiteHeader from './SiteHeader'

export interface Club { id: string; name: string; nameUrdu?: string; slug: string; city: string; cityUrdu?: string; logoUrl?: string }
export interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
export interface Tournament {
  id: string; name: string; nameUrdu?: string; status: string; totalDays: number
  defaultStartTime: string; defaultEndTime?: string; raceDays?: RaceDay[]
}
interface Weather { temp: string; desc: string; icon: string }

export interface ClubInitialData {
  club: Club | null
  tournaments: Tournament[]
  notFound: boolean
}

function getWeatherIcon(code: string): string {
  const n = parseInt(code)
  if (n === 113) return '☀️'
  if (n <= 116) return '⛅️'
  if (n <= 122) return '☁️'
  if (n <= 143) return '🌫️'
  if (n <= 176) return '🌦️'
  if (n <= 260) return '🌧️'
  if (n <= 284) return '🌨️'
  if (n <= 314) return '🌧️'
  if (n <= 377) return '❄️'
  if (n === 386 || n === 389) return '⛈️'
  if (n <= 395) return '🌩️'
  return '🌡️'
}

export default function ClubPageClient({
  initialData,
  clubSlug,
}: {
  initialData: ClubInitialData
  clubSlug: string
}) {
  const { lang, toggle } = useLanguage()
  const t = useT()
  const [club] = useState<Club | null>(initialData.club)
  const [tournaments, setTournaments] = useState<Tournament[]>(initialData.tournaments)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [activeView, setActiveView] = useState<'tournaments' | 'history'>(() => {
    if (typeof window !== 'undefined') {
      const s = sessionStorage.getItem('club-view') as string
      if (s === 'tournaments' || s === 'history') return s
    }
    return 'tournaments'
  })
  const setView = (v: 'tournaments' | 'history') => { setActiveView(v); sessionStorage.setItem('club-view', v) }
  const isUrdu = lang === 'ur'

  useEffect(() => {
    if (!club) return
    let active = true

    ;(async () => {
      try {
        const res = await fetch(
          `https://wttr.in/${encodeURIComponent(club.city + ',Pakistan')}?format=j1`,
          { signal: AbortSignal.timeout(5000) }
        )
        const data = await res.json()
        const cc = data.current_condition[0]
        if (active) setWeather({ temp: cc.temp_C + '°C', desc: cc.weatherDesc[0].value, icon: getWeatherIcon(cc.weatherCode) })
      } catch { /* weather is optional */ }
    })()

    const unsub = onSnapshot(collection(db, 'clubs', club.id, 'tournaments'), tSnap => {
      if (!active) return
      setTournaments(tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tournament[])
    })

    return () => { active = false; unsub() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.id])

  const getDayProgress = (tr: Tournament) => {
    if (!tr.raceDays?.length) return null
    const today = new Date().toISOString().split('T')[0]
    const nonGap = tr.raceDays.filter(rd => !rd.isGap)
    const passed = nonGap.filter(rd => rd.date <= today).length
    return { current: Math.min(passed, nonGap.length) || 1, total: nonGap.length }
  }

  if (initialData.notFound) return (
    <main className={`min-h-screen bg-[#e8f5e9] flex items-center justify-center ${isUrdu ? 'font-urdu' : ''}`}>
      <div className="text-center px-4">
        <p className="text-6xl mb-4">🏟️</p>
        <h1 className="text-[#1b5e20] text-2xl font-bold">{t('clubNotFound')}</h1>
        <Link href="/" className="text-[#388e3c] hover:text-[#1b5e20] mt-4 inline-block font-semibold">{t('backToHome')}</Link>
      </div>
    </main>
  )

  const active = tournaments.filter(tr => tr.status === 'active')
  const completed = tournaments.filter(tr => tr.status === 'completed')
  const inactive = tournaments.filter(tr => tr.status === 'inactive')

  return (
    <main className={`min-h-screen bg-[#e8f5e9] ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>

      <SiteHeader />
      <nav className="bg-[#292929] px-4">
        <div className="max-w-4xl mx-auto flex items-center h-9 gap-1">
          {(['tournaments', 'history'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 h-full text-sm font-semibold transition border-b-2 ${
                activeView === v ? 'text-white border-[#66bb6a]' : 'text-gray-400 border-transparent hover:text-white'
              }`}>
              {v === 'tournaments' ? t('tabTournaments') : t('tabHistory')}
            </button>
          ))}
          <button onClick={toggle} className="ms-auto text-xs text-green-300 border border-green-700 px-2.5 py-1 rounded hover:bg-green-800 transition font-medium">
            {isUrdu ? 'EN' : 'اردو'}
          </button>
        </div>
      </nav>

      {/* Club identity strip */}
      <div className="bg-white border-b border-[#d4edda] px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <img src={club?.logoUrl || '/pigeon.png'} alt="Logo" className="w-9 h-9 rounded-full object-cover border border-[#a5d6a7] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[#1b5e20] font-bold text-sm leading-tight truncate">{club?.nameUrdu || club?.name}</p>
            <p className="text-[#4caf50] text-xs">{club?.cityUrdu || club?.city}</p>
          </div>
          {weather && <p className="text-xs text-[#777] shrink-0">{weather.icon} {weather.temp}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">

        {/* Weather */}
        {weather && (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-3xl">{weather.icon}</span>
              <div>
                <p className="text-[#1a1a1a] font-semibold text-sm">{weather.temp} · {weather.desc}</p>
                <p className="text-[#777] text-xs">{club?.city} {t('currentWeather')}</p>
              </div>
            </div>
          </div>
        )}

        {/* TOURNAMENTS VIEW */}
        {activeView === 'tournaments' && (
          <>
            {active.length > 0 && (
              <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2">
                  <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('activeTournaments')}</p>
                </div>
                <div className="divide-y divide-[#f0f0f0]">
                  {active.map(tr => {
                    const progress = getDayProgress(tr)
                    return (
                      <div key={tr.id} className="overflow-hidden">
                        <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#e65100] text-white text-xs px-1.5 py-0.5 rounded font-bold animate-pulse tracking-wider">LIVE</span>
                            <span className="text-green-300 text-xs">{tr.defaultStartTime}{tr.defaultEndTime ? ` → ${tr.defaultEndTime}` : ''}</span>
                          </div>
                          {progress && (
                            <span className="text-green-200 text-xs font-semibold bg-green-900 bg-opacity-40 px-2 py-0.5 rounded-full">
                              {fDayOf(lang, progress.current, progress.total)}
                            </span>
                          )}
                        </div>
                        <div className="px-4 py-3">
                          <h3 className="text-[#1a1a1a] font-bold text-base mb-2">{tr.nameUrdu || tr.name}</h3>
                          {progress && (
                            <div className="mb-3">
                              <div className="h-2 bg-[#e9ecef] rounded overflow-hidden mb-1">
                                <div className="h-full rounded" style={{ width: `${(progress.current / progress.total) * 100}%`, background: 'linear-gradient(90deg,#388e3c,#66bb6a)' }} />
                              </div>
                              <div className="flex justify-between text-xs text-gray-400">
                                <span>{fPctComplete(lang, Math.round((progress.current / progress.total) * 100))}</span>
                                <span>{fDaysLeft(lang, progress.total - progress.current)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <Link href={`/${clubSlug}/${tr.id}`} className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-[#23592b] bg-[#f1faf2] border-t border-[#d4edda] hover:bg-[#e8f5e9] transition">
                          {t('viewResults')}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {inactive.length > 0 && (
              <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
                <div className="bg-[#f9f9f9] border-b border-[#e9ecef] px-4 py-2">
                  <p className="text-[#999] text-xs font-bold uppercase tracking-widest">{t('upcoming')}</p>
                </div>
                <div className="divide-y divide-[#f0f0f0]">
                  {inactive.map(tr => (
                    <div key={tr.id} className="px-4 py-3 opacity-60">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-[#1a1a1a] font-semibold text-sm truncate">{tr.nameUrdu || tr.name}</h3>
                          <p className="text-[#777] text-xs mt-0.5">{fDaysShort(lang, tr.totalDays)}</p>
                        </div>
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full shrink-0 font-semibold">{t('soon')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active.length === 0 && inactive.length === 0 && (
              <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm p-10 text-center">
                <p className="text-4xl mb-3">🏆</p>
                <p className="text-[#1a1a1a] font-bold">{t('noActiveTournaments')}</p>
                <p className="text-[#777] text-sm mt-2">{t('checkHistory')}</p>
              </div>
            )}
          </>
        )}

        {/* HISTORY VIEW */}
        {activeView === 'history' && (
          <>
            {completed.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm p-10 text-center">
                <p className="text-4xl mb-3">🏁</p>
                <p className="text-[#1a1a1a] font-bold">{t('noCompletedYet')}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2">
                  <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('completedTournaments')}</p>
                </div>
                <div className="divide-y divide-[#f0f0f0]">
                  {completed.map(tr => {
                    const progress = getDayProgress(tr)
                    return (
                      <Link key={tr.id} href={`/${clubSlug}/${tr.id}`} className="block px-4 py-3 hover:bg-[#f9fdf9] transition group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-[#1a1a1a] font-semibold text-sm group-hover:text-[#1b5e20] transition truncate">{tr.nameUrdu || tr.name}</h3>
                            <p className="text-[#777] text-xs mt-0.5">
                              {fDaysShort(lang, progress ? progress.total : tr.totalDays)}
                              {tr.defaultStartTime ? ` · ${t('start')}: ${tr.defaultStartTime}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">{t('done')}</span>
                            <span className="text-[#388e3c]">→</span>
                          </div>
                        </div>
                        {progress && (
                          <div className="mt-2 h-1.5 bg-[#e9ecef] rounded overflow-hidden">
                            <div className="h-full w-full rounded bg-[#388e3c]" />
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      <footer className="text-center py-4 text-gray-400 text-xs border-t border-[#d4edda] bg-white mt-4">
        {t('footer')}
      </footer>
    </main>
  )
}
