'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { compareHours, formatTimeDisplay, calculateGrandTotal } from '@/lib/timeUtils'
import Link from 'next/link'

interface Club { id: string; name: string; slug: string; city: string }
interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
interface Tournament {
  id: string; name: string; status: string; totalDays: number
  defaultStartTime: string; pigeonCount: number
  raceDays: RaceDay[]; participantIds?: string[]
}
interface Participant { id: string; name: string; area: string }
interface PigeonEntry { landingTime: string; hoursFlown: string }
interface DayEntry {
  rank: number
  participantId: string
  name: string
  area: string
  startTime: string
  pigeons: PigeonEntry[]
  totalHours: string
  hasData: boolean
  savedAt?: string
}

interface TotalRow {
  rank: number
  participantId: string
  name: string
  area: string
  daysFlown: number
  grandTotal: string
}

export default function TournamentResultsPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const tournamentId = params.tournamentId as string

  const [club, setClub] = useState<Club | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [showTotal, setShowTotal] = useState(false)
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([])
  const [totalRows, setTotalRows] = useState<TotalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(false)

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'clubs'), where('slug', '==', clubSlug))
      const snap = await getDocs(q)
      if (snap.empty) { setLoading(false); return }

      const clubData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Club
      setClub(clubData)

      const tDoc = await getDoc(doc(db, 'clubs', clubData.id, 'tournaments', tournamentId))
      if (!tDoc.exists()) { setLoading(false); return }
      const tData = { id: tDoc.id, ...tDoc.data() } as Tournament
      setTournament(tData)

      const pSnap = await getDocs(collection(db, 'clubs', clubData.id, 'participants'))
      const allParticipants = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]
      const filtered = tData.participantIds?.length
        ? allParticipants.filter(p => tData.participantIds!.includes(p.id))
        : allParticipants
      setParticipants(filtered)

      // Default to today's race day, else last day
      const today = new Date().toISOString().split('T')[0]
      const todayDay = tData.raceDays?.find(rd => rd.date === today && !rd.isGap)
      const nonGapDays = tData.raceDays?.filter(rd => !rd.isGap) ?? []
      const defaultDay = todayDay?.dayNumber ?? nonGapDays[nonGapDays.length - 1]?.dayNumber ?? 1
      setSelectedDay(defaultDay)
      setLoading(false)
    }
    load()
  }, [clubSlug, tournamentId])

  // Tick every 15s to re-evaluate the 2-minute highlight expiry
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  const isRecent = (savedAt?: string) => {
    if (!savedAt) return false
    return Date.now() - new Date(savedAt).getTime() < 2 * 60 * 1000
  }

  useEffect(() => {
    if (!club || !tournament || participants.length === 0 || showTotal) return
    setLoadingEntries(true)

    const entriesRef = collection(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries')
    const unsubscribe = onSnapshot(entriesRef, (snapshot) => {
      const rows: DayEntry[] = participants.map(p => {
        const entryDoc = snapshot.docs.find(d => d.id === `${p.id}_day${selectedDay}`)
        if (entryDoc) {
          const d = entryDoc.data()
          return {
            rank: 0, participantId: p.id, name: p.name, area: p.area,
            startTime: d.startTime, pigeons: d.pigeons || [],
            totalHours: d.totalHours || '', hasData: true, savedAt: d.savedAt,
          }
        }
        return {
          rank: 0, participantId: p.id, name: p.name, area: p.area,
          startTime: tournament.defaultStartTime,
          pigeons: Array.from({ length: tournament.pigeonCount }, () => ({ landingTime: '', hoursFlown: '' })),
          totalHours: '', hasData: false,
        }
      })

      const withData = rows.filter(r => r.hasData && r.totalHours).sort((a, b) => compareHours(a.totalHours, b.totalHours))
      const noData = rows.filter(r => !r.hasData || !r.totalHours)
      const sorted = [...withData, ...noData]
      sorted.forEach((r, i) => { r.rank = i + 1 })
      setDayEntries(sorted)
      setLoadingEntries(false)
    })

    return () => unsubscribe()
  }, [selectedDay, club, tournament, participants, showTotal])

  // Load grand totals across all days
  useEffect(() => {
    if (!showTotal || !club || !tournament || participants.length === 0) return
    let active = true
    setLoadingEntries(true)

    const load = async () => {
      const rows: TotalRow[] = await Promise.all(
        participants.map(async (p) => {
          const hours: string[] = []
          let daysFlown = 0
          await Promise.all(
            (tournament.raceDays || []).filter(rd => !rd.isGap).map(async (rd) => {
              const snap = await getDoc(doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries', `${p.id}_day${rd.dayNumber}`))
              if (snap.exists() && snap.data().totalHours) {
                hours.push(snap.data().totalHours)
                daysFlown++
              }
            })
          )
          return {
            rank: 0,
            participantId: p.id,
            name: p.name,
            area: p.area,
            daysFlown,
            grandTotal: hours.length > 0 ? calculateGrandTotal(hours) : '',
          }
        })
      )

      if (!active) return

      const withData = rows.filter(r => r.grandTotal).sort((a, b) => compareHours(a.grandTotal, b.grandTotal))
      const noData = rows.filter(r => !r.grandTotal)
      const sorted = [...withData, ...noData]
      sorted.forEach((r, i) => { r.rank = i + 1 })
      setTotalRows(sorted)
      setLoadingEntries(false)
    }

    load()
    return () => { active = false }
  }, [showTotal, club, tournament, participants])

  const rankEmoji = (rank: number, hasData: boolean) => {
    if (!hasData) return '—'
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const rankStyle = (rank: number, hasData: boolean) => {
    if (!hasData) return 'text-green-800'
    if (rank === 1) return 'text-yellow-400 font-bold'
    if (rank === 2) return 'text-gray-300 font-bold'
    if (rank === 3) return 'text-amber-600 font-bold'
    return 'text-green-500'
  }

  const today = new Date().toISOString().split('T')[0]
  const selectedRaceDay = tournament?.raceDays?.find(rd => rd.dayNumber === selectedDay)
  const hasAnyEntries = dayEntries.some(e => e.hasData)

  if (loading) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-green-400">Loading...</p>
    </main>
  )

  if (!club || !tournament) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-3">🏆</p>
        <p className="text-white font-bold">Tournament not found</p>
        <Link href="/" className="text-secondary text-sm mt-3 inline-block">← Home</Link>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{tournament.name}</h1>
          <p className="text-green-400 text-xs">{club.name} · {club.city}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs text-green-400 hover:text-secondary transition">🏠 Home</Link>
          <Link href={`/${clubSlug}`} className="text-xs text-green-400 hover:text-secondary transition">← Back to Club</Link>
        </div>
      </header>

      <div className="px-4 py-6 max-w-6xl mx-auto">

        {/* Tournament Info */}
        {(() => {
          const totalPigeons = tournament.pigeonCount * participants.length
          const landedPigeons = showTotal
            ? null
            : dayEntries.reduce((sum, e) => sum + e.pigeons.filter(pg => pg.landingTime).length, 0)
          return (
            <div className="bg-surface border border-green-800 rounded-xl p-4 mb-5 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-green-400 text-xs">Total Days</p>
                <p className="text-white font-bold text-xl">{tournament.totalDays}</p>
              </div>
              <div>
                <p className="text-green-400 text-xs">Total Pigeons</p>
                <p className="text-white font-bold text-xl">{totalPigeons}</p>
              </div>
              <div>
                <p className="text-green-400 text-xs">{showTotal ? 'Participants' : 'Landed'}</p>
                <p className="text-white font-bold text-xl">
                  {showTotal
                    ? participants.length
                    : `${landedPigeons} / ${totalPigeons}`
                  }
                </p>
              </div>
            </div>
          )
        })()}

        {/* Day Selector */}
        <div className="flex gap-2 flex-wrap mb-6">
          {tournament.raceDays?.filter(rd => !rd.isGap).map(rd => {
            const isToday = rd.date === today
            const isSelected = !showTotal && rd.dayNumber === selectedDay
            return (
              <button
                key={rd.dayNumber}
                onClick={() => { setShowTotal(false); setSelectedDay(rd.dayNumber) }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition text-center min-w-[64px] ${
                  isSelected
                    ? 'bg-secondary text-dark'
                    : 'bg-surface border border-green-800 text-green-400 hover:border-secondary'
                }`}
              >
                <span className="block">Day {rd.dayNumber}</span>
                <span className={`block text-xs mt-0.5 ${isSelected ? 'text-dark opacity-70' : isToday ? 'text-secondary' : 'opacity-60'}`}>
                  {rd.date}
                </span>
                {isToday && !isSelected && (
                  <span className="block text-secondary text-xs">● LIVE</span>
                )}
              </button>
            )
          })}

          {/* Total button */}
          <button
            onClick={() => setShowTotal(true)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition text-center min-w-[64px] ${
              showTotal
                ? 'bg-secondary text-dark'
                : 'bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-dark'
            }`}
          >
            <span className="block">🏆</span>
            <span className="block mt-0.5">Total</span>
          </button>
        </div>

        {/* Total View */}
        {showTotal && (
          loadingEntries ? (
            <p className="text-green-400 text-sm">Loading totals...</p>
          ) : (
            <div className="bg-surface border border-green-800 rounded-xl overflow-x-auto">
              <div className="bg-primary px-4 py-3 border-b border-green-800 flex items-center justify-between">
                <p className="text-secondary font-bold">🏆 Grand Total — All Days</p>
                <p className="text-green-600 text-xs">{totalRows.filter(r => r.grandTotal).length} participants</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-green-900">
                    <th className="text-left text-green-400 px-4 py-3 font-semibold">Rank</th>
                    <th className="text-left text-green-400 px-4 py-3 font-semibold">Participant</th>
                    <th className="text-left text-green-400 px-4 py-3 font-semibold">Days Flown</th>
                    <th className="text-left text-secondary px-4 py-3 font-semibold">Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {totalRows.map(row => (
                    <tr
                      key={row.participantId}
                      className={`border-b border-green-900 transition ${row.rank === 1 && row.grandTotal ? 'bg-yellow-900/20' : 'hover:bg-primary'}`}
                    >
                      <td className={`px-4 py-3 ${rankStyle(row.rank, !!row.grandTotal)}`}>
                        {rankEmoji(row.rank, !!row.grandTotal)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-white font-semibold block">{row.name}</span>
                        <span className="text-green-500 text-xs">{row.area}</span>
                      </td>
                      <td className="px-4 py-3 text-green-300">
                        {row.daysFlown > 0 ? `${row.daysFlown} / ${tournament.totalDays}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.grandTotal
                          ? <span className="font-mono font-bold text-secondary text-base">{formatTimeDisplay(row.grandTotal)}</span>
                          : <span className="text-green-800">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Day View */}
        {!showTotal && (
        <>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-secondary font-bold text-base">
              Day {selectedDay} — {selectedRaceDay?.date}
            </h2>
            {selectedRaceDay?.date === today && (
              <span className="text-green-400 text-xs">● Live today</span>
            )}
          </div>
          {hasAnyEntries && (
            <p className="text-green-600 text-xs">{dayEntries.filter(e => e.hasData).length} participants flew</p>
          )}
        </div>

        {/* Entries Table */}
        {loadingEntries ? (
          <p className="text-green-400 text-sm">Loading results...</p>
        ) : !hasAnyEntries ? (
          <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-white font-bold">No results for Day {selectedDay}</p>
            <p className="text-green-400 text-sm mt-1">
              {selectedRaceDay?.date === today ? 'Results will appear once the club submits entries.' : 'No data was submitted for this day.'}
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-green-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary border-b border-green-800">
                  <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Rank</th>
                  <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Participant</th>
                  <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Start</th>
                  {Array.from({ length: tournament.pigeonCount }, (_, i) => (
                    <th key={i} className="text-center text-green-400 px-3 py-3 font-semibold whitespace-nowrap">
                      🐦 {i + 1}
                    </th>
                  ))}
                  <th className="text-left text-secondary px-3 py-3 font-semibold whitespace-nowrap">Day Total</th>
                </tr>
              </thead>
              <tbody>
                {dayEntries.map(entry => (
                  <tr
                    key={entry.participantId}
                    className={`border-b border-green-900 transition ${
                      isRecent(entry.savedAt)
                        ? 'bg-secondary/10 border-l-2 border-l-secondary'
                        : entry.rank === 1 && entry.hasData
                          ? 'bg-yellow-900/20'
                          : 'hover:bg-primary'
                    }`}
                  >
                    <td className={`px-3 py-3 whitespace-nowrap ${rankStyle(entry.rank, entry.hasData)}`}>
                      {rankEmoji(entry.rank, entry.hasData)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-white font-semibold block">{entry.name}</span>
                      <span className="text-green-500 text-xs">{entry.area}</span>
                    </td>
                    <td className="px-3 py-3 text-green-300 font-mono whitespace-nowrap text-xs">
                      {entry.hasData ? entry.startTime : '—'}
                    </td>
                    {entry.pigeons.map((pg, pi) => (
                      <td key={pi} className="px-3 py-3 text-center whitespace-nowrap">
                        {pg.landingTime ? (
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className="text-white font-mono text-xs">{pg.landingTime}</span>
                            <span className="text-secondary font-mono text-xs font-semibold">{formatTimeDisplay(pg.hoursFlown)}</span>
                          </div>
                        ) : (
                          <span className="text-green-900">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {entry.totalHours ? (
                        <span className="font-mono font-bold text-secondary text-base">{formatTimeDisplay(entry.totalHours)}</span>
                      ) : (
                        <span className="text-green-800">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}
      </div>
    </main>
  )
}
