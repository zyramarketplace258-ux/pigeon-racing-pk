import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const isArabic = (text: string) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text)
const safe = (text: string, fallback = '') => isArabic(text) ? fallback : text
const getMedal = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
const getRankLabel = (rank: number) => rank === 1 ? '1st Place' : rank === 2 ? '2nd Place' : '3rd Place'
const getRankBg = (rank: number) => rank === 1 ? '#f9a825' : rank === 2 ? '#9e9e9e' : '#8d6e63'

async function fetchPhoto(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let b64 = ''
    for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i])
    return `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${btoa(b64)}`
  } catch { return null }
}

export async function GET(request: NextRequest) {
  try {
    const s = (k: string, def = '') => new URL(request.url).searchParams.get(k) ?? def

    const type       = s('type', 'daily')
    const tournament = safe(s('tournament', 'Spring Championship'), 'Tournament')
    const club       = safe(s('club', 'Punjab Pigeons'), 'Club')
    const player     = safe(s('player', 'Malik Shahzad'), s('playerUrdu', 'Player'))
    const area       = safe(s('area', ''), safe(s('areaUrdu', ''), ''))
    const rank       = parseInt(s('rank', '0')) || 0
    const score      = s('score', '')
    const photoUrl   = s('photoUrl')
    const photoData  = photoUrl ? await fetchPhoto(photoUrl) : null
    const medal      = getMedal(rank)
    const bg         = getRankBg(rank)

    // ── Shared sub-components ────────────────────────────────────

    const headerEl = (rightContent: React.ReactNode) => (
      <div style={{ display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg,#1a4a1f,#2e7d32)', padding: '14px 22px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 34 }}>🕊️</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'white', fontSize: 19, fontWeight: 900 }}>Punjab Pigeons</span>
              <span style={{ color: '#a5d6a7', fontSize: 9, letterSpacing: 3 }}>RACING FEDERATION</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {rightContent}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 12px', border: '1px solid rgba(255,255,255,0.3)' }}>
            <span style={{ color: 'white', fontSize: 10, fontWeight: 600 }}>{tournament}</span>
          </div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 12px', border: '1px solid rgba(255,255,255,0.3)' }}>
            <span style={{ color: 'white', fontSize: 10, fontWeight: 600 }}>{club}</span>
          </div>
        </div>
      </div>
    )

    const profileEl = (scoreLabel: string) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '12px 16px', background: 'white', borderRadius: 14, padding: '12px 18px', border: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px solid #c8e6c9', borderRadius: 10, padding: '8px 16px', background: '#f1fbf1', flexShrink: 0 }}>
          <span style={{ color: '#888', fontSize: 8, letterSpacing: 2, fontWeight: 700 }}>{scoreLabel}</span>
          <span style={{ color: '#1b5e20', fontSize: score ? 28 : 18, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>{score || '--:--'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center' }}>
          <span style={{ color: '#111', fontSize: 19, fontWeight: 800, textAlign: 'center' }}>{player}</span>
          {area ? <span style={{ color: '#4caf50', fontSize: 12, marginTop: 3 }}>{area}</span> : null}
          {medal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
              <span style={{ fontSize: 22 }}>{medal}</span>
              <span style={{ display: 'flex', background: bg, color: 'white', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                {getRankLabel(rank)}
              </span>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
          <div style={{ display: 'flex', width: 66, height: 66, borderRadius: 33, border: '3px solid #43a047', background: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
            {photoData
              ? <img src={photoData} width={66} height={66} style={{ borderRadius: 33 }} alt="" />
              : <span style={{ fontSize: 24, fontWeight: 900, color: '#1b5e20' }}>{player.charAt(0).toUpperCase()}</span>
            }
          </div>
          {!medal && rank > 0 && (
            <div style={{ display: 'flex', position: 'absolute', top: -3, right: -3, width: 22, height: 22, borderRadius: 11, background: '#388e3c', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
              <span style={{ color: 'white', fontSize: 10, fontWeight: 900 }}>{String(rank)}</span>
            </div>
          )}
        </div>
      </div>
    )

    const gridEl = (cells: { i: number; label: string; time: string; active: boolean }[], cols: number) => {
      const rows: typeof cells[] = []
      for (let r = 0; r < Math.ceil(cells.length / cols); r++) {
        const row = [...cells.slice(r * cols, (r + 1) * cols)]
        while (row.length < cols) row.push({ i: -1, label: '', time: '', active: false })
        rows.push(row)
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, margin: '0 16px', gap: 8, position: 'relative' }}>
          <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', opacity: 0.06 }}>
              <span style={{ fontSize: 150 }}>🕊️</span>
            </div>
          </div>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 8, flex: 1 }}>
              {row.map((cell, ci) => cell.i === -1
                ? <div key={ci} style={{ flex: 1, display: 'flex' }} />
                : (
                  <div key={cell.i} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.78)', borderRadius: 10, border: `1.5px solid ${cell.active ? 'rgba(76,175,80,0.45)' : 'rgba(200,200,200,0.5)'}` }}>
                    <div style={{ display: 'flex', height: 5, background: cell.active ? '#4caf50' : '#e0e0e0', borderRadius: '8px 8px 0 0' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4px 2px' }}>
                      <span style={{ color: '#aaa', fontSize: 9, fontWeight: 700 }}>{cell.label}</span>
                      <span style={{ color: cell.active ? '#1b5e20' : '#bbb', fontSize: 15, fontWeight: 900, marginTop: 2 }}>{cell.time}</span>
                    </div>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )
    }

    const footerEl = (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '9px 16px 11px' }}>
        <span style={{ color: 'rgba(27,94,32,0.25)', fontSize: 12, fontWeight: 700, letterSpacing: 3 }}>PUNJAB PIGEONS</span>
      </div>
    )

    // ── DAILY CARD ───────────────────────────────────────────────
    if (type === 'daily') {
      const day         = s('day', '1')
      const totalDays   = s('totalDays', '1')
      const date        = s('date', '')
      const pigeonCount = Math.max(1, parseInt(s('pigeonCount', '9')) || 9)
      const timesRaw    = s('times')
      const rawTimes    = timesRaw ? timesRaw.split(',') : []
      while (rawTimes.length < pigeonCount) rawTimes.push('')

      const cells = rawTimes.slice(0, pigeonCount).map((t, i) => ({
        i, label: `#${i + 1}`, time: t || '--', active: !!(t && t !== '--'),
      }))
      const cols   = pigeonCount <= 6 ? 3 : pigeonCount <= 12 ? 4 : pigeonCount <= 20 ? 5 : 6
      const rows   = Math.ceil(pigeonCount / cols)
      const height = Math.min(Math.max(580, 360 + rows * 115), 820)

      return new ImageResponse(
        (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: '#eef4ee' }}>
            {headerEl(
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ color: 'white', fontSize: 14, fontWeight: 800 }}>{`DAY ${day} OF ${totalDays}`}</span>
                {date ? <span style={{ color: '#c8e6c9', fontSize: 11 }}>{date}</span> : null}
              </div>
            )}
            {profileEl('DAY TOTAL')}
            {gridEl(cells, cols)}
            {footerEl}
          </div>
        ),
        { width: 900, height: height }
      )
    }

    // ── OVERALL CARD ─────────────────────────────────────────────
    const totalDays   = Math.max(1, parseInt(s('totalDays', '1')) || 1)
    const dayTimesRaw = s('dayTimes')
    const rawDayTimes = dayTimesRaw ? dayTimesRaw.split(',') : []
    while (rawDayTimes.length < totalDays) rawDayTimes.push('')

    const dayCells = rawDayTimes.slice(0, totalDays).map((t, i) => ({
      i, label: `DAY ${i + 1}`, time: t || '--', active: !!(t && t !== '--'),
    }))
    const dayCols = totalDays <= 3 ? totalDays : totalDays <= 8 ? 4 : 5
    const dayRows = Math.ceil(totalDays / dayCols)
    const height  = Math.min(Math.max(560, 360 + dayRows * 115), 780)

    return new ImageResponse(
      (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: '#eef4ee' }}>
          {headerEl(
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>OVERALL RESULT</span>
              <span style={{ color: '#a5d6a7', fontSize: 10, marginTop: 3 }}>{`${totalDays} DAY${totalDays > 1 ? 'S' : ''} TOURNAMENT`}</span>
            </div>
          )}
          {profileEl('TOTAL TIME')}
          {gridEl(dayCells, dayCols)}
          {footerEl}
        </div>
      ),
      { width: 900, height: height }
    )

  } catch (err) {
    return new Response(`Card error: ${err}`, { status: 500, headers: { 'content-type': 'text/plain' } })
  }
}
