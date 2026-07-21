/**
 * Main Entry — boots the React game overlay and initializes
 * the 8th Wall + Three.js 3D scene.
 */

// Boot React game overlay (renders into #react-root)
import './react-game/index.jsx'

console.log('[Main] Brick 8th Wall — starting up')

// Wait for 8th Wall engine to be ready
const waitForXR = () => {
  if (typeof (window as any).XR8 !== 'undefined') {
    console.log('[Main] XR8 engine loaded')

    // Initialize 3D scene + image tracking
    import('./3d/game-loop.ts').then(({ initGameLoop }) => {
      initGameLoop()
    })
    return
  }
  setTimeout(waitForXR, 100)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForXR)
} else {
  waitForXR()
}
