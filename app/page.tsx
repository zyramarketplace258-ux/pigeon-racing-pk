'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { compareHours, formatTimeDisplay } from '@/lib/timeUtils'
import Link from 'next/link'

interface Club { id: string; name: string; slug: string; city: string }
interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
interface TopEntry { name: string; totalHours: string }
interface ActiveTournament {
  id: string; name: string; totalDays: number
  clubId: string; clubName: string; clubSlug: string; clubCity: string
  raceDays: RaceDay[]
  currentDay: number; totalRaceDays: number
  topEntries: TopEntry[]
}

const personalities = [
  { name: 'Ustad Anwar Sahib', title: 'Legend of Lahore Racing' },
  { name: 'Ch. Zafar Iqbal', title: 'Champion 2022 & 2023' },
  { name: 'Haji Bashir Ahmed', title: 'Founder - Punjab Racing League' },
]

export default function HomePage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [activeTournaments, setActiveTournaments] = useState<ActiveTournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]

      const snap = await getDocs(collection(db, 'clubs'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[]
      setClubs(list)

      const tournamentList: ActiveTournament[] = []

      await Promise.all(list.map(async (club) => {
        const tSnap = await getDocs(query(collection(db, 'clubs', club.id, 'tournaments'), where('status', '==', 'active')))
        tSnap.docs.forEach(d => {
          const data = d.data()
          const raceDays: RaceDay[] = data.raceDays || []
          const nonGap = raceDays.filter(rd => !rd.isGap)
          const passed = nonGap.filter(rd => rd.date <= today).length
          tournamentList.push({
            id: d.id, name: data.name, totalDays: data.totalDays,
            clubId: club.id, clubName: club.name, clubSlug: club.slug, clubCity: club.city,
            raceDays,
            currentDay: Math.min(passed, nonGap.length) || 1,
            totalRaceDays: nonGap.length,
            topEntries: [],
          })
        })
      }))

      // Fetch top entries and participant names for each active tournament
      await Promise.all(tournamentList.map(async (t) => {
        const nonGap = t.raceDays.filter(rd => !rd.isGap)
        const todayDay = nonGap.find(rd => rd.date === today)
        const currentDayNum = todayDay?.dayNumber ?? nonGap[nonGap.length - 1]?.dayNumber
        if (!currentDayNum) return

        const [entriesSnap, pSnap] = await Promise.all([
          getDocs(collection(db, 'clubs', t.clubId, 'tournaments', t.id, 'entries')),
          getDocs(collection(db, 'clubs', t.clubId, 'participants')),
        ])

        const nameMap: Record<string, string> = {}
        pSnap.docs.forEach(d => { nameMap[d.id] = d.data().name })

        const suffix = `_day${currentDayNum}`
        t.topEntries = entriesSnap.docs
          .filter(d => d.id.endsWith(suffix))
          .map(d => ({
            name: nameMap[d.id.slice(0, -suffix.length)] || 'Unknown',
            totalHours: d.data().totalHours || '',
          }))
          .filter(e => e.totalHours)
          .sort((a, b) => compareHours(a.totalHours, b.totalHours))
          .slice(0, 3)
      }))

      setActiveTournaments(tournamentList)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <main className="min-h-screen bg-dark text-white">

      <header className="bg-primary border-b border-secondary px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-secondary">🐦 Pakistan Pigeon Racing</h1>
          <p className="text-green-300 text-xs">Official Racing Platform</p>
        </div>
        <div className="flex gap-2">
          <Link href="/club/login" className="text-xs bg-surface border border-green-700 text-green-300 px-2 sm:px-3 py-1.5 rounded font-semibold hover:border-secondary hover:text-secondary transition">
            Club Login
          </Link>
          <Link href="/admin/login" className="text-xs bg-secondary text-dark px-2 sm:px-3 py-1.5 rounded font-semibold hover:bg-accent transition">
            Admin
          </Link>
        </div>
      </header>

      {/* Live Stats Banner */}
      {!loading && (
        <div className="bg-primary border-b border-green-800 px-4 py-4">
          <div className="flex justify-center gap-8 sm:gap-16 max-w-lg mx-auto">
            <div className="text-center">
              <p className="text-secondary font-bold text-2xl sm:text-3xl">{activeTournaments.length}</p>
              <p className="text-green-400 text-xs uppercase tracking-widest">Live Tournaments</p>
            </div>
            <div className="w-px bg-green-800"></div>
            <div className="text-center">
              <p className="text-secondary font-bold text-2xl sm:text-3xl">{clubs.length}</p>
              <p className="text-green-400 text-xs uppercase tracking-widest">Clubs</p>
            </div>
          </div>
        </div>
      )}

      <section className="bg-primary py-6 px-4 text-center border-b border-green-800">
        <h2 className="text-2xl sm:text-3xl font-bold text-secondary mb-2">Pakistan Pigeon Racing</h2>
        <p className="text-green-300 text-sm max-w-xl mx-auto">
          The official platform for pigeon racing clubs across Pakistan.
        </p>
      </section>

      <section className="bg-surface px-4 py-6 border-b border-green-900">
        <h2 className="text-secondary text-sm font-bold mb-4 uppercase tracking-widest">🏆 Legends of the Sport</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {personalities.map((p, i) => (
            <div key={i} className="bg-primary border border-secondary rounded-xl p-4 flex items-center gap-4 sm:flex-col sm:text-center sm:p-6">
              <div className="w-14 h-14 sm:w-20 sm:h-20 shrink-0 rounded-full bg-secondary flex items-center justify-center text-dark text-2xl sm:text-3xl font-bold sm:mx-auto sm:mb-3">
                {p.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-white font-bold text-base">{p.name}</h3>
                <p className="text-green-300 text-xs mt-0.5">{p.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!loading && activeTournaments.length > 0 && (
        <section className="px-4 py-6 border-b border-green-900">
          <h2 className="text-secondary text-sm font-bold mb-4 uppercase tracking-widest">🟢 Live Tournaments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeTournaments.map(t => (
              <Link key={`${t.clubId}-${t.id}`} href={`/${t.clubSlug}/${t.id}`}
                className="bg-surface border border-green-700 hover:border-secondary rounded-xl p-4 transition group">

                {/* Tournament header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <span className="bg-green-700 text-green-200 text-xs px-2 py-0.5 rounded-full font-semibold">LIVE</span>
                    <h3 className="text-white font-bold text-base group-hover:text-secondary transition mt-2 truncate">{t.name}</h3>
                    <p className="text-green-400 text-xs mt-0.5 truncate">{t.clubName} · {t.clubCity}</p>
                  </div>
                  <span className="text-secondary text-xl ml-3 shrink-0">→</span>
                </div>

                {/* Day progress bar */}
                {t.totalRaceDays > 0 && (
                  <div className="mt-3 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-green-400 text-xs">Day {t.currentDay} of {t.totalRaceDays}</span>
                      <span className="text-green-600 text-xs">{Math.round((t.currentDay / t.totalRaceDays) * 100)}%</span>
                    </div>
                    <div className="w-full bg-green-900 rounded-full h-1.5">
                      <div
                        className="bg-secondary h-1.5 rounded-full transition-all"
                        style={{ width: `${(t.currentDay / t.totalRaceDays) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Mini leaderboard */}
                {t.topEntries.length > 0 && (
                  <div className="border-t border-green-900 pt-2 space-y-1">
                    {t.topEntries.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className={`truncate mr-2 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-amber-600'}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {entry.name}
                        </span>
                        <span className="font-mono text-secondary shrink-0">{formatTimeDisplay(entry.totalHours)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 py-6">
        <h2 className="text-secondary text-sm font-bold mb-4 uppercase tracking-widest">🏟️ Registered Clubs</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface border border-green-900 rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary shrink-0"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-primary rounded w-3/4"></div>
                    <div className="h-3 bg-primary rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : clubs.length === 0 ? (
          <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">🏟️</p>
            <p className="text-white font-bold">No clubs registered yet</p>
            <p className="text-green-400 text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clubs.map((club) => (
              <Link key={club.id} href={`/${club.slug}`}
                className="bg-surface border border-green-800 hover:border-secondary rounded-xl p-4 transition group flex items-center gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full bg-primary border border-secondary flex items-center justify-center text-secondary text-xl font-bold group-hover:bg-secondary group-hover:text-dark transition">
                  {club.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-base group-hover:text-secondary transition truncate">{club.name}</h3>
                  <p className="text-green-400 text-sm">{club.city}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="bg-primary border-t border-green-800 text-center py-4 text-green-400 text-xs mt-4">
        © 2026 Pakistan Pigeon Racing Platform. All rights reserved.
      </footer>

    </main>
  )
}
