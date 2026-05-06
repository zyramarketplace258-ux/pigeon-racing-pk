'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

interface Club { id: string; name: string; slug: string; city: string }
interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
interface Tournament {
  id: string; name: string; status: string; totalDays: number
  defaultStartTime: string; raceDays?: RaceDay[]
}
interface Weather { temp: string; desc: string; icon: string }

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

export default function ClubPublicPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string

  const [club, setClub] = useState<Club | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'clubs'), where('slug', '==', clubSlug))
      const snap = await getDocs(q)
      if (snap.empty) { setNotFound(true); setLoading(false); return }

      const clubData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Club
      setClub(clubData)

      const [tSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', clubData.id, 'tournaments')),
        // Fetch weather in parallel
        (async () => {
          try {
            const res = await fetch(
              `https://wttr.in/${encodeURIComponent(clubData.city + ',Pakistan')}?format=j1`,
              { signal: AbortSignal.timeout(5000) }
            )
            const data = await res.json()
            const cc = data.current_condition[0]
            setWeather({
              temp: cc.temp_C + '°C',
              desc: cc.weatherDesc[0].value,
              icon: getWeatherIcon(cc.weatherCode),
            })
          } catch { /* weather is optional */ }
        })(),
      ])

      const tList = tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tournament[]
      setTournaments(tList)
      setLoading(false)
    }
    load()
  }, [clubSlug])

  const getDayProgress = (t: Tournament) => {
    if (!t.raceDays?.length) return null
    const today = new Date().toISOString().split('T')[0]
    const nonGap = t.raceDays.filter(rd => !rd.isGap)
    const passed = nonGap.filter(rd => rd.date <= today).length
    return { current: Math.min(passed, nonGap.length) || 1, total: nonGap.length }
  }

  if (loading) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-green-400">Loading...</p>
    </main>
  )

  if (notFound) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-6xl mb-4">🏟️</p>
        <h1 className="text-white text-2xl font-bold">Club Not Found</h1>
        <Link href="/" className="text-secondary hover:text-accent mt-4 inline-block">← Back to Home</Link>
      </div>
    </main>
  )

  const active = tournaments.filter(t => t.status === 'active')
  const completed = tournaments.filter(t => t.status === 'completed')
  const inactive = tournaments.filter(t => t.status === 'inactive')

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-secondary flex items-center justify-center text-dark text-lg sm:text-xl font-bold">
            {club?.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-white truncate">{club?.name}</h1>
            <p className="text-green-400 text-xs">{club?.city}</p>
          </div>
        </div>
        <Link href="/" className="text-xs text-green-400 hover:text-secondary transition shrink-0 ml-3">
          ← Home
        </Link>
      </header>

      <div className="px-4 py-6 max-w-4xl mx-auto">

        {/* Weather Widget */}
        {weather && (
          <div className="bg-surface border border-green-800 rounded-xl px-4 py-3 flex items-center gap-3 mb-6">
            <span className="text-2xl shrink-0">{weather.icon}</span>
            <div>
              <p className="text-white font-semibold text-sm">{weather.temp} · {weather.desc}</p>
              <p className="text-green-500 text-xs">{club?.city} current weather</p>
            </div>
          </div>
        )}

        {/* Active */}
        {active.length > 0 && (
          <div className="mb-6">
            <h2 className="text-secondary font-bold text-sm uppercase tracking-widest mb-3">
              🟢 Active Tournaments
            </h2>
            <div className="space-y-3">
              {active.map(t => {
                const progress = getDayProgress(t)
                return (
                  <Link key={t.id} href={`/${clubSlug}/${t.id}`}
                    className="block bg-surface border border-secondary hover:border-accent rounded-xl p-4 transition group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="text-white font-bold text-base group-hover:text-secondary transition truncate">{t.name}</h3>
                        <p className="text-green-400 text-xs mt-0.5">Start: {t.defaultStartTime}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <span className="bg-green-700 text-green-200 text-xs px-2 py-0.5 rounded-full font-semibold">LIVE</span>
                        <span className="text-secondary text-base">→</span>
                      </div>
                    </div>
                    {progress && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-green-400 text-xs">Day {progress.current} of {progress.total}</span>
                          <span className="text-green-600 text-xs">{Math.round((progress.current / progress.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-green-900 rounded-full h-1.5">
                          <div className="bg-secondary h-1.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div className="mb-6">
            <h2 className="text-secondary font-bold text-sm uppercase tracking-widest mb-3">
              🏁 Completed Tournaments
            </h2>
            <div className="space-y-3">
              {completed.map(t => {
                const progress = getDayProgress(t)
                return (
                  <Link key={t.id} href={`/${clubSlug}/${t.id}`}
                    className="block bg-surface border border-green-800 hover:border-secondary rounded-xl p-4 transition group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="text-white font-bold text-sm group-hover:text-secondary transition truncate">{t.name}</h3>
                        <p className="text-green-400 text-xs mt-0.5">Start: {t.defaultStartTime}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <span className="bg-blue-900 text-blue-200 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">DONE</span>
                        <span className="text-secondary text-base">→</span>
                      </div>
                    </div>
                    {progress && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-green-400 text-xs">Day {progress.current} of {progress.total}</span>
                          <span className="text-green-600 text-xs">100%</span>
                        </div>
                        <div className="w-full bg-green-900 rounded-full h-1.5">
                          <div className="bg-green-600 h-1.5 rounded-full w-full"></div>
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {inactive.length > 0 && (
          <div className="mb-6">
            <h2 className="text-green-600 font-bold text-xs uppercase tracking-widest mb-3">Upcoming</h2>
            <div className="space-y-3">
              {inactive.map(t => (
                <div key={t.id} className="bg-surface border border-green-900 rounded-xl p-4 opacity-60">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-white font-bold text-sm truncate">{t.name}</h3>
                      <p className="text-green-600 text-xs mt-1">{t.totalDays} days</p>
                    </div>
                    <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full shrink-0">SOON</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tournaments.length === 0 && (
          <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-white font-bold">No Tournaments Yet</p>
            <p className="text-green-400 text-sm mt-2">Check back soon!</p>
          </div>
        )}
      </div>
    </main>
  )
}
