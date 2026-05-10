'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { compareHours, formatTimeDisplay, calculateGrandTotal } from '@/lib/timeUtils'
import { getPKTDate } from '@/lib/pkt'
import SiteHeader from './SiteHeader'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { useT, fDayHeader, fDaysFlown, fDaysShort, fFlewCount, fParticipants, fLandedAt } from '@/lib/translations'

export interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
export interface Tournament {
  id: string; name: string; nameUrdu?: string; status: string; totalDays: number
  defaultStartTime: string; defaultEndTime?: string; pigeonCount: number
  raceDays: RaceDay[]; participantIds?: string[]
}
export interface Participant { id: string; name: string; nameUrdu?: string; area: string; areaUrdu?: string; photoUrl?: string }
export interface EntryDoc {
  id: string; startTime: string; totalHours: string
  pigeons: { landingTime: string; hoursFlown: string }[]
}

interface DayEntry {
  rank: number; participantId: string; name: string; nameUrdu?: string; area: string; areaUrdu?: string; photoUrl?: string
  startTime: string; pigeons: { landingTime: string; hoursFlown: string }[]; totalHours: string; hasData: boolean
}
interface TotalRow {
  rank: number; participantId: string; name: string; nameUrdu?: string; area: string; areaUrdu?: string; photoUrl?: string
  daysFlown: number; grandTotal: string
  dayTotals: { dayNumber: number; hours: string }[]
}

export interface TournamentInitialData {
  club: { id: string; name: string; nameUrdu?: string; slug: string; city: string; cityUrdu?: string } | null
  tournament: Tournament | null
  participants: Participant[]
  allEntryDocs: EntryDoc[]
  defaultDay: number
  notFound: boolean
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

function getCutoffCountdown(endTime: string): string | null {
  if (!endTime) return null
  const now = new Date()
  const pktMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 300) % 1440
  const [h, m] = endTime.split(':').map(Number)
  const diff = (h * 60 + m) - pktMinutes
  if (diff <= 0) return null
  const hrs = Math.floor(diff / 60), mins = diff % 60
  return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`
}

function buildDayEntries(
  allDocs: EntryDoc[],
  participants: Participant[],
  selectedDay: number,
  tournament: Tournament
): DayEntry[] {
  const docMap = new Map(allDocs.map(d => [d.id, d]))
  const rows: DayEntry[] = participants.map(p => {
    const ed = docMap.get(`${p.id}_day${selectedDay}`)
    if (ed) {
      return { rank: 0, participantId: p.id, name: p.name, nameUrdu: p.nameUrdu, area: p.area, areaUrdu: p.areaUrdu, photoUrl: p.photoUrl, startTime: ed.startTime || '', pigeons: ed.pigeons || [], totalHours: ed.totalHours || '', hasData: true }
    }
    return { rank: 0, participantId: p.id, name: p.name, nameUrdu: p.nameUrdu, area: p.area, areaUrdu: p.areaUrdu, photoUrl: p.photoUrl, startTime: tournament.defaultStartTime, pigeons: Array.from({ length: tournament.pigeonCount }, () => ({ landingTime: '', hoursFlown: '' })), totalHours: '', hasData: false }
  })
  const withData = rows.filter(r => r.hasData && r.totalHours).sort((a, b) => compareHours(a.totalHours, b.totalHours))
  const noData = rows.filter(r => !r.hasData || !r.totalHours)
  const sorted = [...withData, ...noData]
  sorted.forEach((r, i) => { r.rank = i + 1 })
  return sorted
}

function buildTotalRows(
  allDocs: EntryDoc[],
  participants: Participant[],
  tournament: Tournament
): TotalRow[] {
  const nonGapDays = (tournament.raceDays || []).filter(rd => !rd.isGap)
  const docMap = new Map(allDocs.map(d => [d.id, d]))
  const rows: TotalRow[] = participants.map(p => {
    const dayTotals: { dayNumber: number; hours: string }[] = []
    const hours: string[] = []
    let daysFlown = 0
    for (const rd of nonGapDays) {
      const ed = docMap.get(`${p.id}_day${rd.dayNumber}`)
      const h = ed?.totalHours || ''
      dayTotals.push({ dayNumber: rd.dayNumber, hours: h })
      if (h) { hours.push(h); daysFlown++ }
    }
    dayTotals.sort((a, b) => a.dayNumber - b.dayNumber)
    return { rank: 0, participantId: p.id, name: p.name, nameUrdu: p.nameUrdu, area: p.area, areaUrdu: p.areaUrdu, photoUrl: p.photoUrl, daysFlown, grandTotal: hours.length > 0 ? calculateGrandTotal(hours) : '', dayTotals }
  })
  const withData = rows.filter(r => r.grandTotal).sort((a, b) => compareHours(a.grandTotal, b.grandTotal))
  const noData = rows.filter(r => !r.grandTotal)
  const sorted = [...withData, ...noData]
  sorted.forEach((r, i) => { r.rank = i + 1 })
  return sorted
}

export default function TournamentClient({
  initialData,
  clubSlug,
}: {
  initialData: TournamentInitialData
  clubSlug: string
}) {
  const { lang, toggle } = useLanguage()
  const t = useT()

  const club = initialData.club
  const tournament = initialData.tournament
  const participants = initialData.participants

  const todayDate = getPKTDate()
  const nonGapRaceDays = tournament?.raceDays?.filter(rd => !rd.isGap) ?? []
  const allDaysPast = nonGapRaceDays.length > 0 && nonGapRaceDays.every(rd => rd.date < todayDate)

  const [allEntryDocs, setAllEntryDocs] = useState<EntryDoc[]>(initialData.allEntryDocs)
  const [selectedDay, setSelectedDay] = useState<number>(initialData.defaultDay)
  const [showTotal, setShowTotal] = useState(tournament?.status === 'completed' || allDaysPast)
  const [showDetailResults, setShowDetailResults] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [blinkingChips, setBlinkingChips] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [cutoffCountdown, setCutoffCountdown] = useState<string | null>(null)
  const prevPigeonsRef = useRef<Map<string, string>>(new Map())
  const sessionId = useRef(Math.random().toString(36).slice(2, 10))

  const dayEntries = useMemo(() => {
    if (!tournament || participants.length === 0) return []
    return buildDayEntries(allEntryDocs, participants, selectedDay, tournament)
  }, [allEntryDocs, participants, selectedDay, tournament])

  const totalRows = useMemo(() => {
    if (!tournament || participants.length === 0) return []
    return buildTotalRows(allEntryDocs, participants, tournament)
  }, [allEntryDocs, participants, tournament])

  const winnerPigeon = useMemo(() => {
    let best: { name: string; nameUrdu?: string; area: string; areaUrdu?: string; landingTime: string; hoursFlown: string } | null = null
    for (const entry of dayEntries) {
      if (!entry.hasData) continue
      for (const pg of entry.pigeons) {
        if (!pg.landingTime || !pg.hoursFlown) continue
        if (best === null || compareHours(pg.hoursFlown, best.hoursFlown) < 0)
          best = { name: entry.name, nameUrdu: entry.nameUrdu, area: entry.area, areaUrdu: entry.areaUrdu, landingTime: pg.landingTime, hoursFlown: pg.hoursFlown }
      }
    }
    return best
  }, [dayEntries])

  // Cutoff countdown
  useEffect(() => {
    if (!tournament?.defaultEndTime) return
    const update = () => setCutoffCountdown(getCutoffCountdown(tournament.defaultEndTime!))
    update()
    const iv = setInterval(update, 60000)
    return () => clearInterval(iv)
  }, [tournament?.defaultEndTime])

  // Real-time entries listener with blink detection
  useEffect(() => {
    if (!club || !tournament) return
    let isFirst = true
    prevPigeonsRef.current.clear()
    const unsub = onSnapshot(
      collection(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries'),
      snapshot => {
        const newBlinks = new Set<string>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries = snapshot.docs.map(d => {
          const data = d.data()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pigeons = (data.pigeons || []).map((pg: any, idx: number) => {
            const key = `${d.id}_${idx}`
            const curr = String(pg.landingTime || '')
            if (!isFirst) {
              const prev = prevPigeonsRef.current.get(key) ?? ''
              if (curr && curr !== prev) newBlinks.add(key)
            }
            prevPigeonsRef.current.set(key, curr)
            return { landingTime: curr, hoursFlown: String(pg.hoursFlown || '') }
          })
          return { id: d.id, startTime: String(data.startTime || ''), totalHours: String(data.totalHours || ''), pigeons }
        })
        isFirst = false
        setAllEntryDocs(entries)
        if (newBlinks.size > 0) {
          setBlinkingChips(prev => { const n = new Set(Array.from(prev)); newBlinks.forEach(k => n.add(k)); return n })
          setTimeout(() => setBlinkingChips(prev => { const n = new Set(Array.from(prev)); newBlinks.forEach(k => n.delete(k)); return n }), 90000)
        }
      }
    )
    return () => unsub()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.id, tournament?.id])

  // Presence tracking
  useEffect(() => {
    if (!club || !tournament) return
    const viewerRef = doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'viewers', sessionId.current)
    setDoc(viewerRef, { lastSeen: serverTimestamp() })
    const heartbeat = setInterval(() => setDoc(viewerRef, { lastSeen: serverTimestamp() }), 30000)
    const unsubscribe = onSnapshot(collection(db, 'clubs', club.id, 'tournaments', tournament.id, 'viewers'), snap => setViewerCount(snap.size))
    return () => { clearInterval(heartbeat); deleteDoc(viewerRef); unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.id, tournament?.id])



  const today = todayDate
  const selectedRaceDay = tournament?.raceDays?.find(rd => rd.dayNumber === selectedDay)
  const selectedDisplayDay = tournament?.raceDays
    ? tournament.raceDays.filter(r => !r.isGap && r.dayNumber <= selectedDay).length
    : selectedDay
  const selectedDateLabel = selectedRaceDay?.date
    ? new Date(selectedRaceDay.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  const isUrdu = lang === 'ur'

  if (initialData.notFound || !club || !tournament) return (
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

      <SiteHeader />
      <nav className="bg-[#292929] px-4">
        <div className="max-w-6xl mx-auto flex items-center h-9 gap-2">
          <Link href={`/${clubSlug}`} className="text-green-300 hover:text-white text-xs font-medium transition shrink-0">{t('clubBack')}</Link>
          <span className="text-green-700 shrink-0">›</span>
          <span className="text-white text-sm font-semibold border-b-2 border-[#66bb6a] pb-0.5 shrink-0">{t('results')}</span>
          {viewerCount > 1 && <span className="text-green-600 text-xs shrink-0">· 👁 {viewerCount}</span>}
          <button onClick={toggle} className="ms-auto text-xs text-green-300 border border-green-700 px-2.5 py-1 rounded hover:bg-green-800 transition font-medium shrink-0">
            {isUrdu ? 'EN' : 'اردو'}
          </button>
        </div>
      </nav>

      {/* Club identity strip */}
      <div className="bg-white border-b border-[#d4edda] px-4 py-2">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#1b5e20] text-sm font-semibold truncate">{club.nameUrdu || club.name}<span className="text-[#888] font-normal"> · {club.cityUrdu || club.city}</span></p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4">

        {/* WINNERS PODIUM (completed tournaments) */}
        {tournament.status === 'completed' && !showDetailResults && (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-3 text-center">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest mb-0.5">{t('tournamentComplete')}</p>
              <h2 className="text-white font-bold text-lg">{tournament.nameUrdu || tournament.name}</h2>
            </div>

            <div className="px-4 pt-6 pb-4">
              {totalRows[0]?.grandTotal && (
                <div className="flex flex-col items-center mb-5">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg mb-2" style={{ background: 'linear-gradient(145deg,#ffe066,#c8900a)' }}>1</div>
                  <p className="text-[#1a1a1a] font-bold text-lg leading-tight text-center">{totalRows[0].nameUrdu || totalRows[0].name}{(totalRows[0].areaUrdu || totalRows[0].area) ? <span className="font-normal text-[#777] text-sm"> · {totalRows[0].areaUrdu || totalRows[0].area}</span> : ''}</p>
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
                    <p className="text-[#1a1a1a] font-bold text-sm truncate">{row.nameUrdu || row.name}{(row.areaUrdu || row.area) ? <span className="font-normal text-[#777]"> · {row.areaUrdu || row.area}</span> : ''}</p>
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

        {/* DETAIL RESULTS */}
        {(tournament.status !== 'completed' || showDetailResults) && (<>

        {/* Tournament name + LIVE + info + share */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h1 className="text-[#1b5e20] font-bold text-xl sm:text-2xl leading-tight">{tournament.nameUrdu || tournament.name}</h1>
            {selectedRaceDay?.date === today && (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full border border-green-300">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center justify-center mt-1">
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="text-xs text-[#888] hover:text-[#1b5e20] transition"
            >
              {copied ? '✓ Copied!' : '🔗 Share'}
            </button>
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
                <p className="text-[#1a1a1a] font-bold truncate">{winnerPigeon.nameUrdu || winnerPigeon.name}{(winnerPigeon.areaUrdu || winnerPigeon.area) ? <span className="font-normal text-[#777] text-sm"> · {winnerPigeon.areaUrdu || winnerPigeon.area}</span> : ''} <span className="font-normal text-[#777] text-xs">· {fLandedAt(lang, winnerPigeon.landingTime, formatTimeDisplay(winnerPigeon.hoursFlown))}</span></p>
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
                    <span className="block font-bold text-[11px]" dir="ltr">Day {tournament.raceDays.filter(r => !r.isGap && r.dayNumber <= rd.dayNumber).length}</span>
                    <span className={`block text-[10px] mt-0.5 ${isSelected ? 'opacity-70' : isToday ? 'text-[#388e3c]' : 'text-[#aaa]'}`} dir="ltr">{new Date(rd.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
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
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2 flex items-center justify-between">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('grandTotal')}</p>
              <p className="text-green-300 text-xs">{fParticipants(lang, totalRows.filter(r => r.grandTotal).length)}</p>
            </div>
            <div className="divide-y divide-[#e9ecef]">
              {totalRows.map((row, i) => (
                <div key={row.participantId} className="px-3 py-3" style={{ background: row.grandTotal && row.rank === 1 ? '#fffde7' : row.grandTotal && row.rank === 2 ? '#f5f5f5' : row.grandTotal && row.rank === 3 ? '#fff3e0' : i % 2 === 1 ? '#f6faf6' : '#fff' }}>
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
                      <p className="text-[#1a1a1a] font-semibold text-sm truncate">{row.nameUrdu || row.name}{(row.areaUrdu || row.area) ? <span className="font-normal text-[#777]"> · {row.areaUrdu || row.area}</span> : ''}</p>
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
        )}

        {/* DAY VIEW */}
        {!showTotal && (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2 flex items-center justify-between">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">
                {fDayHeader(lang, selectedDisplayDay, selectedDateLabel)}
                {selectedRaceDay?.date === today && <span className="ms-2 text-green-300">{t('live')}</span>}
              </p>
              <p className="text-green-300 text-xs">{fFlewCount(lang, dayEntries.filter(e => e.hasData).length)}</p>
            </div>

            {/* Progress bar row */}
            <div className="px-4 py-2 bg-[#f8fdf8] border-b border-[#d4edda] flex items-center gap-2">
              <span className="text-xs text-[#666] shrink-0" dir="ltr">
                {tournament.defaultStartTime}{tournament.defaultEndTime ? ` → ${tournament.defaultEndTime}` : ''}
              </span>
              {cutoffCountdown && selectedRaceDay?.date === today && (
                <span className="text-orange-600 text-xs font-semibold shrink-0">⏱ {cutoffCountdown}</span>
              )}
              <div className="flex-1 bg-[#d4edda] rounded-full h-2 overflow-hidden">
                <div className="bg-[#388e3c] h-2 rounded-full transition-all duration-500"
                  style={{ width: totalLanded + stillFlying > 0 ? `${(totalLanded / (totalLanded + stillFlying)) * 100}%` : '0%' }} />
              </div>
              <span className="text-xs text-[#555] shrink-0">{totalLanded}/{totalLanded + stillFlying}</span>
            </div>

            <div className="divide-y divide-[#e9ecef]">
              {dayEntries.map((entry, i) => {
                const rowBg = entry.hasData && entry.rank === 1 ? '#fffde7'
                  : entry.hasData && entry.rank === 2 ? '#f5f5f5'
                  : entry.hasData && entry.rank === 3 ? '#fff3e0'
                  : i % 2 === 1 ? '#f6faf6' : '#fff'
                return (
                <div key={entry.participantId} style={{ background: rowBg }}>
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <div className="relative shrink-0">
                      {entry.photoUrl
                        ? <img src={entry.photoUrl} alt={entry.name} className="w-9 h-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: entry.rank === 1 ? '#c8900a' : entry.rank === 2 ? '#8a8a8a' : entry.rank === 3 ? '#cd7f32' : '#e9ecef' }} />
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
                          <p className="font-semibold text-sm text-[#1a1a1a] truncate">{entry.nameUrdu || entry.name}{(entry.areaUrdu || entry.area) ? <span className="font-normal text-[#777]"> · {entry.areaUrdu || entry.area}</span> : ''}{entry.hasData ? <span className="font-normal text-[#777]"> · {entry.startTime}</span> : ''}</p>
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
                          const chipKey = `${entry.participantId}_day${selectedDay}_${pi}`
                          const isBlinking = blinkingChips.has(chipKey)
                          const isWinner = entry.hasData && entry.rank === 1
                          return (
                            <div
                              key={pi}
                              className={`shrink-0 rounded flex flex-col items-center px-1.5 py-1 border transition-all ${isBlinking ? 'animate-pulse ring-2 ring-green-400' : ''}`}
                              style={{
                                background: pg.landingTime ? (isWinner ? '#fff8e1' : '#f0fdf4') : '#fff',
                                borderColor: pg.landingTime ? (isWinner ? '#ffc107' : '#86efac') : '#dee2e6',
                                borderStyle: pg.landingTime ? 'solid' : 'dashed',
                              }}
                            >
                              <span className="text-[#777] leading-none" style={{ fontSize: '0.6rem' }} dir="ltr">#{pi + 1}</span>
                              <span className="font-mono leading-tight mt-0.5" style={{ fontSize: '0.82rem', color: pg.landingTime ? (isWinner ? '#664d03' : '#166534') : '#adb5bd' }} dir="ltr">
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
                )
              })}
            </div>
          </div>
        )}

        </>)}

      </div>

      <footer className="text-center py-4 text-gray-400 text-xs border-t border-[#d4edda] bg-white mt-4">
        {t('footer')}
      </footer>
    </main>
  )
}
