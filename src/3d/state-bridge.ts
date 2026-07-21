/**
 * State Bridge — decouples the React game layer from the 3D rendering layer.
 *
 * React writes:  window.__BRICK_MATRIX__  (pixel grid)
 *                window.__BRICK_REDUX__   (score, pause, game, games)
 *
 * 3D reads:      getBrickState()
 *                onBrickStateChange(cb)  — fires on every Redux store change
 */

import store from '../react-game/store/index.jsx'

export interface BrickState {
  matrix: number[][] | null
  pause: number
  game: number
  games: { name: string; score: number }[]
  music: boolean
}

let _listeners: (() => void)[] = []

export function getBrickState(): BrickState {
  const w = window as any
  const s = store.getState()
  return {
    matrix: w.__BRICK_MATRIX__ ?? null,
    pause: s.pause,
    game: s.game,
    games: s.games,
    music: s.music,
  }
}

export function onBrickStateChange(cb: () => void): () => void {
  _listeners.push(cb)
  return () => {
    _listeners = _listeners.filter((fn) => fn !== cb)
  }
}

// Subscribe to Redux store changes and notify 3D layer
store.subscribe(() => {
  for (const fn of _listeners) fn()
})
