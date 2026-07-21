/**
 * Main Entry — boots the React game overlay and initializes
 * the 8th Wall + Three.js 3D scene.
 *
 * No Needle Engine imports — clean 8th Wall project.
 */

// Boot React game overlay (renders into #react-root)
import './react-game/index.jsx'

// Initialize 3D scene + image tracking
import { initGameLoop } from './3d/game-loop'

console.log('[Main] Brick 8th Wall — starting up')

// Wait for8th Wall engine to be ready
const waitForXR = () => {
  if (typeof (window as any).XR8 !== 'undefined') {
    console.log('[Main] XR8 engine loaded')
    initGameLoop()
    return
  }
  // Check again in 100ms
  setTimeout(waitForXR, 100)
}

// Start checking once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForXR)
} else {
  waitForXR()
}
