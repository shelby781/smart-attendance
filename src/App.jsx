import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import ScanPage from './pages/ScanPage'
import LoginPage from './components/LoginPage'
import './index.css'

function App() {
  const [teacher, setTeacher] = useState(null)

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <>
            <div className="loader-overlay">
              <div className="loader-logo">SMARTEND</div>
              <div className="loader-bar-wrap">
                <div className="loader-bar" />
              </div>
              <div className="loader-text">Initializing System...</div>
            </div>
            <div className="particles" />
            {!teacher
              ? <LoginPage onLogin={setTeacher} />
              : <Dashboard teacher={teacher} onLogout={() => setTeacher(null)} />
            }
          </>
        } />
        <Route path="/scan/:token" element={<ScanPage />} />
      </Routes>
    </Router>
  )
}

export default App