'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { compareHours, formatTimeDisplay, calculateGrandTotal } from '@/lib/timeUtils'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { useT, fDayHeader, fDaysFlown, fDaysShort, fFlewCount, fParticipants, fLandedAt } from '@/lib/translations'

interface Club { id: string; name: string; slug: string; city: string }
interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
interface Tournament {
  id: string; name: string; status: string; totalDays: number
  defaultStartTime: string; pigeonCount: number
  raceDays: RaceDay[]; participantIds?: string[]
}
interface Participant { id: string; name: string; area: string; photoUrl?: string }
interface PigeonEntry { landingTime: string; hoursFlown: string }
interface DayEntry {
  rank: number; participantId: string; name: string; area: string; photoUrl?: string
  startTime: string; pigeons: PigeonEntry[]; totalHours: string; hasData: boolean
}
interface TotalRow {
  rank: number; participantId: string; name: string; area: string; photoUrl?: string
  daysFlown: number; grandTotal: string
  dayTotals: { dayNumber: number; hours: string }[]
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
  const { lang, toggle } = useLanguage()
  const t = useT()

  const [club, setClub] = useState<Club | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [showTotal, setShowTotal] = useState(false)
  const [showDetailResults, setShowDetailResults] = useState(false)
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
      if (tData.status === 'completed') setShowTotal(true)

      const pSnap = await getDocs(collection(db, 'clubs', clubData.id, 'participants'))
      const allParticipants = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]
      const filtered = tData.participantIds != null
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
    const interval = setInterval(() => setTick(tk => tk + 1), 15000)
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
          return { rank: 0, participantId: p.id, name: p.name, area: p.area, photoUrl: p.photoUrl, startTime: d.startTime, pigeons: d.pigeons || [], totalHours: d.totalHours || '', hasData: true }
        }
        return { rank: 0, participantId: p.id, name: p.name, area: p.area, photoUrl: p.photoUrl, startTime: tournament.defaultStartTime, pigeons: Array.from({ length: tournament.pigeonCount }, () => ({ landingTime: '', hoursFlown: '' })), totalHours: '', hasData: false }
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
      const nonGapDays = (tournament.raceDays || []).filter(rd => !rd.isGap)
      const rows: TotalRow[] = await Promise.all(participants.map(async (p) => {
        const dayTotals: { dayNumber: number; hours: string }[] = []
        const hours: string[] = []; let daysFlown = 0
        await Promise.all(nonGapDays.map(async (rd) => {
          const snap = await getDoc(doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries', `${p.id}_day${rd.dayNumber}`))
          const h = snap.exists() ? snap.data().totalHours : ''
          dayTotals.push({ dayNumber: rd.dayNumber, hours: h || '' })
          if (h) { hours.push(h); daysFlown++ }
        }))
        dayTotals.sort((a, b) => a.dayNumber - b.dayNumber)
        return { rank: 0, participantId: p.id, name: p.name, area: p.area, photoUrl: p.photoUrl, daysFlown, grandTotal: hours.length > 0 ? calculateGrandTotal(hours) : '', dayTotals }
      }))
      if (!active) return
      const withData = rows.filter(r => r.grandTotal).sort((a, b) => compareHours(a.grandTotal, b.grandTotal))
      const noData = rows.filter(r => !r.grandTotal)
      const sorted = [...withData, ...noData]; sorted.forEach((r, i) => { r.rank = i + 1 })
      setTotalRows(sorted); setLoadingEntries(false)
    }
    load(); return () => { active = false }
  }, [showTotal, club, tournament, participants])

  const today = new Date().toISOString().split('T')[0]
  const selectedRaceDay = tournament?.raceDays?.find(rd => rd.dayNumber === selectedDay)
  const isUrdu = lang === 'ur'

  if (loading) return (
    <main className={`min-h-screen bg-[#e8f5e9] flex items-center justify-center ${isUrdu ? 'font-urdu' : ''}`}>
      <p className="text-[#388e3c] font-semibold">{t('loading')}</p>
    </main>
  )

  if (!club || !tournament) return (
    <main className={`min-h-screen bg-[#e8f5e9] flex items-center justify-center ${isUrdu ? 'font-urdu' : ''}`}>
      <div className="text-center px-4">
        <p className="text-4xl mb-3">🏆</p>
        <p className="text-[#1a1a1a] font-bold">{t('tournamentNotFound')}</p>
        <Link href="/" className="text-[#388e3c] text-sm mt-3 inline-block font-semibold">{isUrdu ? 'ہوم →' : '← Home'}</Link>
      </div>
    </main>
  )

  const totalLanded = dayEntries.reduce((sum, e) => !e.hasData ? sum : sum + e.pigeons.filter(pg => pg.landingTime).length, 0)
  const stillFlying = Math.max(0, participants.length * tournament.pigeonCount - totalLanded)

  return (
    <main className={`min-h-screen bg-[#e8f5e9] ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>

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
          <div className="flex items-center gap-3 shrink-0 mt-0.5">
            <Link href={`/${clubSlug}`} className="text-green-300 hover:text-white text-xs font-medium transition">{t('clubBack')}</Link>
            <Link href="/" className="text-green-300 hover:text-white text-xs font-medium transition">{t('home')}</Link>
          </div>
        </div>
      </div>
      <nav className="bg-[#292929] px-4">
        <div className="max-w-6xl mx-auto flex items-center h-9">
          <span className="text-white text-sm font-semibold border-b-2 border-[#66bb6a] pb-0.5">{t('results')}</span>
          <button onClick={toggle} className="ms-auto text-xs text-green-300 border border-green-700 px-2.5 py-1 rounded hover:bg-green-800 transition font-medium">
            {isUrdu ? 'EN' : 'اردو'}
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4">

        {/* WINNERS PODIUM (completed tournaments) */}
        {tournament.status === 'completed' && !showDetailResults && (
          <>
            {loadingEntries ? (
              <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm p-10 text-center text-[#999]">{t('loadingResults')}</div>
            ) : (
              <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-3 text-center">
                  <p className="text-green-200 text-xs font-bold uppercase tracking-widest mb-0.5">{t('tournamentComplete')}</p>
                  <h2 className="text-white font-bold text-lg">{tournament.name}</h2>
                </div>

                <div className="px-4 pt-6 pb-4">
                  {totalRows[0]?.grandTotal && (
                    <div className="flex flex-col items-center mb-5">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg mb-2" style={{ background: 'linear-gradient(145deg,#ffe066,#c8900a)' }}>1</div>
                      <p className="text-[#1a1a1a] font-bold text-lg leading-tight text-center">{totalRows[0].name}</p>
                      <p className="text-[#777] text-xs text-center mb-1">{totalRows[0].area}</p>
                      <p className="text-[#1b5e20] font-extrabold text-3xl">{formatTimeDisplay(totalRows[0].grandTotal)}</p>
                      <p className="text-[#999] text-xs">{fDaysFlown(lang, totalRows[0].daysFlown)}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[totalRows[1], totalRows[2]].map((row, i) => row?.grandTotal ? (
                      <div key={row.participantId} className="rounded-xl border border-[#e9ecef] p-3 text-center bg-[#fafafa]">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow mx-auto mb-1.5"
                          style={{ background: i === 0 ? 'linear-gradient(145deg,#e8e8e8,#8a8a8a)' : '#cd7f32' }}>
                          {i + 2}
                        </div>
                        <p className="text-[#1a1a1a] font-bold text-sm truncate">{row.name}</p>
                        <p className="text-[#777] text-xs truncate mb-1">{row.area}</p>
                        <p className="text-[#1b5e20] font-bold text-lg">{formatTimeDisplay(row.grandTotal)}</p>
                        <p className="text-[#999] text-xs">{fDaysShort(lang, row.daysFlown)}</p>
                      </div>
                    ) : <div key={i} />)}
                  </div>

                  <button
                    onClick={() => setShowDetailResults(true)}
                    className="w-full py-3 rounded-xl bg-[#1b5e20] hover:bg-[#2e7d32] text-white font-bold text-sm transition"
                  >
                    {t('openDetailResults')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* DETAIL RESULTS */}
        {(tournament.status !== 'completed' || showDetailResults) && (<>

        {/* Stats card */}
        <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
          <div className={`grid ${showTotal ? 'grid-cols-2' : 'grid-cols-3'} divide-x divide-[#e9ecef] text-center`}>
            <div className="py-3 px-2">
              <p className="text-[#999] text-xs uppercase tracking-wide">{t('totalDays')}</p>
              <p className="text-[#1b5e20] font-bold text-2xl">{tournament.totalDays}</p>
            </div>
            {showTotal ? (
              <div className="py-3 px-2">
                <p className="text-[#999] text-xs uppercase tracking-wide">{t('participantsStat')}</p>
                <p className="text-[#1b5e20] font-bold text-2xl">{participants.length}</p>
              </div>
            ) : (
              <>
                <div className="py-3 px-2">
                  <p className="text-[#999] text-xs uppercase tracking-wide">{t('landedStat')}</p>
                  <p className="text-[#1b5e20] font-bold text-2xl">{totalLanded}</p>
                </div>
                <div className="py-3 px-2">
                  <p className="text-[#999] text-xs uppercase tracking-wide">{t('flyingStat')}</p>
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
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('winnerPigeonToday')}</p>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md" style={{ background: 'linear-gradient(145deg,#ffe066,#c8900a)' }}>1</div>
              <div className="min-w-0">
                <p className="text-[#1a1a1a] font-bold truncate">{winnerPigeon.name}</p>
                <p className="text-[#777] text-xs truncate">{winnerPigeon.area} · {fLandedAt(lang, winnerPigeon.landingTime, formatTimeDisplay(winnerPigeon.hoursFlown))}</p>
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
                    <span className="block font-bold" dir="ltr">D{tournament.raceDays.filter(r => !r.isGap && r.dayNumber <= rd.dayNumber).length}</span>
                    <span className={`block text-xs mt-0.5 ${isSelected ? 'opacity-70' : isToday ? 'text-[#388e3c]' : 'text-[#aaa]'}`} dir="ltr">{rd.date.slice(5)}</span>
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
                <span className="block mt-0.5">{t('total')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* TOTAL VIEW */}
        {showTotal && (
          loadingEntries ? (
            <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm p-8 text-center text-[#999]">{t('loadingTotals')}</div>
          ) : (
            <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2 flex items-center justify-between">
                <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('grandTotal')}</p>
                <p className="text-green-300 text-xs">{fParticipants(lang, totalRows.filter(r => r.grandTotal).length)}</p>
              </div>
              <div className="divide-y divide-[#e9ecef]">
                {totalRows.map((row, i) => (
                  <div key={row.participantId} className="px-3 py-3" style={{ background: i === 0 && row.grandTotal ? '#dff0d8' : i % 2 === 1 ? '#f6faf6' : '#fff' }}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="relative shrink-0">
                        {row.photoUrl
                          ? <img src={row.photoUrl} alt={row.name} className="w-9 h-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: row.rank === 1 ? '#c8900a' : row.rank === 2 ? '#8a8a8a' : '#e9ecef' }} />
                          : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm" style={rankCircleStyle(row.rank, !!row.grandTotal)}>
                              <span className={rankCircleColor(row.rank, !!row.grandTotal)}>{rankCircleText(row.rank, !!row.grandTotal)}</span>
                            </div>
                        }
                        {row.photoUrl && row.grandTotal && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center shadow" style={rankCircleStyle(row.rank, !!row.grandTotal)}>
                            <span className={`${rankCircleColor(row.rank, !!row.grandTotal)} leading-none`} style={{ fontSize: '0.55rem' }}>{row.rank}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1a1a1a] font-semibold text-sm truncate">{row.name}</p>
                        <p className="text-[#777] text-xs">{row.area}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {row.grandTotal
                          ? <p className="font-bold text-xl text-[#1b5e20] leading-none" dir="ltr">{formatTimeDisplay(row.grandTotal)}</p>
                          : <p className="text-[#ccc] text-sm">—</p>
                        }
                        <p className="text-[#999] text-xs text-right">{row.daysFlown > 0 ? fDaysShort(lang, row.daysFlown) : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto ms-11 pb-0.5" style={{ scrollbarWidth: 'none' }}>
                      {row.dayTotals.map(dt => (
                        <div key={dt.dayNumber} className="shrink-0 rounded border px-1.5 py-1 text-center"
                          style={{ background: dt.hours ? '#f0fdf4' : '#fafafa', borderColor: dt.hours ? '#86efac' : '#e9ecef', borderStyle: dt.hours ? 'solid' : 'dashed' }}>
                          <span className="block text-[#999] leading-none" style={{ fontSize: '0.6rem' }} dir="ltr">D{tournament.raceDays.filter(r => !r.isGap && r.dayNumber <= dt.dayNumber).length}</span>
                          <span className="block font-mono leading-tight mt-0.5" style={{ fontSize: '0.78rem', color: dt.hours ? '#166534' : '#ccc' }} dir="ltr">
                            {dt.hours ? formatTimeDisplay(dt.hours) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* DAY VIEW */}
        {!showTotal && (
          loadingEntries ? (
            <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm p-8 text-center text-[#999]">{t('loadingResults')}</div>
          ) : (
            <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2 flex items-center justify-between">
                <p className="text-green-200 text-xs font-bold uppercase tracking-widest">
                  {fDayHeader(lang, selectedDay, selectedRaceDay?.date ?? '')}
                  {selectedRaceDay?.date === today && <span className="ms-2 text-green-300">{t('live')}</span>}
                </p>
                <p className="text-green-300 text-xs">{fFlewCount(lang, dayEntries.filter(e => e.hasData).length)}</p>
              </div>

              <div className="divide-y divide-[#e9ecef]">
                {dayEntries.map((entry, i) => (
                  <div key={entry.participantId} style={{ background: i === 0 && entry.hasData ? '#dff0d8' : i % 2 === 1 ? '#f6faf6' : '#fff' }}>
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <div className="relative shrink-0">
                        {entry.photoUrl
                          ? <img src={entry.photoUrl} alt={entry.name} className="w-9 h-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: entry.rank === 1 ? '#c8900a' : entry.rank === 2 ? '#8a8a8a' : '#e9ecef' }} />
                          : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm" style={rankCircleStyle(entry.rank, entry.hasData)}>
                              <span className={rankCircleColor(entry.rank, entry.hasData)}>{rankCircleText(entry.rank, entry.hasData)}</span>
                            </div>
                        }
                        {entry.photoUrl && entry.hasData && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold shadow" style={rankCircleStyle(entry.rank, entry.hasData)}>
                            <span className={`${rankCircleColor(entry.rank, entry.hasData)} text-xs leading-none`} style={{ fontSize: '0.55rem' }}>{entry.rank}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-[#1a1a1a] truncate">{entry.name}</p>
                            <p className="text-[#777] text-xs">{entry.area}{entry.hasData ? ` · ${entry.startTime}` : ''}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {entry.totalHours
                              ? <p className="font-bold text-xl text-[#1a1a1a] leading-none" dir="ltr">{formatTimeDisplay(entry.totalHours)}</p>
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
                                <span className="text-[#777] leading-none" style={{ fontSize: '0.6rem' }} dir="ltr">#{pi + 1}</span>
                                <span className="font-mono leading-tight mt-0.5" style={{ fontSize: '0.82rem', color: pg.landingTime ? (i === 0 ? '#664d03' : '#166534') : '#adb5bd' }} dir="ltr">
                                  {pg.landingTime || '—'}
                                </span>
                                {pg.hoursFlown && pg.landingTime && (
                                  <span className="font-mono leading-none mt-0.5" style={{ fontSize: '0.7rem', color: '#888' }} dir="ltr">
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

        </>)}

      </div>

      <footer className="text-center py-4 text-gray-400 text-xs border-t border-[#d4edda] bg-white mt-4">
        {t('footer')}
      </footer>
    </main>
  )
}
