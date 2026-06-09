import { useState } from 'react'
import { loginTeacher } from '../supabaseClient'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleLogin() {
    if (!username || !password) {
      setError('Please enter username and password!')
      return
    }
    setLoading(true)
    setError('')
    const result = await loginTeacher(username, password)
    if (result.success) {
      onLogin(result.teacher)
    } else {
      setError(result.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative', zIndex: 1
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '24px', padding: '48px 40px',
        width: '100%', maxWidth: '440px',
        position: 'relative', overflow: 'hidden',
        animation: 'modal-in 0.6s cubic-bezier(0.34,1.56,0.64,1)'
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '3px',
          background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-blue))'
        }} />
        <div className="corner-deco tl" />
        <div className="corner-deco br" />

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '72px', height: '72px',
            background: 'linear-gradient(135deg, var(--accent-primary), #ff8c6b)',
            borderRadius: '20px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', margin: '0 auto 16px',
            boxShadow: '0 8px 30px var(--accent-glow)',
            animation: 'avatar-glow 2s ease infinite alternate'
          }}>🎓</div>
          <div style={{
            fontFamily: 'Orbitron, sans-serif', fontSize: '22px',
            fontWeight: '700', letterSpacing: '4px',
            background: 'linear-gradient(90deg, #fff, var(--accent-primary))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '6px'
          }}>SMARTEND</div>
          <div style={{
            fontSize: '11px', letterSpacing: '3px',
            color: 'var(--text-secondary)', textTransform: 'uppercase'
          }}>Teacher Portal — HKBK College</div>
        </div>

        <label style={{
          fontSize: '11px', letterSpacing: '2px',
          color: 'var(--text-secondary)', textTransform: 'uppercase',
          display: 'block', marginBottom: '8px'
        }}>Username</label>
        <input
          className="input"
          placeholder="Enter username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        <label style={{
          fontSize: '11px', letterSpacing: '2px',
          color: 'var(--text-secondary)', textTransform: 'uppercase',
          display: 'block', marginBottom: '8px', marginTop: '4px'
        }}>Password</label>
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <input
            className="input"
            type={showPass ? 'text' : 'password'}
            placeholder="Enter password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ marginBottom: 0, paddingRight: '48px' }}
          />
          <button onClick={() => setShowPass(!showPass)} style={{
            position: 'absolute', right: '14px', top: '12px',
            background: 'none', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px'
          }}>{showPass ? '🙈' : '👁'}</button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,77,46,0.08)',
            border: '1px solid rgba(255,77,46,0.3)',
            borderRadius: '10px', padding: '12px 16px',
            color: 'var(--accent-primary)', fontSize: '13px',
            letterSpacing: '1px', marginBottom: '16px', textAlign: 'center'
          }}>{error}</div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={loading}
          style={{ width: '100%', padding: '14px', fontSize: '15px' }}
        >{loading ? '⚡ Authenticating...' : '🔐 Login to Dashboard'}</button>

        <div style={{
          marginTop: '24px', padding: '16px',
          background: 'rgba(77,159,255,0.05)',
          border: '1px solid var(--border-blue)', borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '11px', letterSpacing: '2px',
            color: 'var(--accent-blue)', marginBottom: '8px',
            textTransform: 'uppercase'
          }}>Demo Credentials</div>
          <div style={{
            fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8'
          }}>
            Username: <span style={{ color: 'var(--text-primary)' }}>teacher1</span><br />
            Password: <span style={{ color: 'var(--text-primary)' }}>hkbk@123</span>
          </div>
        </div>
      </div>
    </div>
  )
}