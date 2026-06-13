import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import * as faceapi from 'face-api.js'

export default function ScanPage() {
  const { token } = useParams()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [step, setStep] = useState('loading')
  const [status, setStatus] = useState('')
  const [checks, setChecks] = useState({ session: null, face: null })
  const [session, setSession] = useState(null)
  const [student, setStudent] = useState(null)
  const [usn, setUsn] = useState('')
  const [attendanceData, setAttendanceData] = useState(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    setStatus('Verifying session...')
    const { data: sessionData } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('qr_token', token)
      .eq('is_active', true)
      .single()

    if (!sessionData) {
      setChecks(c => ({ ...c, session: false }))
      setStep('failed')
      setStatus('Session expired or invalid! Ask teacher for new QR.')
      return
    }

    setSession(sessionData)
    setChecks(c => ({ ...c, session: true }))
    setStep('usn')
    setStatus('')
  }

  async function loadModels() {
    try {
      setStatus('Loading AI models...')
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      setModelsLoaded(true)
      return true
    } catch (err) {
      console.error('Model loading error:', err)
      setStatus('❌ Failed to load AI models!')
      return false
    }
  }

  async function verifyUSN() {
    if (!usn.trim()) { alert('Enter your USN!'); return }
    setStatus('Looking up student...')

    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('usn', usn.toUpperCase())
      .single()

    if (!studentData) {
      setStatus('❌ USN not found! Contact your teacher.')
      return
    }

    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', session.id)
      .eq('student_id', studentData.id)
      .single()

    if (existing) {
      setStudent(studentData)
      await loadAttendanceData(studentData.id)
      setStep('already')
      return
    }

    setStudent(studentData)
    const loaded = await loadModels()
    if (!loaded) return

    setStatus('Starting camera...')
    startCamera(studentData)
  }

  async function startCamera(studentData) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setStep('camera')
      setStatus('Look at camera and click Scan Face!')
    } catch (err) {
      setStep('failed')
      setStatus('❌ Camera access denied!')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  async function scanFace() {
    setStatus('Scanning your face...')
    try {
      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        setStatus('❌ No face detected! Try again.')
        return
      }

      setStatus('Matching face...')

      if (!student.face_descriptor) {
        setStatus('❌ No face enrolled! Contact teacher.')
        return
      }

      const stored = new Float32Array(student.face_descriptor)
      const distance = faceapi.euclideanDistance(
        Array.from(detection.descriptor),
        Array.from(stored)
      )

      if (distance > 0.5) {
        setChecks(c => ({ ...c, face: false }))
        setStep('failed')
        setStatus('❌ Face not recognized!')
        return
      }

      setChecks(c => ({ ...c, face: true }))
      setStatus('Marking attendance...')

      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          session_id: session.id,
          student_id: student.id,
          face_matched: true,
          gps_verified: false,
          status: 'present'
        })

      stopCamera()

      if (error && error.code === '23505') {
        setStep('already')
        await loadAttendanceData(student.id)
      } else {
        await loadAttendanceData(student.id)
        setStep('success')
        setStatus('✅ Attendance marked successfully!')
      }
    } catch (err) {
      console.error('Scan error:', err)
      setStatus('❌ Error scanning face!')
    }
  }

  async function loadAttendanceData(studentId) {
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*, attendance_sessions(subject, period, created_at)')
      .eq('student_id', studentId)
      .order('marked_at', { ascending: false })

    const { data: allSessions } = await supabase
      .from('attendance_sessions')
      .select('id, subject')

    const subjectMap = {}
    allSessions?.forEach(s => {
      if (!subjectMap[s.subject])
        subjectMap[s.subject] = { total: 0, present: 0 }
      subjectMap[s.subject].total++
    })
    logs?.forEach(l => {
      const subj = l.attendance_sessions?.subject
      if (subj && subjectMap[subj]) subjectMap[subj].present++
    })

    const totalClasses = allSessions?.length || 0
    const totalPresent = logs?.length || 0
    const overallPct = totalClasses > 0
      ? Math.round((totalPresent / totalClasses) * 100) : 0

    setAttendanceData({
      logs: logs || [],
      subjectMap,
      totalClasses,
      totalPresent,
      overallPct
    })
  }

  return (
    <div className="scan-page">
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        background: `
          radial-gradient(ellipse at 20% 20%, rgba(255,77,46,0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(77,159,255,0.08) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }} />

      {/* HEADER */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '60px',
        background: 'rgba(10,14,26,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: '12px', zIndex: 10
      }}>
        <div style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: '16px',
          fontWeight: '700', letterSpacing: '3px',
          background: 'linear-gradient(90deg, #fff, var(--accent-primary))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>SMARTEND</div>
        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
        <div style={{
          fontSize: '11px', letterSpacing: '2px',
          color: 'var(--text-secondary)', textTransform: 'uppercase'
        }}>Student Portal</div>
      </div>

      <div style={{ paddingTop: '80px', width: '100%', maxWidth: '480px' }}>

        {/* LOADING */}
        {step === 'loading' && (
          <div className="scan-card" style={{ textAlign: 'center' }}>
            <div className="status-icon">⏳</div>
            <h2>Verifying...</h2>
            <p>{status}</p>
          </div>
        )}

        {/* USN ENTRY */}
        {step === 'usn' && (
          <div className="scan-card">
            <div className="corner-deco tl" />
            <div className="corner-deco br" />
            <div className="status-icon">🎓</div>
            <h2>Welcome!</h2>
            <p style={{ marginBottom: '24px' }}>
              {session?.subject} — {session?.period}
            </p>
            <input
              className="input"
              placeholder="Enter your USN"
              value={usn}
              onChange={e => setUsn(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyUSN()}
              style={{
                textAlign: 'center',
                letterSpacing: '3px',
                fontSize: '16px'
              }}
            />
            {status && (
              <p style={{
                color: status.includes('❌')
                  ? 'var(--danger)'
                  : 'var(--accent-primary)',
                fontSize: '13px',
                letterSpacing: '1px',
                marginBottom: '16px'
              }}>{status}</p>
            )}
            <button
              className="btn btn-primary"
              onClick={verifyUSN}
              style={{ width: '100%' }}
            >▶ Continue</button>
          </div>
        )}

        {/* CAMERA */}
        {step === 'camera' && (
          <div className="scan-card">
            <div className="corner-deco tl" />
            <div className="corner-deco br" />
            <h2 style={{ marginBottom: '8px' }}>Face Verification</h2>
            <p style={{ marginBottom: '16px' }}>
              Hi {student?.name}! Look at the camera
            </p>

            <div style={{ marginBottom: '16px' }}>
              {[
                { key: 'session', label: 'Session Valid' },
                { key: 'face', label: 'Face Match' },
              ].map(c => (
                <div key={c.key} className={`check-item ${
                  checks[c.key] === true ? 'check-pass' :
                  checks[c.key] === false ? 'check-fail' : 'check-pending'
                }`}>
                  {checks[c.key] === true ? '✅' :
                   checks[c.key] === false ? '❌' : '⏳'}
                  &nbsp;{c.label}
                </div>
              ))}
            </div>

            <video
              ref={videoRef}
              autoPlay
              muted
              style={{
                width: '100%',
                borderRadius: '16px',
                marginBottom: '16px',
                transform: 'scaleX(-1)',
                border: '1px solid var(--border)'
              }}
            />

            {status && (
              <p style={{
                color: status.includes('❌')
                  ? 'var(--danger)'
                  : 'var(--accent-primary)',
                fontSize: '13px',
                letterSpacing: '1px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>{status}</p>
            )}

            <button
              className="btn btn-primary"
              onClick={scanFace}
              style={{ width: '100%' }}
            >🔍 Scan Face</button>
          </div>
        )}

        {/* SUCCESS */}
        {step === 'success' && attendanceData && (
          <StudentDashboard
            student={student}
            attendanceData={attendanceData}
            session={session}
            isNew={true}
          />
        )}

        {/* ALREADY MARKED */}
        {step === 'already' && attendanceData && (
          <StudentDashboard
            student={student}
            attendanceData={attendanceData}
            session={session}
            isNew={false}
          />
        )}

        {/* FAILED */}
        {step === 'failed' && (
          <div className="scan-card">
            <div className="status-icon">❌</div>
            <h2>Verification Failed</h2>
            <p style={{ color: 'var(--danger)', marginBottom: '24px' }}>
              {status}
            </p>
            <div style={{ marginBottom: '24px' }}>
              {[
                { key: 'session', label: 'Session Valid' },
                { key: 'face', label: 'Face Match' },
              ].map(c => (
                <div key={c.key} className={`check-item ${
                  checks[c.key] === true ? 'check-pass' :
                  checks[c.key] === false ? 'check-fail' : 'check-pending'
                }`}>
                  {checks[c.key] === true ? '✅' :
                   checks[c.key] === false ? '❌' : '⏳'}
                  &nbsp;{c.label}
                </div>
              ))}
            </div>
            <button
              className="btn btn-danger"
              onClick={() => window.location.reload()}
              style={{ width: '100%' }}
            >🔄 Try Again</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── STUDENT DASHBOARD ─────────────────────────────────────
function StudentDashboard({ student, attendanceData, session, isNew }) {
  const { overallPct, subjectMap, logs, totalClasses, totalPresent } = attendanceData
  const isSafe = overallPct >= 75
  const offset = 440 - (overallPct / 100) * 440

  return (
    <div style={{ width: '100%', paddingBottom: '40px' }}>

      <div className="scan-card" style={{ marginBottom: '16px' }}>
        <div className="corner-deco tl" />
        <div className="corner-deco br" />

        {isNew ? (
          <>
            <div className="status-icon">✅</div>
            <h2>Attendance Marked!</h2>
            <p style={{ color: 'var(--success)', marginBottom: '8px' }}>
              {session?.subject} — {session?.period}
            </p>
          </>
        ) : (
          <>
            <div className="status-icon">⚠️</div>
            <h2>Already Marked</h2>
            <p style={{ marginBottom: '8px' }}>
              Attendance already recorded for this session.
            </p>
          </>
        )}

        <div style={{
          background: 'rgba(255,77,46,0.05)',
          border: '1px solid var(--border)',
          borderRadius: '12px', padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '16px', fontWeight: '700',
            color: 'var(--text-primary)', marginBottom: '4px'
          }}>{student?.name}</div>
          <div style={{
            fontSize: '12px', letterSpacing: '2px',
            color: 'var(--text-secondary)'
          }}>{student?.usn}</div>
        </div>

        <div className="attendance-ring">
          <svg className="ring-svg" viewBox="0 0 160 160">
            <circle className="ring-bg" cx="80" cy="80" r="70" />
            <circle
              className="ring-fill" cx="80" cy="80" r="70"
              stroke={isSafe ? '#00e676' : '#ff4d2e'}
              style={{ strokeDashoffset: offset }}
            />
          </svg>
          <div className="ring-center">
            <span className="ring-percent"
              style={{ color: isSafe ? '#00e676' : '#ff4d2e' }}>
              {overallPct}%
            </span>
            <span className="ring-label">Overall</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div className={`attendance-status ${isSafe ? 'status-safe' : 'status-danger'}`}>
            {isSafe ? '✅ Safe — Above 75%' : '⚠️ Danger — Below 75%'}
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '10px'
        }}>
          {[
            { label: 'Total Classes', val: totalClasses },
            { label: 'Attended', val: totalPresent },
            { label: 'Required', val: '75%' },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: '10px', padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '20px', fontWeight: '700',
                color: 'var(--accent-primary)', marginBottom: '4px'
              }}>{item.val}</div>
              <div style={{
                fontSize: '10px', letterSpacing: '1px',
                color: 'var(--text-secondary)', textTransform: 'uppercase'
              }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="scan-card" style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: '13px',
          letterSpacing: '2px', marginBottom: '20px',
          color: 'var(--text-primary)', textTransform: 'uppercase'
        }}>📚 Subject-wise Attendance</h2>

        {Object.entries(subjectMap).map(([subject, data]) => {
          const pct = data.total > 0
            ? Math.round((data.present / data.total) * 100) : 0
          const safe = pct >= 75
          return (
            <div key={subject} style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '6px'
              }}>
                <span style={{
                  fontSize: '13px', fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>{subject}</span>
                <span style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '14px', fontWeight: '700',
                  color: safe ? 'var(--success)' : 'var(--danger)'
                }}>{pct}%</span>
              </div>
              <div style={{
                width: '100%', height: '6px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '3px', overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: safe ? 'var(--success)' : 'var(--danger)',
                  borderRadius: '3px',
                  transition: 'width 1.5s cubic-bezier(0.4,0,0.2,1)'
                }} />
              </div>
              <div style={{
                fontSize: '11px', color: 'var(--text-secondary)',
                marginTop: '4px', letterSpacing: '1px'
              }}>
                {data.present}/{data.total} classes
                {!safe && ` — Need ${Math.max(0, Math.ceil((75 * data.total / 100) - data.present))} more`}
              </div>
            </div>
          )
        })}
      </div>

      <div className="scan-card">
        <h2 style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: '13px',
          letterSpacing: '2px', marginBottom: '20px',
          textTransform: 'uppercase'
        }}>📅 Recent Classes</h2>

        {logs.slice(0, 10).map((log, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--border)'
          }}>
            <div>
              <div style={{
                fontSize: '13px', fontWeight: '600',
                color: 'var(--text-primary)', marginBottom: '2px'
              }}>
                {log.attendance_sessions?.subject}
              </div>
              <div style={{
                fontSize: '11px', color: 'var(--text-secondary)',
                letterSpacing: '1px'
              }}>
                {new Date(log.marked_at).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric'
                })}
              </div>
            </div>
            <span className="badge badge-present">✅ Present</span>
          </div>
        ))}

        {logs.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '24px',
            color: 'var(--text-secondary)', fontSize: '13px'
          }}>No attendance records yet</div>
        )}
      </div>
    </div>
  )
}