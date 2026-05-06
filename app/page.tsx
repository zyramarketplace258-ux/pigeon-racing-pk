'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

interface Club { id: string; name: string; slug: string; city: string }
interface ActiveTournament {
  id: string; name: string; totalDays: number
  clubId: string; clubName: string; clubSlug: string; clubCity: string
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
      const snap = await getDocs(collection(db, 'clubs'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[]
      setClubs(list)
      const tournamentList: ActiveTournament[] = []
      await Promise.all(list.map(async (club) => {
        const tSnap = await getDocs(query(collection(db, 'clubs', club.id, 'tournaments'), where('status', '==', 'active')))
        tSnap.docs.forEach(d => {
          tournamentList.push({ id: d.id, name: d.data().name, totalDays: d.data().totalDays, clubId: club.id, clubName: club.name, clubSlug: club.slug, clubCity: club.city })
        })
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

      <section className="bg-primary py-8 px-4 text-center border-b border-green-800">
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
                className="bg-surface border border-green-700 hover:border-secondary rounded-xl p-4 transition group flex items-center justify-between">
                <div>
                  <span className="bg-green-700 text-green-200 text-xs px-2 py-0.5 rounded-full font-semibold">LIVE</span>
                  <h3 className="text-white font-bold text-base group-hover:text-secondary transition mt-2">{t.name}</h3>
                  <p className="text-green-400 text-xs mt-0.5">{t.clubName} · {t.clubCity}</p>
                </div>
                <span className="text-secondary text-xl ml-3">→</span>
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
