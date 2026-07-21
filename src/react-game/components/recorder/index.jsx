import React, { useState, useEffect, useRef } from 'react'
import style from './index.module.less'

const Recorder = () => {
  const [status, setStatus] = useState('IDLE') // IDLE, COUNTDOWN, RECORDING, PROCESSING, POPUP
  const [countdown, setCountdown] = useState(3)
  const [recordTime, setRecordTime] = useState(0)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    // Configure 8th Wall Media Recorder on mount
    if (window.XR8 && window.XR8.MediaRecorder) {
      window.XR8.MediaRecorder.configure({
        maxDurationMs: 60000, // 60s max
        enableEndCard: false,
        requestMic: window.XR8.MediaRecorder.RequestMicOptions.AUTO,
        onRecordComplete: (blob) => {
          console.log('[Recorder] Record complete, blob size:', blob.size)
          const url = URL.createObjectURL(blob)
          setVideoBlob(blob)
          setVideoUrl(url)
          setStatus('POPUP')
        },
      })
    }
  }, [])

  const startCountdown = () => {
    if (!window.XR8 || !window.XR8.MediaRecorder) {
      alert("AR Recorder not ready yet.")
      return
    }
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
  }

  const startRecording = () => {
    setStatus('RECORDING')
    setRecordTime(0)
    window.XR8.MediaRecorder.recordVideo()

    timerRef.current = setInterval(() => {
      setRecordTime((prev) => {
        if (prev >= 59) {
          stopRecording()
          return 60
        }
        return prev + 1
      })
    }, 1000)
  }

  const stopRecording = () => {
    if (status !== 'RECORDING') return
    setStatus('PROCESSING')
    clearInterval(timerRef.current)
    window.XR8.MediaRecorder.stopRecordVideo() // stops and triggers onRecordComplete
  }

  const handleShare = async () => {
    if (!videoBlob) return
    const file = new File([videoBlob], "RetroAR_Gameplay.mp4", { type: videoBlob.type })
    const shareData = {
      files: [file],
      title: 'Retro AR Tetris',
      text: 'Playing the ultimate Retro AR Brick Game! #AR #RetroGaming #Tetris',
    }

    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.error('Error sharing', err)
      }
    } else {
      alert("Native sharing not supported on this device. Use the Save button.")
    }
  }

  const handleSave = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `RetroAR_${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const closePopup = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl) // free memory
    setVideoUrl(null)
    setVideoBlob(null)
    setStatus('IDLE')
  }

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
                📱 Share (Insta, TikTok, WA)
              </button>
              <button className={style.saveBtn} onClick={handleSave}>
                💾 Save to Gallery
              </button>
              <button className={style.closeBtn} onClick={closePopup}>
                ❌ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Recorder
