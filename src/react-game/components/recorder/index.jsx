import React, { useState, useRef, useCallback, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import style from './index.module.less'

const MAX_DURATION_S = 60

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',             // Safari iOS natively records MP4 (AVC1)
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

const Recorder = () => {
  const [status, setStatus] = useState('IDLE')
  const [countdown, setCountdown] = useState(3)
  const [recordTime, setRecordTime] = useState(0)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [progress, setProgress] = useState(0) // Transcoding progress

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const rafRef = useRef(null)
  const compCanvasRef = useRef(null)
  const compCtxRef = useRef(null)
  const isRecordingRef = useRef(false)
  const ffmpegRef = useRef(null)

  // Initialize FFmpeg on mount
  useEffect(() => {
    const initFFmpeg = async () => {
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg
      
      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100))
      })

      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message)
      })

      // Load lightweight non-SharedArrayBuffer core from unpkg for maximum mobile compatibility
      try {
        await ffmpeg.load({
          coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
          wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
        })
        console.log('[Recorder] FFmpeg core loaded')
      } catch (err) {
        console.warn('[Recorder] FFmpeg failed to preload:', err)
      }
    }
    initFFmpeg()
  }, [])

  const compositeFrame = useCallback(() => {
    const feed = document.getElementById('camerafeed')
    const overlay = document.getElementById('threejs-overlay')
    const ctx = compCtxRef.current
    const comp = compCanvasRef.current
    
    if (!feed || !ctx || !comp) return

    const MAX_WIDTH = 720
    const scale = Math.min(1, MAX_WIDTH / feed.width)
    // IMPORTANT: libx264 strictly requires width and height to be divisible by 2!
    const targetW = Math.floor((feed.width * scale) / 2) * 2
    const targetH = Math.floor((feed.height * scale) / 2) * 2

    if (comp.width !== targetW || comp.height !== targetH) {
      comp.width = targetW
      comp.height = targetH
    }

    ctx.clearRect(0, 0, comp.width, comp.height)
    ctx.drawImage(feed, 0, 0, comp.width, comp.height)
    if (overlay) {
      ctx.drawImage(overlay, 0, 0, comp.width, comp.height)
    }

    if (isRecordingRef.current) {
      rafRef.current = requestAnimationFrame(compositeFrame)
    }
  }, [])

  const startCountdown = useCallback(() => {
    setStatus('COUNTDOWN')
    setCountdown(3)
    let count = 3
    const interval = setInterval(() => {
      count -= 1
      if (count > 0) {
        setCountdown(count)
      } else {
        clearInterval(interval)
        startRecording()
      }
    }, 1000)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      if (!compCanvasRef.current) {
        compCanvasRef.current = document.createElement('canvas')
        compCtxRef.current = compCanvasRef.current.getContext('2d')
      }

      const canvasStream = compCanvasRef.current.captureStream(30)

      let micStream = null
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      } catch (e) {
        console.warn('[Recorder] Mic access denied')
      }

      const tracks = [...canvasStream.getVideoTracks()]
      if (micStream) micStream.getAudioTracks().forEach((t) => tracks.push(t))
      const combinedStream = new MediaStream(tracks)

      const mimeType = pickMimeType()
      const options = { videoBitsPerSecond: 2_500_000 }
      if (mimeType) options.mimeType = mimeType

      const recorder = new MediaRecorder(combinedStream, options)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        if (micStream) micStream.getTracks().forEach((t) => t.stop())
        setStatus('PROCESSING')
        setProgress(0)

        try {
          const rawBlob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
          const isMp4 = mimeType && mimeType.includes('mp4')
          let finalBlob = rawBlob

          // Safari natively records MP4, so we skip the massive CPU overhead of FFmpeg.
          // Android Chrome records WebM, which WhatsApp rejects, so we transcode it.
          if (!isMp4) {
            console.log('[Recorder] Transcoding WebM to MP4...')
            const ffmpeg = ffmpegRef.current
            if (!ffmpeg.loaded) {
              await ffmpeg.load({
                coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
                wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
              })
            }

            await ffmpeg.writeFile('input.webm', await fetchFile(rawBlob))
            // Encode using ultrafast preset for mobile CPU limits
            await ffmpeg.exec(['-i', 'input.webm', '-preset', 'ultrafast', '-c:v', 'libx264', '-c:a', 'aac', '-b:v', '2500k', 'output.mp4'])
            
            const data = await ffmpeg.readFile('output.mp4')
            finalBlob = new Blob([data.buffer], { type: 'video/mp4' })
          }

          const url = URL.createObjectURL(finalBlob)
          setVideoBlob(finalBlob)
          setVideoUrl(url)
          setStatus('POPUP')
        } catch (err) {
          console.error('[Recorder] Processing failed:', err)
          alert("Video processing failed. Please try again.")
          setStatus('IDLE')
        }
      }

      recorder.onerror = (e) => {
        console.error('[Recorder] MediaRecorder error:', e)
        if (micStream) micStream.getTracks().forEach((t) => t.stop())
        setStatus('IDLE')
      }

      recorderRef.current = recorder

      setStatus('RECORDING')
      isRecordingRef.current = true
      setRecordTime(0)
      compositeFrame()
      
      setTimeout(() => {
        if (isRecordingRef.current) recorder.start(1000) 
      }, 100)

      timerRef.current = setInterval(() => {
        setRecordTime((prev) => {
          if (prev >= MAX_DURATION_S - 1) {
            stopRecording()
            return MAX_DURATION_S
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      console.error('[Recorder] Failed to start recording:', err)
      setStatus('IDLE')
      isRecordingRef.current = false
    }
  }, [compositeFrame])

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false
    clearInterval(timerRef.current)
    cancelAnimationFrame(rafRef.current)

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      setStatus('PROCESSING')
      recorderRef.current.stop()
    } else {
      setStatus('IDLE')
    }
  }, [])

  const handleShare = useCallback(async () => {
    if (!videoBlob) return
    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm'
    const file = new File([videoBlob], `RetroAR_Gameplay.${ext}`, { type: videoBlob.type })
    const shareData = {
      files: [file],
      title: 'Retro AR Tetris',
      text: '🕹️ Playing the ultimate Retro AR Brick Game! #AR #RetroGaming #Tetris #8thWall',
    }

    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.warn('[Recorder] Share cancelled or failed:', err)
      }
    } else {
      alert("Native social sharing (Files) is not supported on this browser/OS. Please use the 'Save to Gallery' button instead and upload manually.")
    }
  }, [videoBlob])

  const handleSave = useCallback(() => {
    if (!videoUrl) return
    const ext = videoBlob?.type?.includes('mp4') ? 'mp4' : 'webm'
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `RetroAR_${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [videoUrl, videoBlob])

  const closePopup = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setVideoBlob(null)
    setStatus('IDLE')
  }, [videoUrl])

  return (
    <>
      <div className={style.recorderWrapper}>
        {status === 'IDLE' && (
          <button className={style.recordBtn} onClick={startCountdown}>
            <div className={style.redCircle}></div>
            <span>REC</span>
          </button>
        )}

        {status === 'COUNTDOWN' && (
          <div className={style.countdownText}>{countdown}</div>
        )}

        {status === 'RECORDING' && (
          <button className={`${style.recordBtn} ${style.recordingBtn}`} onClick={stopRecording}>
            <div className={style.redSquare}></div>
            <span>00:{recordTime.toString().padStart(2, '0')}</span>
          </button>
        )}

        {status === 'PROCESSING' && (
          <div className={style.processingText}>Processing... {progress}%</div>
        )}
      </div>

      {status === 'POPUP' && (
        <div className={style.popupOverlay}>
          <div className={style.popupContent}>
            <h3>Share Your Gameplay</h3>
            <video src={videoUrl} controls autoPlay loop muted playsInline className={style.previewVideo} />
            
            <div className={style.actionButtons}>
              <button className={style.shareBtn} onClick={handleShare}>
                📱 Share (Insta, TikTok, WA, X)
              </button>
              <button className={style.saveBtn} onClick={handleSave}>
                💾 Save to Gallery
              </button>
              <button className={style.closeBtn} onClick={closePopup}>
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Recorder
