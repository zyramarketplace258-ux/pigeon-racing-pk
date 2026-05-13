import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const isArabic = (text: string) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text)
const safeText = (text: string, fallback = '') => isArabic(text) ? fallback : text

export async function GET(request: NextRequest) {
  const s = (k: string, def = '') => new URL(request.url).searchParams.get(k) ?? def

  const tournament = safeText(s('tournament', 'High Fly Spring Championship'), 'Tournament')
  const club       = safeText(s('club', 'High Fly Club'), 'Club')
  const player     = safeText(s('player', 'Muhammad Ali'), s('playerUrdu', 'Player'))
  const area       = safeText(s('area', 'Lahore'), safeText(s('areaUrdu', ''), ''))
  const photoUrl   = s('photoUrl')
  const date       = s('date', '10 May 2026')
  const rank       = parseInt(s('rank', '1'))
  const score      = s('score', '05:32')
  const timesRaw   = s('times')

  const times = timesRaw ? timesRaw.split(',') : []
  while (times.length < 9) times.push('')

  const medal     = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅'
  const rankLabel = rank === 1 ? '1st Place' : rank === 2 ? '2nd Place' : rank === 3 ? '3rd Place' : `Rank #${rank}`
  const rankColor = rank === 1 ? '#c8900a' : rank === 2 ? '#757575' : rank === 3 ? '#8b5e3c' : '#2e7d32'
  const rankGrad  = rank === 1
    ? 'linear-gradient(135deg,#b8800a,#ffe066)'
    : rank === 2
    ? 'linear-gradient(135deg,#757575,#d8d8d8)'
    : rank === 3
    ? 'linear-gradient(135deg,#8b5e3c,#d4956a)'
    : 'linear-gradient(135deg,#1b5e20,#66bb6a)'

  // Dark premium theme for 1st place
  const dark         = rank === 1
  const playerBg     = dark ? '#0f230f' : 'white'
  const timelineBg   = dark ? '#0b1a0b' : '#f2fbf2'
  const nameCol      = dark ? '#ffffff' : '#1a1a1a'
  const areaCol      = dark ? '#66bb6a' : '#666'
  const scoreCol     = dark ? '#ffe066' : '#1b5e20'
  const labelCol     = dark ? '#4caf50' : '#999'
  const lineCol      = dark ? '#1e3e1e' : '#c8e6c9'
  const dotEmptyCol  = dark ? '#1e3e1e' : '#ddd'
  const timeValCol   = dark ? '#a5d6a7' : '#1b5e20'
  const timeEmptyCol = dark ? '#1e3e1e' : '#ccc'
  const badgeTextCol = rank === 2 ? '#333' : 'white'
  const watermarkCol = dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)'

  const filledCount = times.filter(t => t).length

  let photoData: string | null = null
  if (photoUrl) {
    try {
      const res = await fetch(photoUrl)
      const buf = await res.arrayBuffer()
      const b64 = Buffer.from(buf).toString('base64')
      const mime = res.headers.get('content-type') || 'image/jpeg'
      photoData = `data:${mime};base64,${b64}`
    } catch { /* skip */ }
  }

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(90deg,#1b5e20,#2e7d32)',
          padding: '18px 36px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#a5d6a7', fontSize: 9, letterSpacing: 5, textTransform: 'uppercase', fontWeight: 700 }}>HIGH FLY PIGEONS</span>
            <span style={{ color: 'white', fontSize: 21, fontWeight: 800, marginTop: 5 }}>{tournament}</span>
            <span style={{ color: '#c8e6c9', fontSize: 12, marginTop: 3 }}>{club}{date ? `  ·  ${date}` : ''}</span>
          </div>
          <span style={{ fontSize: 48 }}>🕊️</span>
        </div>

        {/* ── Player section ── */}
        <div style={{
          display: 'flex', position: 'relative', overflow: 'hidden',
          background: playerBg, padding: '20px 36px 20px 46px', gap: 20,
          borderBottom: `2px solid ${dark ? '#1e3e1e' : '#e8f5e9'}`,
          alignItems: 'center',
        }}>
          {/* Left rank stripe */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: rankGrad }} />

          {/* Watermark rank number */}
          <div style={{
            position: 'absolute', right: 12, top: -16,
            color: watermarkCol, fontSize: 190, fontWeight: 900, lineHeight: 1, letterSpacing: -8,
          }}>
            {rank}
          </div>

          {/* Avatar / photo */}
          <div style={{
            display: 'flex', width: 84, height: 84, borderRadius: 42, flexShrink: 0,
            background: rankGrad, alignItems: 'center', justifyContent: 'center',
            border: `3px solid ${rankColor}`, overflow: 'hidden',
          }}>
            {photoData
              ? <img src={photoData} style={{ width: 84, height: 84, objectFit: 'cover' }} alt="" />
              : <span style={{ color: 'white', fontSize: 32, fontWeight: 800 }}>{player.charAt(0).toUpperCase()}</span>
            }
          </div>

          {/* Name + badge */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ color: nameCol, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{player}</span>
            {area ? <span style={{ color: areaCol, fontSize: 13, marginTop: 3 }}>{area}</span> : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 20 }}>{medal}</span>
              <span style={{ background: rankGrad, color: badgeTextCol, fontSize: 12, fontWeight: 800, padding: '4px 14px', borderRadius: 20 }}>
                {rankLabel}
              </span>
            </div>
          </div>

          {/* Score — hero element */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            <span style={{ color: labelCol, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase' }}>TOTAL SCORE</span>
            <span style={{ color: scoreCol, fontSize: 56, fontWeight: 900, lineHeight: 1, marginTop: 4, letterSpacing: -2 }}>{score}</span>
            <span style={{ color: labelCol, fontSize: 10, marginTop: 3 }}>hours flown</span>
          </div>
        </div>

        {/* ── Timeline ── */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '13px 36px 8px', flex: 1, background: timelineBg }}>
          <span style={{ color: labelCol, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, marginBottom: 13 }}>
            {`PIGEON TIMES${filledCount > 0 ? `  ·  ${filledCount} / ${times.length} LANDED` : ''}`}
          </span>

          <div style={{ display: 'flex', position: 'relative', flex: 1, alignItems: 'flex-start' }}>
            {/* Horizontal connector line */}
            <div style={{ position: 'absolute', left: 8, right: 8, top: 5, height: 2, background: lineCol }} />

            {times.slice(0, 9).map((time, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Dot */}
                <div style={{
                  width: 12, height: 12, borderRadius: 6,
                  background: time ? rankColor : dotEmptyCol,
                }} />
                <span style={{ color: labelCol, fontSize: 9, marginTop: 5 }}>#{i + 1}</span>
                <span style={{ color: time ? timeValCol : timeEmptyCol, fontSize: 11, fontWeight: 700, marginTop: 1 }}>
                  {time || '--'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#1b5e20', padding: '8px 36px',
        }}>
          <span style={{ color: '#81c784', fontSize: 11, fontWeight: 600 }}>highflypigeons.com</span>
          <span style={{ color: '#4caf50', fontSize: 10 }}>Generated by High Fly Pigeons</span>
          <span style={{ color: '#81c784', fontSize: 11 }}>Love for the Loft 🕊️</span>
        </div>

      </div>
    ),
    { width: 900, height: 520 }
  )
}
