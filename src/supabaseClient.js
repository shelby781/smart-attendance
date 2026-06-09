import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jzrhvdixafzzngmcxswz.supabase.co'
const supabaseKey = 'sb_publishable_Jgpoftb713-F_GS724JLFg_x9QPdKfh'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ─── TEACHERS ──────────────────────────────────────────────
export async function loginTeacher(username, password) {
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .single()
  if (error || !data) return { success: false, message: 'Invalid credentials!' }
  return { success: true, teacher: data }
}

// ─── STUDENTS ──────────────────────────────────────────────
export async function getAllStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('name')
  return { data: data || [], error }
}

export async function getStudentByUSN(usn) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('usn', usn.toUpperCase())
    .single()
  return { data, error }
}

export async function createStudent(studentData) {
  const { data, error } = await supabase
    .from('students')
    .insert(studentData)
    .select()
    .single()
  return { data, error }
}

export async function updateStudent(id, updates) {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteStudent(id) {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)
  return { error }
}

// ─── SESSIONS ──────────────────────────────────────────────
export async function createSession(sessionData) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({ ...sessionData, expires_at: expiresAt })
    .select()
    .single()
  return { data, error }
}

export async function getActiveSession(token) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('qr_token', token)
    .eq('is_active', true)
    .single()
  return { data, error }
}

export async function endSession(id) {
  const { error } = await supabase
    .from('attendance_sessions')
    .update({ is_active: false })
    .eq('id', id)
  return { error }
}

export async function getAllSessions() {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*, teachers(name)')
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

// ─── ATTENDANCE ─────────────────────────────────────────────
export async function markAttendance(sessionId, studentId) {
  const { data, error } = await supabase
    .from('attendance_logs')
    .insert({
      session_id: sessionId,
      student_id: studentId,
      face_matched: true,
      gps_verified: true,
      status: 'present'
    })
    .select()
    .single()
  return { data, error }
}

export async function getAttendanceBySession(sessionId) {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*, students(name, usn)')
    .eq('session_id', sessionId)
  return { data: data || [], error }
}

export async function getAttendanceByStudent(studentId) {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*, attendance_sessions(subject, period, created_at)')
    .eq('student_id', studentId)
    .order('marked_at', { ascending: false })
  return { data: data || [], error }
}

export async function getStudentStats(studentId) {
  const { data: logs } = await getAttendanceByStudent(studentId)
  const { data: allSessions } = await getAllSessions()

  const subjectMap = {}
  allSessions?.forEach(s => {
    if (!subjectMap[s.subject]) {
      subjectMap[s.subject] = { total: 0, present: 0 }
    }
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

  return { subjectMap, totalClasses, totalPresent, overallPct, logs: logs || [] }
}

export async function clearStudentAttendance(studentId) {
  const { error } = await supabase
    .from('attendance_logs')
    .delete()
    .eq('student_id', studentId)
  return { error }
}

// ─── REPORTS ────────────────────────────────────────────────
export async function getFullReport() {
  const { data: students } = await getAllStudents()
  const { data: sessions } = await getAllSessions()
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('*, students(name, usn), attendance_sessions(subject, period)')

  return {
    students: students || [],
    sessions: sessions || [],
    logs: logs || [],
    totalStudents: students?.length || 0,
    totalSessions: sessions?.length || 0,
    totalLogs: logs?.length || 0
  }
}