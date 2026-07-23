/**
 * Main Entry — boots the React game overlay and initializes
 * the 8th Wall + Three.js 3D scene.
 *
 * iOS Safari Fix: Uses the official `xrloaded` + `xrextrasloaded` events
 * instead of polling `window.XR8`, which can miss the engine on iOS
 * where async scripts have different timing behaviour.
 */

// Boot React game overlay (renders into #react-root)
import './react-game/index.jsx'

console.log('[Main] Brick 8th Wall — starting up')

/**
 * Wait for both XR8 and XRExtras to be ready using the official
 * 8th Wall events. This is the recommended pattern for iOS Safari
 * where `setTimeout` polling can race with Safari's script scheduler.
 */
function waitForEngines(): Promise<void> {
  return new Promise((resolve) => {
    const w = window as any

    let xr8Ready = !!w.XR8
    let extrasReady = !!w.XRExtras

    const tryResolve = () => {
      if (xr8Ready && extrasReady) {
        console.log('[Main] XR8 + XRExtras both loaded')
        resolve()
      }
    }

    if (!xr8Ready) {
      window.addEventListener('xrloaded', () => {
        console.log('[Main] xrloaded event fired')
        xr8Ready = true
        tryResolve()
      }, { once: true })
    }

    if (!extrasReady) {
      window.addEventListener('xrextrasloaded', () => {
        console.log('[Main] xrextrasloaded event fired')
        extrasReady = true
        tryResolve()
      }, { once: true })
    }

    // If both were already loaded synchronously (unlikely with async scripts)
    tryResolve()

    // Safety timeout — if events never fire after 15s, check again and proceed
    setTimeout(() => {
      if (!xr8Ready || !extrasReady) {
        console.warn('[Main] Timed out waiting for 8th Wall engines. XR8:', !!w.XR8, 'XRExtras:', !!w.XRExtras)
        // Last-chance check (scripts may have loaded without firing events)
        if (w.XR8) xr8Ready = true
        if (w.XRExtras) extrasReady = true
        if (xr8Ready && extrasReady) {
          tryResolve()
        } else {
          // Show error to user
          const statusEl = document.getElementById('splash-status')
          if (statusEl) statusEl.innerText = 'Error: AR engine failed to load. Check your connection and reload.'
        }
      }
    }, 15000)
  })
}

async function boot() {
  await waitForEngines()

  // Dynamically import the game loop only after engines are confirmed loaded
  const { initGameLoop } = await import('./3d/game-loop.ts')
  initGameLoop()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
