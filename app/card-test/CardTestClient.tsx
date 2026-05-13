'use client'
import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface Club { id: string; name: string; nameUrdu?: string }
interface Tournament { id: string; name: string; nameUrdu?: string; pigeonCount: number; raceDays: { dayNumber: number; date: string }[] }
interface Participant { id: string; name: string; nameUrdu?: string; area: string; areaUrdu?: string; photoUrl?: string }
interface EntryData { totalHours: string; pigeons: { landingTime: string; hoursFlown: string }[] }

export default function CardTestClient() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])

  const [clubId, setClubId] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [day, setDay] = useState(1)

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [entryData, setEntryData] = useState<EntryData | null>(null)
  const [rank, setRank] = useState(1)

  const [loading, setLoading] = useState(false)
  const [cardReady, setCardReady] = useState(false)

  useEffect(() => {
    getDocs(collection(db, 'clubs')).then(snap => {
      setClubs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Club)))
    })
  }, [])

  useEffect(() => {
    if (!clubId) return
    setTournamentId(''); setParticipantId(''); setCardReady(false)
    getDocs(query(collection(db, 'clubs', clubId, 'tournaments'), orderBy('createdAt', 'desc'))).then(snap => {
      setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)))
    })
  }, [clubId])

  useEffect(() => {
    if (!clubId || !tournamentId) return
    setParticipantId(''); setCardReady(false)
    const t = tournaments.find(t => t.id === tournamentId) || null
    setSelectedTournament(t)
    setDay(t?.raceDays?.[0]?.dayNumber || 1)
    getDocs(collection(db, 'clubs', clubId, 'participants')).then(snap => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)))
    })
  }, [tournamentId])

  const generate = async () => {
    if (!clubId || !tournamentId || !participantId) return
    setLoading(true); setCardReady(false)

    const p = participants.find(p => p.id === participantId)
    setSelectedParticipant(p || null)

    const t = selectedTournament
    const dayObj = t?.raceDays?.find(r => r.dayNumber === day)
    const suffix = dayObj ? `_day${day}` : ''

    const entrySnap = await getDocs(collection(db, 'clubs', clubId, 'tournaments', tournamentId, 'entries'))
    const entryDoc = entrySnap.docs.find(d => d.id === `${participantId}${suffix}`)
    const data = entryDoc?.data() as EntryData | undefined

    if (data) {
      setEntryData(data)
      const allEntries = entrySnap.docs
        .filter(d => suffix ? d.id.endsWith(suffix) : !d.id.includes('_day'))
        .map(d => d.data().totalHours as string)
        .filter(Boolean)
        .sort()
      setRank(allEntries.indexOf(data.totalHours) + 1 || 1)
    } else {
      setEntryData(null); setRank(1)
    }

    setLoading(false); setCardReady(true)
  }

  const participant = selectedParticipant
  const t = selectedTournament
  const club = clubs.find(c => c.id === clubId)
  const dayObj = t?.raceDays?.find(r => r.dayNumber === day)

  const cardParams = new URLSearchParams({
    tournament: t?.name || t?.nameUrdu || '',
    club: club?.name || club?.nameUrdu || '',
    player: participant?.name || '',
    playerUrdu: participant?.nameUrdu || '',
    area: participant?.area || '',
    areaUrdu: participant?.areaUrdu || '',
    photoUrl: participant?.photoUrl || '',
    date: dayObj?.date || '',
    day: String(day),
    totalDays: String(t?.raceDays?.length || 1),
    rank: String(rank),
    score: entryData?.totalHours || '',
    times: (entryData?.pigeons || []).map(p => p.landingTime || '').join(','),
  })
  const cardUrl = `/api/card?${cardParams}`

  const download = async () => {
    const res = await fetch(cardUrl)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `card-${participant?.name}-day${day}.png`
    a.click()
  }

  const sel = (label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[], placeholder: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <select
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">

        <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] rounded-2xl p-5 mb-6 flex items-center gap-4">
          <span className="text-4xl">🕊️</span>
          <div>
            <h1 className="text-white font-bold text-xl">Card Generator</h1>
            <p className="text-green-300 text-sm">Select club → tournament → participant</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5 space-y-4">
          {sel('Club', clubId, setClubId,
            clubs.map(c => ({ value: c.id, label: c.nameUrdu || c.name })),
            'Select a club...'
          )}
          {clubId && sel('Tournament', tournamentId, setTournamentId,
            tournaments.map(t => ({ value: t.id, label: t.nameUrdu || t.name })),
            'Select a tournament...'
          )}
          {tournamentId && selectedTournament?.raceDays?.length ? (
            sel('Race Day', String(day), v => setDay(Number(v)),
              (selectedTournament.raceDays || []).map(r => ({ value: String(r.dayNumber), label: `Day ${r.dayNumber} — ${r.date}` })),
              'Select day...'
            )
          ) : null}
          {tournamentId && sel('Participant', participantId, setParticipantId,
            participants.map(p => ({ value: p.id, label: `${p.nameUrdu || p.name} · ${p.area}` })),
            'Select a participant...'
          )}

          <button
            onClick={generate}
            disabled={!clubId || !tournamentId || !participantId || loading}
            className="w-full bg-[#1b5e20] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#2e7d32] active:scale-95 transition disabled:opacity-40"
          >
            {loading ? 'Generating...' : 'Generate Card'}
          </button>
        </div>

        {cardReady && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <img key={cardUrl} src={cardUrl} alt="Result card" className="w-full rounded-xl border border-gray-100" />
            <div className="flex gap-3 mt-4">
              <button
                onClick={download}
                className="flex-1 bg-[#1b5e20] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-[#2e7d32] active:scale-95 transition"
              >
                Download PNG
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(window.location.origin + cardUrl)}
                className="flex-1 border border-[#1b5e20] text-[#1b5e20] py-2.5 rounded-xl font-bold text-sm hover:bg-green-50 active:scale-95 transition"
              >
                Copy Link
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
