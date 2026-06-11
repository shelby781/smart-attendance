const { get } = require('node:https')
const { createWriteStream, mkdirSync, statSync } = require('node:fs')
const { join } = require('node:path')

const BASE = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/'
const OUT = join(process.cwd(), 'public', 'models')

mkdirSync(OUT, { recursive: true })

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
]

FILES.forEach(file => {
  const dest = join(OUT, file)
  const stream = createWriteStream(dest)
  get(BASE + file, res => {
    res.pipe(stream)
    stream.on('finish', () => {
      const size = statSync(dest).size
      console.log(`✅ ${file} — ${size} bytes`)
    })
  }).on('error', err => {
    console.error(`❌ ${file}: ${err.message}`)
  })
})