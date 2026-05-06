'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

interface RaceDay {
  dayNumber: number
  date: string
  isGap: boolean
}

export default function NewTournamentPage() {
  const router = useRouter()
  const params = useParams()
  const clubId = params.clubId as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [raceDays, setRaceDays] = useState<RaceDay[]>([])

  const [form, setForm] = useState({
    name: '',
    totalDays: 10,
    defaultStartTime: '06:00',
    pigeonCount: 5,
    startDate: '',
  })

  // Regenerate race days whenever startDate or totalDays changes
  useEffect(() => {
    if (!form.startDate || !form.totalDays) { setRaceDays([]); return }
    const start = new Date(form.startDate)
    const days: RaceDay[] = []
    for (let i = 0; i < form.totalDays; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      // Preserve existing gap toggles when regenerating
      const existing = raceDays[i]
      days.push({
        dayNumber: i + 1,
        date: d.toISOString().split('T')[0],
        isGap: existing?.isGap ?? false,
      })
    }
    setRaceDays(days)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.totalDays])

  const toggleGap = (index: number) => {
    setRaceDays(prev => prev.map((d, i) => i === index ? { ...d, isGap: !d.isGap } : d))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await addDoc(collection(db, 'clubs', clubId, 'tournaments'), {
        name: form.name,
        status: 'inactive',
        totalDays: form.totalDays,
        defaultStartTime: form.defaultStartTime,
        pigeonCount: form.pigeonCount,
        raceDays,
        createdAt: serverTimestamp(),
        createdBy: 'admin',
      })

      router.push(`/admin/clubs/${clubId}`)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const gapCount = raceDays.filter(d => d.isGap).length
  const raceDayCount = raceDays.length - gapCount

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">🏆 New Tournament</h1>
          <p className="text-green-400 text-xs">Admin Panel</p>
        </div>
        <Link href={`/admin/clubs/${clubId}`} className="text-xs text-green-400 hover:text-secondary transition">
          ← Back to Club
        </Link>
      </header>

      <div className="px-6 py-8 max-w-xl mx-auto">
        <div className="bg-surface border border-green-800 rounded-2xl p-8">

          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-green-300 text-sm mb-2">Tournament Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Spring Race 2026"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                required
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary"
              />
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">
                Total Days
                <span className="text-green-600 ml-2 text-xs">(1 to 100)</span>
              </label>
              <input
                type="number"
                value={form.totalDays}
                onChange={e => setForm(f => ({ ...f, totalDays: parseInt(e.target.value) || 1 }))}
                required
                min={1}
                max={100}
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary"
              />
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Default Start Time</label>
              <input
                type="time"
                value={form.defaultStartTime}
                onChange={e => setForm(f => ({ ...f, defaultStartTime: e.target.value }))}
                required
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary"
              />
              <p className="text-green-600 text-xs mt-1">This can be changed per participant before entry</p>
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Number of Pigeons Flying</label>
              <input
                type="number"
                value={form.pigeonCount}
                onChange={e => setForm(f => ({ ...f, pigeonCount: parseInt(e.target.value) || 1 }))}
                required
                min={1}
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary"
              />
            </div>

            {/* Race Days Preview */}
            {raceDays.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-green-300 text-sm">Schedule — tap a day to mark as gap</label>
                  <span className="text-green-600 text-xs">{raceDayCount} race · {gapCount} gap</span>
                </div>
                <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
                  {raceDays.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleGap(i)}
                      className={`rounded-lg p-2 text-center text-xs font-semibold transition border ${
                        d.isGap
                          ? 'bg-dark border-green-900 text-green-700 line-through'
                          : 'bg-primary border-green-700 text-white hover:border-secondary'
                      }`}
                    >
                      <span className="block font-bold">{d.isGap ? 'GAP' : `D${d.dayNumber}`}</span>
                      <span className="block text-xs opacity-70 mt-0.5">{d.date.slice(5)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || raceDays.length === 0}
              className="w-full bg-secondary hover:bg-accent text-dark font-bold py-3 rounded-lg transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>

          </form>
        </div>
      </div>
    </main>
  )
}
