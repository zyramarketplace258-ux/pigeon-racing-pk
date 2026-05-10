import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

function getPKT(): string {
  const now = new Date()
  const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000)
  const h = pkt.getUTCHours().toString().padStart(2, '0')
  const m = pkt.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m} PKT`
}

export async function GET(request: NextRequest) {
  const s = (k: string, def = '') => new URL(request.url).searchParams.get(k) ?? def

  const tournament  = s('tournament', 'High Fly Spring Championship')
  const club        = s('club', 'High Fly Club')
  const player      = s('player', 'Muhammad Ali')
  const playerUrdu  = s('playerUrdu', 'محمد علی')
  const area        = s('area', 'Lahore')
  const areaUrdu    = s('areaUrdu', '')
  const photoUrl    = s('photoUrl')
  const date        = s('date', '10 May 2026')
  const rank        = parseInt(s('rank', '1'))
  const score       = s('score', '05:32')
  const timesRaw    = s('times')

  const times = timesRaw ? timesRaw.split(',') : []
  while (times.length < 9) times.push('')

  const medal      = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅'
  const rankLabel  = rank === 1 ? '1st Place' : rank === 2 ? '2nd Place' : rank === 3 ? '3rd Place' : `Rank #${rank}`
  const rankColor  = rank === 1 ? '#c8900a' : rank === 2 ? '#757575' : rank === 3 ? '#a0522d' : '#2e7d32'

  // Load profile photo if provided
  let photoData: string | null = null
  if (photoUrl) {
    try {
      const res = await fetch(photoUrl)
      const buf = await res.arrayBuffer()
      const b64 = Buffer.from(buf).toString('base64')
      const mime = res.headers.get('content-type') || 'image/jpeg'
      photoData = `data:${mime};base64,${b64}`
    } catch { /* skip photo */ }
  }

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: '#f0f9f0' }}>

        {/* ── Green Header (like SiteHeader) ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(90deg,#1b5e20,#2e7d32)',
          padding: '20px 32px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#a5d6a7', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase' }}>HIGH FLY PIGEONS</span>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{tournament}</span>
            <span style={{ color: '#c8e6c9', fontSize: 12, marginTop: 3 }}>{club}  ·  {date}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 40 }}>🕊️</span>
            <span style={{ color: '#81c784', fontSize: 11 }}>{getPKT()}</span>
          </div>
        </div>

        {/* ── Player Info ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 18,
          background: 'white', padding: '18px 32px',
          borderBottom: '2px solid #e8f5e9',
        }}>
          {/* Profile photo */}
          <div style={{
            display: 'flex', width: 68, height: 68, borderRadius: '50%', flexShrink: 0,
            background: rankColor, alignItems: 'center', justifyContent: 'center',
            border: `3px solid ${rankColor}`, overflow: 'hidden',
          }}>
            {photoData
              ? <img src={photoData} style={{ width: 68, height: 68, objectFit: 'cover' }} />
              : <span style={{ color: 'white', fontSize: 26, fontWeight: 700 }}>
                  {player.charAt(0).toUpperCase()}
                </span>
            }
          </div>

          {/* Name + rank */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ color: '#1a1a1a', fontSize: 22, fontWeight: 700 }}>{player}</span>
            <span style={{ color: '#555', fontSize: 14, marginTop: 2 }}>{playerUrdu}{(areaUrdu || area) ? `  ·  ${areaUrdu || area}` : ''}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 18 }}>{medal}</span>
              <span style={{ background: rankColor, color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                {rankLabel}
              </span>
            </div>
          </div>

          {/* Total score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ color: '#888', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Total Score</span>
            <span style={{ color: '#1b5e20', fontSize: 34, fontWeight: 700, marginTop: 2 }}>{score}</span>
          </div>
        </div>

        {/* ── Pigeon Times Grid ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 28px', flex: 1, alignContent: 'flex-start' }}>
          {times.slice(0, 9).map((time, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: time ? '#e8f5e9' : '#f5f5f5',
              border: `1px solid ${time ? '#a5d6a7' : '#e0e0e0'}`,
              borderRadius: 10, padding: '9px 0', width: 76,
            }}>
              <span style={{ color: '#888', fontSize: 10 }}>🕊️ #{i + 1}</span>
              <span style={{ color: time ? '#1b5e20' : '#ccc', fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                {time || '--:--'}
              </span>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#1b5e20', padding: '9px 32px',
        }}>
          <span style={{ color: '#81c784', fontSize: 11 }}>highflypigeons.com</span>
          <span style={{ color: '#81c784', fontSize: 11 }}>Love for the Loft 🕊️</span>
        </div>

      </div>
    ),
    { width: 800, height: 500 }
  )
}
