import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import QRCode from 'qrcode'

const COLLEGE_LAT = 13.0574
const COLLEGE_LNG = 77.5955
const QR_EXPIRY_SECONDS = 300

const SUBJECTS = [
  'Mathematics III',
  'Communication Skills',
  'Chemistry',
  'Python Programming',
  'AI & Machine Learning',
  'Interdisciplinary Project',
  'IC (Innovation & Creativity)',
]

const PERIODS = [
  'Period 1 — 9:00 AM',
  'Period 2 — 10:00 AM',
  'Period 3 — 11:00 AM',
  'Period 4 — 12:00 PM',
  'Period 5 — 2:00 PM',
  'Period 6 — 3:00 PM',
]

export default function SessionManager({ teacher, onSessionStart, onSessionEnd }) {
  const [subject, setSubject] = useState('')
  const [period, setPeriod] = useState('')
  const [session, setSession] = useState(null)
  const [qrUrl, setQrUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(QR_EXPIRY_SECONDS)
  const [expired, setExpired] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  function startTimer() {
    setTimeLeft(QR_EXPIRY_SECONDS)
    setExpired(false)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setExpired(true)
          expireQR()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function expireQR() {
    if (!session) return
    await supabase
      .from('attendance_sessions')
      .update({ is_active: false })
      .eq('id', session.id)
  }

  async function generateQRCode(token) {
    // Use window.location.origin so it works on both
    // localhost AND Vercel automatically
    const origin = window.location.origin
    const scanUrl = `${origin}/scan/${token}`
    const qr = await QRCode.toDataURL(scanUrl, {
      width: 220,
      color: { dark: '#ff4d2e', light: '#111827' }
    })
    return qr
  }

  async function startSession() {
    if (!subject || !period) {
      alert('Please select subject and period!')
      return
    }
    setLoading(true)
    const token = crypto.randomUUID()

    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        subject,
        period,
        qr_token: token,
        is_active: true,
        teacher_id: teacher?.id,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (error) {
      alert('Error starting session! ' + error.message)
      setLoading(false)
      return
    }

    const qr = await generateQRCode(token)
    setQrUrl(qr)
    setSession(data)
    onSessionStart(data)
    setLoading(false)
    startTimer()
  }

  async function endSession() {
    clearInterval(timerRef.current)
    if (!session) return
    await supabase
      .from('attendance_sessions')
      .update({ is_active: false })
      .eq('id', session.id)
    setSession(null)
    setQrUrl('')
    setTimeLeft(QR_EXPIRY_SECONDS)
    setExpired(false)
    onSessionEnd()
  }

  async function refreshQR() {
    if (!session) return
    setLoading(true)
    clearInterval(timerRef.current)

    const newToken = crypto.randomUUID()
    await supabase
      .from('attendance_sessions')
      .update({
        qr_token: newToken,
        is_active: true,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      })
      .eq('id', session.id)

    const qr = await generateQRCode(newToken)
    setSession(prev => ({ ...prev, qr_token: newToken }))
    setQrUrl(qr)
    setExpired(false)
    setLoading(false)
    startTimer()
  }

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs = String(timeLeft % 60).padStart(2, '0')
  const timerPct = (timeLeft / QR_EXPIRY_SECONDS) * 100
  const timerColor = timeLeft > 120
    ? 'var(--success)'
    : timeLeft > 60
    ? 'var(--warning)'
    : 'var(--danger)'

  return (
    <div className="card">
      <div className="corner-deco tl" />
      <div className="corner-deco br" />
      <h2><span>📋</span> Session Manager</h2>

      {!session ? (
        <>
          <select
            className="input"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          >
            <option value="">▸ Select Subject</option>
            {SUBJECTS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="input"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="">▸ Select Period</option>
            {PERIODS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <button
            className="btn btn-primary"
            onClick={startSession}
            disabled={loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? '⚡ Starting...' : '▶ Launch Session'}
          </button>
        </>
      ) : (
        <>
          {/* LIVE BADGE */}
          <div className="live-badge">
            <div className="live-dot" />
            {expired ? '⏰ QR Expired' : '🟢 Session Active'}
          </div>

          {/* SUBJECT INFO */}
          <div style={{
            background: 'rgba(255,77,46,0.05)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '13px',
              color: 'var(--accent-primary)',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>{session.subject}</div>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              letterSpacing: '1px'
            }}>{session.period}</div>
            {teacher && (
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                letterSpacing: '1px',
                marginTop: '4px'
              }}>👤 {teacher.name}</div>
            )}
          </div>

          {/* COUNTDOWN TIMER */}
          {!expired && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{
                  fontSize: '11px',
                  letterSpacing: '2px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase'
                }}>QR Expires In</span>
                <span style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: timerColor,
                  textShadow: `0 0 10px ${timerColor}`,
                  transition: 'color 0.3s ease'
                }}>{mins}:{secs}</span>
              </div>

              {/* TIMER BAR */}
              <div style={{
                width: '100%',
                height: '6px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${timerPct}%`,
                  background: timerColor,
                  borderRadius: '3px',
                  transition: 'width 1s linear, background 0.3s ease',
                  boxShadow: `0 0 8px ${timerColor}`
                }} />
              </div>

              <div style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                marginTop: '6px',
                letterSpacing: '1px',
                textAlign: 'right'
              }}>
                Auto expires in {mins}:{secs}
              </div>
            </div>
          )}

          {/* QR CODE */}
          {qrUrl && !expired && (
            <div className="qr-box">
              <img src={qrUrl} alt="QR Code" width={200} />
              <div className="qr-label">
                📱 Students scan this QR!
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                marginTop: '8px',
                letterSpacing: '1px',
                textAlign: 'center',
                position: 'relative',
                zIndex: 1
              }}>
                Show on projector for students
              </div>
            </div>
          )}

          {/* EXPIRED STATE */}
          {expired && (
            <div style={{
              textAlign: 'center',
              padding: '32px 24px',
              background: 'rgba(255,77,46,0.05)',
              border: '1px dashed rgba(255,77,46,0.3)',
              borderRadius: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '12px'
              }}>⏰</div>
              <div style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '14px',
                color: 'var(--accent-primary)',
                letterSpacing: '2px',
                marginBottom: '8px'
              }}>QR CODE EXPIRED</div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                letterSpacing: '1px'
              }}>
                QR expired after 5 minutes.<br />
                Generate a new one to continue.
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginTop: '16px'
          }}>
            <button
              className="btn btn-secondary"
              onClick={refreshQR}
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? '⏳' : '🔄'} New QR
            </button>
            <button
              className="btn btn-danger"
              onClick={endSession}
              style={{ flex: 1 }}
            >
              ⏹ End Session
            </button>
          </div>
        </>
      )}
    </div>
  )
}