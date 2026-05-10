import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const tournament = searchParams.get('tournament') || 'High Fly Spring Championship'
  const player     = searchParams.get('player')     || 'Muhammad Ali'
  const playerUrdu = searchParams.get('playerUrdu') || 'محمد علی'
  const area       = searchParams.get('area')       || 'Lahore'
  const date       = searchParams.get('date')       || '10 May 2026'
  const rank       = parseInt(searchParams.get('rank') || '1')
  const score      = searchParams.get('score')      || '05:32'
  const timesRaw   = searchParams.get('times')      || ''

  const times = timesRaw ? timesRaw.split(',') : []
  while (times.length < 9) times.push('')

  const rankColor  = rank === 1 ? '#c8900a' : rank === 2 ? '#8a8a8a' : rank === 3 ? '#cd7f32' : '#1b5e20'
  const rankLabel  = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `#${rank}`
  const medal      = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅'

  let fontData: ArrayBuffer | null = null
  try {
    fontData = await fetch(
      'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2'
    ).then(r => r.arrayBuffer())
  } catch { /* fall back to default font */ }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex', flexDirection: 'column',
          width: '100%', height: '100%',
          background: '#f0f9f0',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg,#1b5e20,#2e7d32)',
          padding: '22px 36px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#a5d6a7', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase' }}>
              HIGH FLY PIGEONS
            </span>
            <span style={{ color: 'white', fontSize: 22, fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>
              {tournament}
            </span>
            <span style={{ color: '#c8e6c9', fontSize: 13, marginTop: 4 }}>{date}</span>
          </div>
          <span style={{ fontSize: 56 }}>🕊️</span>
        </div>

        {/* ── Player row ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          padding: '18px 36px',
          background: 'white',
          borderBottom: '2px solid #e8f5e9',
        }}>
          {/* Rank badge */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: '50%',
            background: rankColor, flexShrink: 0,
          }}>
            <span style={{ fontSize: 22 }}>{medal}</span>
            <span style={{ color: 'white', fontSize: 11, fontWeight: 700, marginTop: -2 }}>{rankLabel}</span>
          </div>

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ color: '#1a1a1a', fontSize: 24, fontWeight: 700 }}>{player}</span>
            <span style={{ color: '#555', fontSize: 14, marginTop: 2 }}>{playerUrdu}  ·  {area}</span>
          </div>

          {/* Score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ color: '#888', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>Total Score</span>
            <span style={{ color: '#1b5e20', fontSize: 32, fontWeight: 700, marginTop: 2 }}>{score}</span>
          </div>
        </div>

        {/* ── Pigeon times grid ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10,
          padding: '16px 30px', flex: 1,
          alignContent: 'flex-start',
        }}>
          {times.slice(0, 9).map((time, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: time ? '#e8f5e9' : '#f5f5f5',
              border: time ? '1px solid #a5d6a7' : '1px solid #e0e0e0',
              borderRadius: 10, padding: '10px 0', width: 78,
            }}>
              <span style={{ color: '#888', fontSize: 11 }}>🕊️ #{i + 1}</span>
              <span style={{
                color: time ? '#1b5e20' : '#ccc',
                fontSize: 16, fontWeight: 700, marginTop: 4,
              }}>
                {time || '--:--'}
              </span>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#1b5e20', padding: '10px 36px',
        }}>
          <span style={{ color: '#81c784', fontSize: 12 }}>highflypigeons.com</span>
          <span style={{ color: '#81c784', fontSize: 12 }}>Love for the Loft 🕊️</span>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 500,
      ...(fontData ? { fonts: [{ name: 'Inter', data: fontData, weight: 700, style: 'normal' }] } : {}),
    }
  )
}
