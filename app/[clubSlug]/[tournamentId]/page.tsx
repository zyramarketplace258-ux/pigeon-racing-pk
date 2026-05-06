'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
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
  const [viewerCount, setViewerCount] = useState(0)
  const sessionId = useRef(Math.random().toString(36).slice(2, 10))

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

      const today = new Date().toISOString().split('T')[0]
      const todayDay = tData.raceDays?.find(rd => rd.date === today && !rd.isGap)
      const nonGapDays = tData.raceDays?.filter(rd => !rd.isGap) ?? []
      const defaultDay = todayDay?.dayNumber ?? nonGapDays[nonGapDays.length - 1]?.dayNumber ?? 1
      setSelectedDay(defaultDay)
      setLoading(false)
    }
    load()
  }, [clubSlug, tournamentId])

  // Online viewers presence tracking
  useEffect(() => {
    if (!club || !tournament) return
    const viewerRef = doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'viewers', sessionId.current)

    setDoc(viewerRef, { lastSeen: serverTimestamp() })
    const heartbeat = setInterval(() => setDoc(viewerRef, { lastSeen: serverTimestamp() }), 30000)

    const unsubscribe = onSnapshot(
      collection(db, 'clubs', club.id, 'tournaments', tournament.id, 'viewers'),
      snap => setViewerCount(snap.size)
    )

    return () => {
      clearInterval(heartbeat)
      deleteDoc(viewerRef)
      unsubscribe()
    }
  }, [club, tournament])

  // Tick every 15s to re-evaluate 5-minute highlight expiry
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  const isRecentLanding = (landingTime: string) => {
    if (!landingTime) return false
    const now = new Date()
    const [h, m] = landingTime.split(':').map(Number)
    const landing = new Date()
    landing.setHours(h, m, 0, 0)
    const diff = now.getTime() - landing.getTime()
    return diff >= 0 && diff < 5 * 60 * 1000
  }

  const mostRecentLanding = (() => {
    let best: { name: string; area: string; landingTime: string; hoursFlown: string } | null = null
    for (const entry of dayEntries) {
      if (!entry.hasData) continue
      for (const pg of entry.pigeons) {
        if (!pg.landingTime || !pg.hoursFlown) continue
        if (best === null || compareHours(pg.hoursFlown, best.hoursFlown) < 0) {
          best = { name: entry.name, area: entry.area, landingTime: pg.landingTime, hoursFlown: pg.hoursFlown }
        }
      }
    }
    return best
  })()

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

  // Load grand totals
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
          return { rank: 0, participantId: p.id, name: p.name, area: p.area, daysFlown, grandTotal: hours.length > 0 ? calculateGrandTotal(hours) : '' }
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

  const shareOnWhatsApp = () => {
    if (!club || !tournament) return
    const lines: string[] = []

    if (showTotal) {
      lines.push(`🏆 Grand Total — ${tournament.name}`)
      lines.push(`📍 ${club.name} · ${club.city}`)
      lines.push('')
      totalRows.filter(r => r.grandTotal).slice(0, 5).forEach((row, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
        lines.push(`${medal} ${row.name} — ${formatTimeDisplay(row.grandTotal)}`)
      })
    } else {
      lines.push(`🐦 Day ${selectedDay} Results — ${tournament.name}`)
      lines.push(`📍 ${club.name} · ${club.city}`)
      if (selectedRaceDay?.date) lines.push(`📅 ${selectedRaceDay.date}`)
      lines.push('')
      dayEntries.filter(e => e.hasData && e.totalHours).slice(0, 5).forEach((entry, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
        lines.push(`${medal} ${entry.name} — ${formatTimeDisplay(entry.totalHours)}`)
      })
    }

    lines.push('')
    lines.push(`🔗 ${window.location.href}`)
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
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
      <div className="text-center px-4">
        <p className="text-4xl mb-3">🏆</p>
        <p className="text-white font-bold">Tournament not found</p>
        <Link href="/" className="text-secondary text-sm mt-3 inline-block">← Home</Link>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-3">
            <h1 className="text-base sm:text-xl font-bold text-white truncate">{tournament.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-green-400 text-xs truncate">{club.name} · {club.city}</p>
              {viewerCount > 1 && (
                <span className="text-green-600 text-xs shrink-0">· 👁 {viewerCount}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={shareOnWhatsApp}
              className="bg-green-700 hover:bg-green-600 text-white text-xs px-2 sm:px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1"
            >
              <span>📲</span>
              <span className="hidden sm:inline">Share</span>
            </button>
            <Link href="/" className="text-xs text-green-400 hover:text-secondary transition">🏠</Link>
            <Link href={`/${clubSlug}`} className="text-xs text-green-400 hover:text-secondary transition">← Club</Link>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 max-w-6xl mx-auto">

        {/* Stats Bar */}
        {(() => {
          const participantsWithData = dayEntries.filter(e => e.hasData).length
          const totalLanded = dayEntries.reduce((sum, e) => {
            if (!e.hasData) return sum
            return sum + e.pigeons.filter(pg => pg.landingTime).length
          }, 0)
          const stillFlying = Math.max(0, participantsWithData * tournament.pigeonCount - totalLanded)

          return (
            <div className={`bg-surface border border-green-800 rounded-xl p-3 mb-4 grid ${showTotal ? 'grid-cols-2' : 'grid-cols-3'} gap-3 text-center`}>
              <div>
                <p className="text-green-400 text-xs">Total Days</p>
                <p className="text-white font-bold text-xl">{tournament.totalDays}</p>
              </div>
              {showTotal ? (
                <div>
                  <p className="text-green-400 text-xs">Participants</p>
                  <p className="text-white font-bold text-xl">{participants.length}</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-green-400 text-xs">Landed</p>
                    <p className="text-white font-bold text-xl">{totalLanded}</p>
                  </div>
                  <div>
                    <p className="text-green-400 text-xs">Flying</p>
                    <p className="text-green-300 font-bold text-xl">{stillFlying}</p>
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* Winner Pigeon Banner */}
        {!showTotal && mostRecentLanding && (
          <div className="bg-primary border border-secondary rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-2xl shrink-0">🏆</span>
            <div className="min-w-0">
              <p className="text-green-400 text-xs uppercase tracking-widest">Winner Pigeon</p>
              <p className="text-secondary font-bold truncate">{mostRecentLanding.name}</p>
              <p className="text-green-400 text-xs truncate">{mostRecentLanding.area} · {mostRecentLanding.landingTime} · {formatTimeDisplay(mostRecentLanding.hoursFlown)}</p>
            </div>
          </div>
        )}

        {/* Day Selector — horizontally scrollable */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 mb-5">
          <div className="flex gap-2 w-max">
            {tournament.raceDays?.filter(rd => !rd.isGap).map(rd => {
              const isToday = rd.date === today
              const isSelected = !showTotal && rd.dayNumber === selectedDay
              return (
                <button
                  key={rd.dayNumber}
                  onClick={() => { setShowTotal(false); setSelectedDay(rd.dayNumber) }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition text-center min-w-[60px] ${
                    isSelected
                      ? 'bg-secondary text-dark'
                      : 'bg-surface border border-green-800 text-green-400 hover:border-secondary'
                  }`}
                >
                  <span className="block">D{rd.dayNumber}</span>
                  <span className={`block text-xs mt-0.5 ${isSelected ? 'text-dark opacity-70' : isToday ? 'text-secondary' : 'opacity-60'}`}>
                    {rd.date.slice(5)}
                  </span>
                  {isToday && !isSelected && <span className="block text-secondary text-xs">●</span>}
                </button>
              )
            })}

            <button
              onClick={() => setShowTotal(true)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition text-center min-w-[60px] ${
                showTotal
                  ? 'bg-secondary text-dark'
                  : 'bg-surface border border-secondary text-secondary hover:bg-secondary hover:text-dark'
              }`}
            >
              <span className="block">🏆</span>
              <span className="block mt-0.5">Total</span>
            </button>
          </div>
        </div>

        {/* ── TOTAL VIEW ── */}
        {showTotal && (
          loadingEntries ? (
            <p className="text-green-400 text-sm">Loading totals...</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="block md:hidden space-y-3">
                {totalRows.map(row => (
                  <div
                    key={row.participantId}
                    className={`rounded-xl border p-4 ${row.rank === 1 && row.grandTotal ? 'border-secondary bg-yellow-900/20' : 'border-green-800 bg-surface'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-base shrink-0 ${rankStyle(row.rank, !!row.grandTotal)}`}>
                          {rankEmoji(row.rank, !!row.grandTotal)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm truncate">{row.name}</p>
                          <p className="text-green-500 text-xs">{row.area}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {row.grandTotal
                          ? <p className="font-mono font-bold text-secondary">{formatTimeDisplay(row.grandTotal)}</p>
                          : <p className="text-green-800 text-sm">—</p>
                        }
                        <p className="text-green-600 text-xs">
                          {row.daysFlown > 0 ? `${row.daysFlown}/${tournament.totalDays}d` : 'No data'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-surface border border-green-800 rounded-xl overflow-x-auto">
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
                      <tr key={row.participantId} className={`border-b border-green-900 transition ${row.rank === 1 && row.grandTotal ? 'bg-yellow-900/20' : 'hover:bg-primary'}`}>
                        <td className={`px-4 py-3 ${rankStyle(row.rank, !!row.grandTotal)}`}>{rankEmoji(row.rank, !!row.grandTotal)}</td>
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
            </>
          )
        )}

        {/* ── DAY VIEW ── */}
        {!showTotal && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-secondary font-bold text-sm sm:text-base">
                  Day {selectedDay} — {selectedRaceDay?.date}
                </h2>
                {selectedRaceDay?.date === today && (
                  <span className="text-green-400 text-xs">● Live today</span>
                )}
              </div>
              {hasAnyEntries && (
                <p className="text-green-600 text-xs">{dayEntries.filter(e => e.hasData).length} flew</p>
              )}
            </div>

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
              <>
                {/* Mobile cards */}
                <div className="block md:hidden space-y-3">
                  {dayEntries.map(entry => (
                    <div
                      key={entry.participantId}
                      className={`rounded-xl border p-4 ${entry.rank === 1 && entry.hasData ? 'border-secondary bg-yellow-900/20' : 'border-green-800 bg-surface'}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-base shrink-0 ${rankStyle(entry.rank, entry.hasData)}`}>
                            {rankEmoji(entry.rank, entry.hasData)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{entry.name}</p>
                            <p className="text-green-500 text-xs">{entry.area}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {entry.totalHours
                            ? <p className="font-mono font-bold text-secondary">{formatTimeDisplay(entry.totalHours)}</p>
                            : <p className="text-green-800 text-sm">—</p>
                          }
                          {entry.hasData && <p className="text-green-600 text-xs font-mono">Start {entry.startTime}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {entry.pigeons.map((pg, pi) => (
                          <div
                            key={pi}
                            className={`rounded-lg p-2 text-center transition ${
                              pg.landingTime && isRecentLanding(pg.landingTime) ? 'bg-secondary' : 'bg-primary'
                            }`}
                          >
                            <p className={`text-xs mb-0.5 ${pg.landingTime && isRecentLanding(pg.landingTime) ? 'text-dark opacity-70' : 'text-green-500'}`}>
                              🐦{pi + 1}
                            </p>
                            {pg.landingTime ? (
                              <>
                                <p className={`font-mono font-bold text-xs ${pg.landingTime && isRecentLanding(pg.landingTime) ? 'text-dark' : 'text-white'}`}>
                                  {pg.landingTime}
                                </p>
                                <p className={`font-mono text-xs ${pg.landingTime && isRecentLanding(pg.landingTime) ? 'text-dark' : 'text-secondary'}`}>
                                  {formatTimeDisplay(pg.hoursFlown)}
                                </p>
                              </>
                            ) : (
                              <p className="text-green-800 text-xs">—</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block bg-surface border border-green-800 rounded-xl overflow-x-auto">
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
                        <tr key={entry.participantId} className={`border-b border-green-900 transition ${entry.rank === 1 && entry.hasData ? 'bg-yellow-900/20' : 'hover:bg-primary'}`}>
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
                                  <span className={`font-mono text-xs px-1 rounded transition ${isRecentLanding(pg.landingTime) ? 'bg-secondary text-dark font-bold' : 'text-white'}`}>
                                    {pg.landingTime}
                                  </span>
                                  <span className="text-secondary font-mono text-xs font-semibold">{formatTimeDisplay(pg.hoursFlown)}</span>
                                </div>
                              ) : (
                                <span className="text-green-900">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-3 whitespace-nowrap">
                            {entry.totalHours
                              ? <span className="font-mono font-bold text-secondary text-base">{formatTimeDisplay(entry.totalHours)}</span>
                              : <span className="text-green-800">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
