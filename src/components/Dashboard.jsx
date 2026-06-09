import { useState, useEffect } from 'react'
import {
  supabase, getAllStudents, getFullReport,
  deleteStudent as deleteStudentDB
} from '../supabaseClient'
import SessionManager from './SessionManager'
import StudentGrid from './StudentGrid'
import EnrollModal from './EnrollModal'

export default function Dashboard({ teacher, onLogout }) {
  const [students, setStudents] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [showEnroll, setShowEnroll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [report, setReport] = useState(null)

  useEffect(() => {
    fetchStudents()
    createParticles()
  }, [])

  useEffect(() => {
    if (activeTab === 'reports') fetchReport()
  }, [activeTab])

  useEffect(() => {
    if (!activeSession) return
    fetchAttendanceLogs()
    const channel = supabase
      .channel('attendance-changes')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'attendance_logs',
        filter: `session_id=eq.${activeSession.id}`
      }, () => fetchAttendanceLogs())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeSession])

  function createParticles() {
    const container = document.querySelector('.particles')
    if (!container) return
    container.innerHTML = ''
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      p.style.left = Math.random() * 100 + '%'
      p.style.animationDuration = (Math.random() * 10 + 8) + 's'
      p.style.animationDelay = (Math.random() * 10) + 's'
      p.style.width = p.style.height = (Math.random() * 3 + 1) + 'px'
      p.style.background = Math.random() > 0.5 ? 'var(--accent-primary)' : 'var(--accent-blue)'
      container.appendChild(p)
    }
  }

  async function fetchStudents() {
    setLoading(true)
    const { data } = await getAllStudents()
    setStudents(data)
    setLoading(false)
  }

  async function fetchAttendanceLogs() {
    if (!activeSession) return
    const { data } = await supabase
      .from('attendance_logs')
      .select('*, students(name, usn)')
      .eq('session_id', activeSession.id)
    setAttendanceLogs(data || [])
  }

  async function fetchReport() {
    const data = await getFullReport()
    setReport(data)
  }

  async function handleDeleteStudent(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this student? This will also delete all their attendance records.')) return
    await deleteStudentDB(id)
    fetchStudents()
  }

  const presentIds = attendanceLogs.map(l => l.student_id)
  const presentCount = presentIds.length
  const absentCount = students.length - presentCount
  const attendanceRate = students.length > 0
    ? Math.round((presentCount / students.length) * 100) : 0

  const tabs = [
    { id: 'dashboard', label: '🏠 Dashboard' },
    { id: 'students', label: '👥 Students' },
    { id: 'reports', label: '📊 Reports' },
  ]

  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="brand-icon">🎓</div>
          <div>
            <div className="brand-name">SMARTEND</div>
            <div className="brand-sub">HKBK College of Engineering</div>
          </div>
        </div>
        <div className="nav-actions">
          {/* TABS */}
          <div style={{
            display: 'flex', gap: '4px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '10px', padding: '4px'
          }}>
            {tabs.map(tab => (
              <button key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 16px', border: 'none',
                  borderRadius: '7px', cursor: 'pointer',
                  fontFamily: 'Rajdhani, sans-serif',
                  fontSize: '13px', fontWeight: '600',
                  letterSpacing: '1px', transition: 'all 0.2s',
                  background: activeTab === tab.id
                    ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === tab.id
                    ? 'white' : 'var(--text-secondary)'
                }}>{tab.label}</button>
            ))}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '10px', padding: '8px 16px'
          }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, var(--accent-primary), #ff8c6b)',
              borderRadius: '8px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '16px'
            }}>👤</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '1px' }}>
                {teacher?.name}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
                Teacher
              </div>
            </div>
          </div>
          {activeSession && (
            <div className="live-badge">
              <div className="live-dot" />Session Live
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setShowEnroll(true)}>
            + Enroll
          </button>
          <button className="btn btn-secondary" onClick={onLogout}>⏻ Logout</button>
        </div>
      </nav>

      <div className="dashboard">

        {/* STATS */}
        <div className="stats-grid">
          {[
            { icon: '👥', num: students.length, label: 'Total Students' },
            { icon: '✅', num: presentCount, label: 'Present Today' },
            { icon: '❌', num: absentCount, label: 'Absent Today' },
            { icon: '📊', num: attendanceRate + '%', label: 'Attendance Rate' },
          ].map((s, i) => (
            <div className="stat-box" key={i}>
              <span className="stat-icon">{s.icon}</span>
              <div className="stat-number">{s.num}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="main-grid">
            <SessionManager
              teacher={teacher}
              onSessionStart={setActiveSession}
              onSessionEnd={() => { setActiveSession(null); setAttendanceLogs([]) }}
            />
            <StudentGrid
              students={students}
              presentIds={presentIds}
              loading={loading}
              onDelete={handleDeleteStudent}
              onRefresh={fetchStudents}
            />
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div className="card">
            <div className="corner-deco tl" />
            <div className="corner-deco br" />
            <h2><span>👥</span> All Students — Full View</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'Rajdhani, sans-serif'
              }}>
                <thead>
                  <tr>
                    {['#', 'Name', 'USN', 'Department', 'Semester', 'Enrolled On'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontSize: '11px', letterSpacing: '2px',
                        color: 'var(--text-secondary)', textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} style={{ transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,77,46,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--accent-primary), #ff8c6b)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: '700', color: 'white'
                          }}>{s.name.charAt(0)}</div>
                          {s.name}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{s.usn}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{s.department}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{s.semester}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {new Date(s.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">👤</div>
                  <div className="empty-text">No students enrolled yet</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div>
            {!report ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                <div style={{ color: 'var(--text-secondary)', letterSpacing: '2px' }}>
                  Loading reports...
                </div>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px', marginBottom: '24px'
                }}>
                  {[
                    { icon: '👥', val: report.totalStudents, label: 'Total Students' },
                    { icon: '📋', val: report.totalSessions, label: 'Total Sessions' },
                    { icon: '✅', val: report.totalLogs, label: 'Total Attendances' },
                  ].map((s, i) => (
                    <div className="stat-box" key={i}>
                      <span className="stat-icon">{s.icon}</span>
                      <div className="stat-number">{s.val}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Sessions */}
                <div className="card" style={{ marginBottom: '24px' }}>
                  <div className="corner-deco tl" />
                  <div className="corner-deco br" />
                  <h2><span>📋</span> All Sessions</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Subject', 'Period', 'Teacher', 'Status', 'Date'].map(h => (
                            <th key={h} style={{
                              padding: '12px 16px', textAlign: 'left',
                              fontSize: '11px', letterSpacing: '2px',
                              color: 'var(--text-secondary)', textTransform: 'uppercase',
                              borderBottom: '1px solid var(--border)'
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.sessions.map((s, i) => (
                          <tr key={i}>
                            <td style={{ padding: '12px 16px', fontWeight: '600' }}>{s.subject}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{s.period}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--accent-blue)' }}>
                              {s.teachers?.name || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className={`badge ${s.is_active ? 'badge-present' : 'badge-absent'}`}>
                                {s.is_active ? '🟢 Active' : '🔴 Ended'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              {new Date(s.created_at).toLocaleDateString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.sessions.length === 0 && (
                      <div style={{
                        textAlign: 'center', padding: '32px',
                        color: 'var(--text-secondary)'
                      }}>No sessions yet</div>
                    )}
                  </div>
                </div>

                {/* Attendance Logs */}
                <div className="card">
                  <div className="corner-deco tl" />
                  <div className="corner-deco br" />
                  <h2><span>✅</span> Attendance Logs</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Student', 'USN', 'Subject', 'Period', 'Face', 'GPS', 'Time'].map(h => (
                            <th key={h} style={{
                              padding: '12px 16px', textAlign: 'left',
                              fontSize: '11px', letterSpacing: '2px',
                              color: 'var(--text-secondary)', textTransform: 'uppercase',
                              borderBottom: '1px solid var(--border)'
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.logs.map((l, i) => (
                          <tr key={i}>
                            <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                              {l.students?.name}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--accent-blue)', fontFamily: 'monospace' }}>
                              {l.students?.usn}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              {l.attendance_sessions?.subject}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              {l.attendance_sessions?.period}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {l.face_matched ? '✅' : '❌'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {l.gps_verified ? '✅' : '❌'}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              {new Date(l.marked_at).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.logs.length === 0 && (
                      <div style={{
                        textAlign: 'center', padding: '32px',
                        color: 'var(--text-secondary)'
                      }}>No attendance records yet</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showEnroll && (
        <EnrollModal
          onClose={() => setShowEnroll(false)}
          onEnrolled={fetchStudents}
          teacher={teacher}
        />
      )}
    </>
  )
}