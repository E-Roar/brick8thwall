import React, { useState, useRef, useCallback, useEffect } from 'react'
import style from './index.module.less'

/**
 * AR Video Recorder — uses native MediaRecorder API to capture the
 * composited AR scene (camera feed + Three.js overlay) with optional
 * microphone audio. Works on Android Chrome and Safari iOS 14.5+.
 *
 * Architecture: An offscreen canvas composites #camerafeed and
 * #threejs-overlay each frame via captureStream(). This avoids any
 * dependency on 8th Wall's paid MediaRecorder module.
 */

const MAX_DURATION_S = 60

// Pick a codec that the browser actually supports
function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',             // Safari iOS
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return '' // let the browser pick
}

const Recorder = () => {
  const [status, setStatus] = useState('IDLE')
  const [countdown, setCountdown] = useState(3)
  const [recordTime, setRecordTime] = useState(0)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const rafRef = useRef(null)
  const compCanvasRef = useRef(null)
  const compCtxRef = useRef(null)
  const isRecordingRef = useRef(false)

  // Composite both AR canvases onto an offscreen canvas each frame
  const compositeFrame = useCallback(() => {
    const feed = document.getElementById('camerafeed')
    const overlay = document.getElementById('threejs-overlay')
    const ctx = compCtxRef.current
    const comp = compCanvasRef.current
    
    if (!feed || !ctx || !comp) return

    // Match dimensions to feed canvas (the AR camera source)
    if (comp.width !== feed.width || comp.height !== feed.height) {
      comp.width = feed.width
      comp.height = feed.height
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
      // 1. Create offscreen composite canvas
      if (!compCanvasRef.current) {
        compCanvasRef.current = document.createElement('canvas')
        compCtxRef.current = compCanvasRef.current.getContext('2d')
      }

      // 2. Get video stream from composite canvas (30fps for perf)
      const canvasStream = compCanvasRef.current.captureStream(30)

      // 3. Try to get mic audio (non-blocking — silently skip if denied)
      let micStream = null
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      } catch (e) {
        console.warn('[Recorder] Mic access denied or unavailable, recording without audio')
      }

      // 4. Combine streams
      const tracks = [...canvasStream.getVideoTracks()]
      if (micStream) {
        micStream.getAudioTracks().forEach((t) => tracks.push(t))
      }
      const combinedStream = new MediaStream(tracks)

      // 5. Create MediaRecorder
      const mimeType = pickMimeType()
      const options = { videoBitsPerSecond: 2_500_000 } // 2.5 Mbps — good quality, fast encode
      if (mimeType) options.mimeType = mimeType

      const recorder = new MediaRecorder(combinedStream, options)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        // Stop mic tracks to release hardware
        if (micStream) micStream.getTracks().forEach((t) => t.stop())

        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
        console.log('[Recorder] Recording complete, size:', (blob.size / 1024 / 1024).toFixed(2), 'MB')
        const url = URL.createObjectURL(blob)
        setVideoBlob(blob)
        setVideoUrl(url)
        setStatus('POPUP')
      }

      recorder.onerror = (e) => {
        console.error('[Recorder] MediaRecorder error:', e)
        if (micStream) micStream.getTracks().forEach((t) => t.stop())
        setStatus('IDLE')
      }

      recorderRef.current = recorder

      // 6. Start compositing frames and recording
      setStatus('RECORDING')
      isRecordingRef.current = true
      setRecordTime(0)
      compositeFrame()
      
      // Small delay to let first frame render before starting encoder
      setTimeout(() => {
        if (isRecordingRef.current) recorder.start(1000) 
      }, 100)

      // 7. Timer
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
      // Fallback: just download
      handleSave()
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
          <div className={style.processingText}>Processing...</div>
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
