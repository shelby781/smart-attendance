import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import * as faceapi from 'face-api.js'

export default function EnrollModal({ onClose, onEnrolled, teacher }) {
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
    try {
      setStatus('Loading AI models...')
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      setModelsLoaded(true)
      setStatus('')
    } catch (err) {
      console.error('Model loading error:', err)
      setStatus('❌ Failed to load AI models! ' + err.message)
    }
  }

  async function startCamera() {
    if (!name || !usn) {
      alert('Enter name and USN first!')
      return
    }
    setStep('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      setStatus('❌ Camera access denied!')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  async function captureFace() {
    setStatus('⚡ Detecting face...')
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

      setStatus('💾 Saving student...')
      const { error } = await supabase
        .from('students')
        .insert({
          name,
          usn: usn.toUpperCase(),
          face_descriptor: Array.from(detection.descriptor)
        })

      if (error) {
        if (error.code === '23505') {
          setStatus('❌ USN already exists!')
        } else {
          setStatus('❌ Error: ' + error.message)
        }
        return
      }

      stopCamera()
      setStatus('✅ Enrolled successfully!')
      setTimeout(() => {
        onEnrolled()
        onClose()
      }, 1500)

    } catch (err) {
      console.error('Face capture error:', err)
      setStatus('❌ Error capturing face!')
    }
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
              <p style={{
                color: status.includes('❌')
                  ? 'var(--danger)'
                  : 'var(--accent-primary)',
                marginBottom: '12px',
                letterSpacing: '1px',
                fontSize: '13px'
              }}>
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
              <button
                className="btn btn-danger"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'camera' && (
          <>
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
                marginBottom: '12px',
                textAlign: 'center',
                letterSpacing: '1px',
                fontSize: '13px'
              }}>
                {status}
              </p>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-success"
                onClick={captureFace}
                style={{ flex: 1 }}
              >
                📸 Capture Face
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  stopCamera()
                  setStep('form')
                }}
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