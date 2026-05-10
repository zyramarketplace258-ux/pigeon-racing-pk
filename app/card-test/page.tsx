'use client'
import { useState } from 'react'

const DEFAULT = {
  tournament: 'High Fly Spring Championship',
  player: 'Muhammad Ali',
  playerUrdu: 'محمد علی',
  area: 'Lahore',
  date: '10 May 2026',
  rank: '1',
  score: '05:32',
  times: '06:12,06:45,07:20,07:55,08:30,09:10,09:45,10:20,',
}

export default function CardTestPage() {
  const [form, setForm] = useState(DEFAULT)
  const [preview, setPreview] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const cardUrl = `/api/card?${new URLSearchParams(form)}`

  const download = async () => {
    const res = await fetch(cardUrl)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `card-${form.player}-${form.date}.png`
    a.click()
  }

  const field = (label: string, key: string, placeholder?: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <input
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
        value={form[key as keyof typeof form]}
        placeholder={placeholder}
        onChange={e => set(key, e.target.value)}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Card Generator — Test Page</h1>
          <p className="text-gray-500 text-sm mt-1">Fill in the data, click Preview to generate the card image.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Tournament Name', 'tournament')}
            {field('Date', 'date', '10 May 2026')}
            {field('Player Name (English)', 'player')}
            {field('Player Name (Urdu)', 'playerUrdu')}
            {field('Area / City', 'area')}
            {field('Rank', 'rank', '1')}
            {field('Total Score', 'score', '05:32')}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Pigeon Times (9 values, comma separated)
              </label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 font-mono"
                value={form.times}
                placeholder="06:12,06:45,07:20,07:55,08:30,09:10,09:45,10:20,"
                onChange={e => set('times', e.target.value)}
              />
              <p className="text-xs text-gray-400">Leave empty slots with no value between commas e.g. 06:12,,07:20</p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setPreview(true)}
              className="bg-green-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-green-800 active:scale-95 transition"
            >
              Preview Card
            </button>
            {preview && (
              <button
                onClick={download}
                className="border border-green-700 text-green-700 px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-green-50 active:scale-95 transition"
              >
                Download PNG
              </button>
            )}
          </div>
        </div>

        {preview && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-3 font-mono break-all">{cardUrl}</p>
            <img
              key={cardUrl}
              src={cardUrl}
              alt="Generated card"
              className="w-full rounded-lg border border-gray-100"
            />
          </div>
        )}

      </div>
    </div>
  )
}
