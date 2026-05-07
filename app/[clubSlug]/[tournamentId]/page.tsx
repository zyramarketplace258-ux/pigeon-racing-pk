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
  rank: number; participantId: string; name: string; area: string
  startTime: string; pigeons: PigeonEntry[]; totalHours: string; hasData: boolean
}
interface TotalRow {
  rank: number; participantId: string; name: string; area: string
  daysFlown: number; grandTotal: string
}

const rankCircleStyle = (rank: number, hasData: boolean): React.CSSProperties => {
  if (!hasData) return {}
  if (rank === 1) return { background: 'linear-gradient(145deg,#ffe066,#c8900a)' }
  if (rank === 2) return { background: 'linear-gradient(145deg,#e8e8e8,#8a8a8a)' }
  return { background: '#eee' }
}
const rankCircleText = (rank: number, hasData: boolean) => {
  if (!hasData) return '—'
  return String(rank)
}
const rankCircleColor = (rank: number, hasData: boolean) => {
  if (!hasData) return 'text-[#aaa]'
  if (rank <= 2) return 'text-white'
  return 'text-[#6c757d]'
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

  // Presence tracking
  useEffect(() => {
    if (!club || !tournament) return
    const viewerRef = doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'viewers', sessionId.current)
    setDoc(viewerRef, { lastSeen: serverTimestamp() })
    const heartbeat = setInterval(() => setDoc(viewerRef, { lastSeen: serverTimestamp() }), 30000)
    const unsubscribe = onSnapshot(collection(db, 'clubs', club.id, 'tournaments', tournament.id, 'viewers'), snap => setViewerCount(snap.size))
    return () => { clearInterval(heartbeat); deleteDoc(viewerRef); unsubscribe() }
  }, [club, tournament])

  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  const isRecentLanding = (landingTime: string) => {
    if (!landingTime) return false
    const now = new Date()
    const [h, m] = landingTime.split(':').map(Number)
    const landing = new Date(); landing.setHours(h, m, 0, 0)
    const diff = now.getTime() - landing.getTime()
    return diff >= 0 && diff < 5 * 60 * 1000
  }

  const winnerPigeon = (() => {
    let best: { name: string; area: string; landingTime: string; hoursFlown: string } | null = null
    for (const entry of dayEntries) {
      if (!entry.hasData) continue
      for (const pg of entry.pigeons) {
        if (!pg.landingTime || !pg.hoursFlown) continue
        if (best === null || compareHours(pg.hoursFlown, best.hoursFlown) < 0)
          best = { name: entry.name, area: entry.area, landingTime: pg.landingTime, hoursFlown: pg.hoursFlown }
      }
    }
    return best
  })()

  useEffect(() => {
    if (!club || !tournament || participants.length === 0 || showTotal) return
    setLoadingEntries(true)
    const unsubscribe = onSnapshot(collection(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries'), (snapshot) => {
      const rows: DayEntry[] = participants.map(p => {
        const entryDoc = snapshot.docs.find(d => d.id === `${p.id}_day${selectedDay}`)
        if (entryDoc) {
          const d = entryDoc.data()
          return { rank: 0, participantId: p.id, name: p.name, area: p.area, startTime: d.startTime, pigeons: d.pigeons || [], totalHours: d.totalHours || '', hasData: true }
        }
        return { rank: 0, participantId: p.id, name: p.name, area: p.area, startTime: tournament.defaultStartTime, pigeons: Array.from({ length: tournament.pigeonCount }, () => ({ landingTime: '', hoursFlown: '' })), totalHours: '', hasData: false }
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

  useEffect(() => {
    if (!showTotal || !club || !tournament || participants.length === 0) return
    let active = true; setLoadingEntries(true)
    const load = async () => {
      const rows: TotalRow[] = await Promise.all(participants.map(async (p) => {
        const hours: string[] = []; let daysFlown = 0
        await Promise.all((tournament.raceDays || []).filter(rd => !rd.isGap).map(async (rd) => {
          const snap = await getDoc(doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries', `${p.id}_day${rd.dayNumber}`))
          if (snap.exists() && snap.data().totalHours) { hours.push(snap.data().totalHours); daysFlown++ }
        }))
        return { rank: 0, participantId: p.id, name: p.name, area: p.area, daysFlown, grandTotal: hours.length > 0 ? calculateGrandTotal(hours) : '' }
      }))
      if (!active) return
      const withData = rows.filter(r => r.grandTotal).sort((a, b) => compareHours(a.grandTotal, b.grandTotal))
      const noData = rows.filter(r => !r.grandTotal)
      const sorted = [...withData, ...noData]; sorted.forEach((r, i) => { r.rank = i + 1 })
      setTotalRows(sorted); setLoadingEntries(false)
    }
    load(); return () => { active = false }
  }, [showTotal, club, tournament, participants])

  const shareOnWhatsApp = () => {
    if (!club || !tournament) return
    const lines: string[] = []
    if (showTotal) {
      lines.push(`🏆 Grand Total — ${tournament.name}`)
      lines.push(`📍 ${club.name} · ${club.city}`, '')
      totalRows.filter(r => r.grandTotal).slice(0, 5).forEach((row, i) => {
        lines.push(`${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} ${row.name} — ${formatTimeDisplay(row.grandTotal)}`)
      })
    } else {
      lines.push(`🐦 Day ${selectedDay} Results — ${tournament.name}`)
      lines.push(`📍 ${club.name} · ${club.city}`)
      if (selectedRaceDay?.date) lines.push(`📅 ${selectedRaceDay.date}`)
      lines.push('')
      dayEntries.filter(e => e.hasData && e.totalHours).slice(0, 5).forEach((entry, i) => {
        lines.push(`${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} ${entry.name} — ${formatTimeDisplay(entry.totalHours)}`)
      })
    }
    lines.push('', `🔗 ${window.location.href}`)
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  const today = new Date().toISOString().split('T')[0]
  const selectedRaceDay = tournament?.raceDays?.find(rd => rd.dayNumber === selectedDay)

  if (loading) return (
    <main className="min-h-screen bg-[#e8f5e9] flex items-center justify-center">
      <p className="text-[#388e3c] font-semibold">Loading...</p>
    </main>
  )

  if (!club || !tournament) return (
    <main className="min-h-screen bg-[#e8f5e9] flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-4xl mb-3">🏆</p>
        <p className="text-[#1a1a1a] font-bold">Tournament not found</p>
        <Link href="/" className="text-[#388e3c] text-sm mt-3 inline-block font-semibold">← Home</Link>
      </div>
    </main>
  )

  const participantsWithData = dayEntries.filter(e => e.hasData).length
  const totalLanded = dayEntries.reduce((sum, e) => !e.hasData ? sum : sum + e.pigeons.filter(pg => pg.landingTime).length, 0)
  const stillFlying = Math.max(0, participantsWithData * tournament.pigeonCount - totalLanded)


  return (
    <main className="min-h-screen bg-[#e8f5e9]">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-4 pt-4 pb-3">
        <div className="flex items-start justify-between max-w-6xl mx-auto">
          <div className="min-w-0 flex-1 mr-3">
            <h1 className="text-white text-base sm:text-xl font-bold truncate leading-tight">{tournament.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-green-300 text-xs truncate">{club.name} · {club.city}</p>
              {viewerCount > 1 && <span className="text-green-400 text-xs shrink-0">· 👁 {viewerCount}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <button onClick={shareOnWhatsApp} className="bg-white text-[#1b5e20] text-xs px-2 sm:px-3 py-1.5 rounded font-bold hover:bg-green-50 transition flex items-center gap-1">
              <span>📲</span><span className="hidden sm:inline">Share</span>
            </button>
            <Link href={`/${clubSlug}`} className="text-green-300 hover:text-white text-xs font-medium transition">← Club</Link>
          </div>
        </div>
      </div>
      <nav className="bg-[#292929] px-4">
        <div className="max-w-6xl mx-auto flex items-center h-9">
          <span className="text-white text-sm font-semibold border-b-2 border-[#66bb6a] pb-0.5">Results</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4">

        {/* Stats card */}
        <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
          <div className={`grid ${showTotal ? 'grid-cols-2' : 'grid-cols-3'} divide-x divide-[#e9ecef] text-center`}>
            <div className="py-3 px-2">
              <p className="text-[#999] text-xs uppercase tracking-wide">Total Days</p>
              <p className="text-[#1b5e20] font-bold text-2xl">{tournament.totalDays}</p>
            </div>
            {showTotal ? (
              <div className="py-3 px-2">
                <p className="text-[#999] text-xs uppercase tracking-wide">Participants</p>
                <p className="text-[#1b5e20] font-bold text-2xl">{participants.length}</p>
              </div>
            ) : (
              <>
                <div className="py-3 px-2">
                  <p className="text-[#999] text-xs uppercase tracking-wide">Landed</p>
                  <p className="text-[#1b5e20] font-bold text-2xl">{totalLanded}</p>
                </div>
                <div className="py-3 px-2">
                  <p className="text-[#999] text-xs uppercase tracking-wide">Flying</p>
                  <p className="text-[#388e3c] font-bold text-2xl">{stillFlying}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Winner Pigeon */}
        {!showTotal && winnerPigeon && (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">🏆 Winner Pigeon Today</p>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md" style={{ background: 'linear-gradient(145deg,#ffe066,#c8900a)' }}>1</div>
              <div className="min-w-0">
                <p className="text-[#1a1a1a] font-bold truncate">{winnerPigeon.name}</p>
                <p className="text-[#777] text-xs truncate">{winnerPigeon.area} · landed {winnerPigeon.landingTime} · {formatTimeDisplay(winnerPigeon.hoursFlown)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Day selector */}
        <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex p-2.5 gap-2 w-max">
              {tournament.raceDays?.filter(rd => !rd.isGap).map(rd => {
                const isToday = rd.date === today
                const isSelected = !showTotal && rd.dayNumber === selectedDay
                return (
                  <button
                    key={rd.dayNumber}
                    onClick={() => { setShowTotal(false); setSelectedDay(rd.dayNumber) }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition text-center min-w-[58px] border ${
                      isSelected ? 'bg-[#1b5e20] text-white border-[#1b5e20]'
                        : isToday ? 'bg-white border-[#388e3c] text-[#1b5e20]'
                        : 'bg-white border-[#e9ecef] text-[#555] hover:border-[#388e3c]'
                    }`}
                  >
                    <span className="block font-bold">D{rd.dayNumber}</span>
                    <span className={`block text-xs mt-0.5 ${isSelected ? 'opacity-70' : isToday ? 'text-[#388e3c]' : 'text-[#aaa]'}`}>{rd.date.slice(5)}</span>
                    {isToday && !isSelected && <span className="block text-[#388e3c] text-xs leading-none">●</span>}
                  </button>
                )
              })}
              <button
                onClick={() => setShowTotal(true)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition text-center min-w-[58px] border ${
                  showTotal ? 'bg-[#1b5e20] text-white border-[#1b5e20]' : 'bg-white border-[#388e3c] text-[#1b5e20] hover:bg-[#f1faf2]'
                }`}
              >
                <span className="block">🏆</span>
                <span className="block mt-0.5">Total</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── TOTAL VIEW ── */}
        {showTotal && (
          loadingEntries ? (
            <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm p-8 text-center text-[#999]">Loading totals...</div>
          ) : (
            <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2 flex items-center justify-between">
                <p className="text-green-200 text-xs font-bold uppercase tracking-widest">🏆 Grand Total — All Days</p>
                <p className="text-green-300 text-xs">{totalRows.filter(r => r.grandTotal).length} participants</p>
              </div>
              <div className="divide-y divide-[#e9ecef]">
                {totalRows.map((row, i) => (
                  <div key={row.participantId} className="flex items-center gap-3 px-4 py-3" style={{ background: i === 0 && row.grandTotal ? '#dff0d8' : i % 2 === 1 ? '#f6faf6' : '#fff' }}>
                    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold shadow-sm" style={rankCircleStyle(row.rank, !!row.grandTotal)}>
                      <span className={rankCircleColor(row.rank, !!row.grandTotal)}>{rankCircleText(row.rank, !!row.grandTotal)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1a1a1a] font-semibold text-sm truncate">{row.name}</p>
                      <p className="text-[#777] text-xs">{row.area} · {row.daysFlown > 0 ? `${row.daysFlown}/${tournament.totalDays} days` : 'No data'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {row.grandTotal
                        ? <p className="font-bold text-xl text-[#1a1a1a] leading-none">{formatTimeDisplay(row.grandTotal)}</p>
                        : <p className="text-[#ccc]">—</p>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* ── DAY VIEW ── */}
        {!showTotal && (
          loadingEntries ? (
            <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm p-8 text-center text-[#999]">Loading results...</div>
          ) : (
            <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2 flex items-center justify-between">
                <p className="text-green-200 text-xs font-bold uppercase tracking-widest">
                  Day {selectedDay} — {selectedRaceDay?.date}
                  {selectedRaceDay?.date === today && <span className="ml-2 text-green-300">● Live</span>}
                </p>
                <p className="text-green-300 text-xs">{dayEntries.filter(e => e.hasData).length} flew</p>
              </div>

              <div className="divide-y divide-[#e9ecef]">
                {dayEntries.map((entry, i) => (
                  <div key={entry.participantId} style={{ background: i === 0 && entry.hasData ? '#dff0d8' : i % 2 === 1 ? '#f6faf6' : '#fff' }}>
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      {/* Rank circle */}
                      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold shadow-sm" style={rankCircleStyle(entry.rank, entry.hasData)}>
                        <span className={rankCircleColor(entry.rank, entry.hasData)}>{rankCircleText(entry.rank, entry.hasData)}</span>
                      </div>

                      {/* Name + chips */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-[#1a1a1a] truncate">{entry.name}</p>
                            <p className="text-[#777] text-xs">{entry.area}{entry.hasData ? ` · ${entry.startTime}` : ''}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {entry.totalHours
                              ? <p className="font-bold text-xl text-[#1a1a1a] leading-none">{formatTimeDisplay(entry.totalHours)}</p>
                              : <p className="text-[#ccc] text-sm">—</p>
                            }
                          </div>
                        </div>

                        {/* Pigeon chips */}
                        <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                          {entry.pigeons.map((pg, pi) => {
                            const recent = pg.landingTime && isRecentLanding(pg.landingTime)
                            return (
                              <div
                                key={pi}
                                className="shrink-0 rounded flex flex-col items-center px-1.5 py-1 border"
                                style={{
                                  background: recent ? '#fef08a' : pg.landingTime ? (i === 0 ? '#fff8e1' : '#f0fdf4') : '#fff',
                                  borderColor: recent ? '#f59e0b' : pg.landingTime ? (i === 0 ? '#ffc107' : '#86efac') : '#dee2e6',
                                  borderStyle: pg.landingTime ? 'solid' : 'dashed',
                                }}
                              >
                                <span className="text-[#777] leading-none" style={{ fontSize: '0.6rem' }}>#{pi + 1}</span>
                                <span className="font-mono leading-tight mt-0.5" style={{ fontSize: '0.82rem', color: pg.landingTime ? (i === 0 ? '#664d03' : '#166534') : '#adb5bd' }}>
                                  {pg.landingTime || '—'}
                                </span>
                                {pg.hoursFlown && pg.landingTime && (
                                  <span className="font-mono leading-none mt-0.5" style={{ fontSize: '0.7rem', color: '#888' }}>
                                    {formatTimeDisplay(pg.hoursFlown)}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

      </div>

      <footer className="text-center py-4 text-gray-400 text-xs border-t border-[#d4edda] bg-white mt-4">
        © 2026 Pakistan Pigeon Racing Platform
      </footer>
    </main>
  )
}
