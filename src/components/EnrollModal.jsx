import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import * as faceapi from 'face-api.js'

export default function EnrollModal({ onClose, onEnrolled }) {
  const [name, setName] = useState('')
  const [usn, setUsn] = useState('')
  const [step, setStep] = useState('form')
  const [status, setStatus] = useState('')
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    loadModels()
    return () => stopCamera()
  }, [])

  async function loadModels() {
    setStatus('Loading AI models...')
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
    setModelsLoaded(true)
    setStatus('')
  }

  async function startCamera() {
    if (!name || !usn) { alert('Enter name and USN first!'); return }
    setStep('camera')
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  async function captureFace() {
    setStatus('⚡ Detecting face...')
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks().withFaceDescriptor()

    if (!detection) { setStatus('❌ No face detected! Try again.'); return }

    setStatus('💾 Saving student...')
    const { error } = await supabase.from('students').insert({
      name, usn: usn.toUpperCase(),
      face_descriptor: Array.from(detection.descriptor)
    })

    if (error) {
      setStatus(error.code === '23505' ? '❌ USN already exists!' : '❌ Error saving!')
      return
    }

    stopCamera()
    setStatus('✅ Enrolled successfully!')
    setTimeout(() => { onEnrolled(); onClose() }, 1500)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="corner-deco tl" />
        <div className="corner-deco br" />
        <h2>👤 Enroll Student</h2>

        {step === 'form' && (
          <>
            <input
              className="input"
              placeholder="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="input"
              placeholder="USN (e.g. 1HKBK25CS212)"
              value={usn}
              onChange={e => setUsn(e.target.value)}
            />
            {status && (
              <p style={{ color: 'var(--accent-primary)', marginBottom: '12px', letterSpacing: '1px' }}>
                {status}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={startCamera}
                disabled={!modelsLoaded}
                style={{ flex: 1 }}
              >
                {modelsLoaded ? '📷 Open Camera' : '⏳ Loading AI...'}
              </button>
              <button className="btn btn-danger" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'camera' && (
          <>
            <video
              ref={videoRef}
              autoPlay muted
              style={{
                width: '100%', borderRadius: '16px',
                marginBottom: '16px', transform: 'scaleX(-1)',
                border: '1px solid var(--border)'
              }}
            />
            {status && (
              <p style={{
                color: 'var(--accent-primary)', marginBottom: '12px',
                textAlign: 'center', letterSpacing: '1px'
              }}>
                {status}
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-success" onClick={captureFace} style={{ flex: 1 }}>
                📸 Capture Face
              </button>
              <button
                className="btn btn-danger"
                onClick={() => { stopCamera(); setStep('form') }}
                style={{ flex: 1 }}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}