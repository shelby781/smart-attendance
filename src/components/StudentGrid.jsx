import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function StudentGrid({ students, presentIds, loading, onDelete }) {
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [editStudent, setEditStudent] = useState(null)

  if (loading) return (
    <div className="card">
      <h2><span>👥</span> Students</h2>
      <div className="empty-state">
        <div className="empty-icon">⏳</div>
        <div className="empty-text">Loading...</div>
      </div>
    </div>
  )

  return (
    <>
      <div className="card">
        <div className="corner-deco tl" />
        <div className="corner-deco br" />
        <h2><span>👥</span> Students ({students.length})</h2>

        {students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <div className="empty-text">No students enrolled yet</div>
          </div>
        ) : (
          <div className="students-list">
            {students.map((student, i) => {
              const isPresent = presentIds.includes(student.id)
              return (
                <div
                  key={student.id}
                  className="student-item"
                  style={{ animationDelay: i * 0.05 + 's' }}
                  onClick={() => setSelectedStudent(student)}
                >
                  <div className="student-avatar">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="student-info">
                    <div className="student-name">{student.name}</div>
                    <div className="student-usn">{student.usn}</div>
                  </div>
                  <div className="student-actions">
                    <span className={`badge ${isPresent ? 'badge-present' : 'badge-absent'}`}>
                      {isPresent ? '✅ Present' : '❌ Absent'}
                    </span>
                    <button
                      className="delete-btn"
                      title="Edit"
                      onClick={e => { e.stopPropagation(); setEditStudent(student) }}
                      style={{ color: 'var(--accent-blue)', borderColor: 'var(--accent-blue)' }}
                    >✏️</button>
                    <button
                      className="delete-btn"
                      title="Delete"
                      onClick={e => onDelete(student.id, e)}
                    >🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedStudent && (
        <ProfileModal
          student={selectedStudent}
          isPresent={presentIds.includes(selectedStudent.id)}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {editStudent && (
        <EditStudentModal
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onSaved={() => { setEditStudent(null); window.location.reload() }}
        />
      )}
    </>
  )
}

function ProfileModal({ student, isPresent, onClose }) {
  const [attendanceData, setAttendanceData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAttendance() }, [])

  async function loadAttendance() {
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*, attendance_sessions(subject, period, created_at)')
      .eq('student_id', student.id)

    const { data: allSessions } = await supabase
      .from('attendance_sessions').select('id, subject')

    const subjectMap = {}
    allSessions?.forEach(s => {
      if (!subjectMap[s.subject]) subjectMap[s.subject] = { total: 0, present: 0 }
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

    setAttendanceData({ subjectMap, totalClasses, totalPresent, overallPct, logs: logs || [] })
    setLoading(false)
  }

  const pct = attendanceData?.overallPct || 0
  const isSafe = pct >= 75
  const offset = 440 - (pct / 100) * 440

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="corner-deco tl" />
        <div className="corner-deco br" />

        <div className="profile-avatar-large">
          {student.name.charAt(0).toUpperCase()}
        </div>

        <h2 style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: '18px',
          textAlign: 'center', marginBottom: '4px', letterSpacing: '2px'
        }}>{student.name}</h2>
        <p style={{
          textAlign: 'center', color: 'var(--text-secondary)',
          fontSize: '12px', letterSpacing: '3px', marginBottom: '16px'
        }}>{student.usn}</p>

        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span className={`badge ${isPresent ? 'badge-present' : 'badge-absent'}`}>
            {isPresent ? '✅ Present Today' : '❌ Absent Today'}
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading attendance...
          </div>
        ) : (
          <>
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
                  {pct}%
                </span>
                <span className="ring-label">Attendance</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div className={`attendance-status ${isSafe ? 'status-safe' : 'status-danger'}`}>
                {isSafe ? '✅ Safe — Above 75%' : '⚠️ Danger — Below 75%'}
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '10px', marginBottom: '20px'
            }}>
              {[
                { label: 'Total Classes', val: attendanceData.totalClasses },
                { label: 'Attended', val: attendanceData.totalPresent },
                { label: 'Today Status', val: isPresent ? 'Present' : 'Absent' },
                { label: 'Required', val: '75%' },
              ].map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '14px', textAlign: 'center'
                }}>
                  <div style={{
                    fontFamily: 'Orbitron, sans-serif', fontSize: '18px',
                    fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '4px'
                  }}>{item.val}</div>
                  <div style={{
                    fontSize: '10px', letterSpacing: '1px',
                    color: 'var(--text-secondary)', textTransform: 'uppercase'
                  }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Subject wise */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '11px', letterSpacing: '2px',
                color: 'var(--text-secondary)', textTransform: 'uppercase',
                marginBottom: '12px'
              }}>Subject-wise</div>
              {Object.entries(attendanceData.subjectMap).map(([subj, data]) => {
                const p = data.total > 0
                  ? Math.round((data.present / data.total) * 100) : 0
                return (
                  <div key={subj} style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                        {subj}
                      </span>
                      <span style={{
                        fontSize: '12px', fontWeight: '700',
                        color: p >= 75 ? 'var(--success)' : 'var(--danger)'
                      }}>{p}%</span>
                    </div>
                    <div style={{
                      width: '100%', height: '4px',
                      background: 'rgba(255,255,255,0.05)', borderRadius: '2px'
                    }}>
                      <div style={{
                        height: '100%', width: `${p}%`,
                        background: p >= 75 ? 'var(--success)' : 'var(--danger)',
                        borderRadius: '2px',
                        transition: 'width 1.5s ease'
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <button
          className="btn btn-primary"
          onClick={onClose}
          style={{ width: '100%' }}
        >Close Profile</button>
      </div>
    </div>
  )
}

function EditStudentModal({ student, onClose, onSaved }) {
  const [name, setName] = useState(student.name)
  const [usn, setUsn] = useState(student.usn)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('students')
      .update({ name, usn: usn.toUpperCase() })
      .eq('id', student.id)
    setSaving(false)
    if (error) { setStatus('❌ Error saving!'); return }
    setStatus('✅ Saved!')
    setTimeout(onSaved, 1000)
  }

  async function clearAttendance() {
    if (!confirm('Clear ALL attendance for this student?')) return
    await supabase
      .from('attendance_logs')
      .delete()
      .eq('student_id', student.id)
    setStatus('✅ Attendance cleared!')
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="corner-deco tl" />
        <div className="corner-deco br" />
        <h2>✏️ Edit Student</h2>

        <label style={{
          fontSize: '11px', letterSpacing: '2px',
          color: 'var(--text-secondary)', textTransform: 'uppercase',
          display: 'block', marginBottom: '8px'
        }}>Full Name</label>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <label style={{
          fontSize: '11px', letterSpacing: '2px',
          color: 'var(--text-secondary)', textTransform: 'uppercase',
          display: 'block', marginBottom: '8px'
        }}>USN</label>
        <input
          className="input"
          value={usn}
          onChange={e => setUsn(e.target.value)}
        />

        {status && (
          <div style={{
            color: 'var(--accent-primary)', fontSize: '13px',
            letterSpacing: '1px', marginBottom: '12px'
          }}>{status}</div>
        )}

        <button
          className="btn btn-danger"
          onClick={clearAttendance}
          style={{ width: '100%', marginBottom: '10px' }}
        >🗑 Clear All Attendance</button>

        <div className="modal-actions">
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={saving}
            style={{ flex: 1 }}
          >{saving ? 'Saving...' : '💾 Save Changes'}</button>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >Cancel</button>
        </div>
      </div>
    </div>
  )
}