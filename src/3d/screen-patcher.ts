/**
 * Screen Patcher — renders the game matrix to a canvas texture
 * and patches the screen_plane mesh material in the loaded GLB.
 *
 * Extracted from Needle Engine's BrickGameScreen.ts — no Needle imports.
 */

import * as THREE from 'three'
import { getBrickState, onBrickStateChange } from './state-bridge'

const CANVAS_W = 256
const CANVAS_H = 330
const COLS = 10
const ROWS = 20
const BLK = Math.floor(Math.min(CANVAS_W / COLS, CANVAS_H / ROWS))
const GRID_OX = Math.floor((CANVAS_W - COLS * BLK) / 2)
const GRID_OY = Math.floor((CANVAS_H - ROWS * BLK) / 2)

export function createScreenRenderer() {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')!

  const tex = new THREE.CanvasTexture(canvas)
  tex.flipY = true
  tex.repeat.x = -1
  tex.offset.x = 1
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.NearestFilter

  let material: THREE.MeshStandardMaterial | null = null

  function patchMesh(mesh: THREE.Mesh) {
    // 1. Generate missing UVs dynamically for the screen_plane
    if (!mesh.geometry.attributes.uv) {
      mesh.geometry.computeBoundingBox()
      const bbox = mesh.geometry.boundingBox!
      const size = new THREE.Vector3()
      bbox.getSize(size)
      const pos = mesh.geometry.attributes.position
      const uvs = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        // Map local X/Y to 0..1 UV space
        uvs[i * 2] = (x - bbox.min.x) / (size.x || 1)
        uvs[i * 2 + 1] = (y - bbox.min.y) / (size.y || 1)
      }
      mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    }

    // 2. Clone and apply material
    let mat: THREE.MeshStandardMaterial
    if (Array.isArray(mesh.material)) {
      mat = (mesh.material[0] as THREE.MeshStandardMaterial).clone()
    } else {
      mat = (mesh.material as THREE.MeshStandardMaterial).clone()
    }
    mat.map = tex
    mat.emissiveMap = tex
    mat.emissive.set(0.25, 0.35, 0.15)
    mat.emissiveIntensity = 0.4
    mat.roughness = 0.15
    mat.metalness = 0.0
    mat.needsUpdate = true
    mesh.material = mat
    material = mat
    console.log('[ScreenPatcher] Material patched & UVs generated on', mesh.name)
  }

  function drawReduxState() {
    const state = getBrickState()
    const c = ctx

    // Background — retro LCD green
    c.fillStyle = '#8ba870'
    c.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Grid border
    c.strokeStyle = '#3a4a30'
    c.lineWidth = 2
    c.strokeRect(GRID_OX - 1, GRID_OY - 1, COLS * BLK + 2, ROWS * BLK + 2)

    if (state.pause === 0) {
      // Title screen
      c.fillStyle = '#1a2a10'
      c.font = `bold ${BLK}px monospace`
      c.fillText('RETRO GAME', GRID_OX + 2, GRID_OY + (ROWS * BLK) / 2 - BLK * 2)
      c.font = `${BLK - 1}px monospace`
      const gameName = state.games[state.game]?.name?.toUpperCase() || 'TETRIS'
      c.fillText(gameName, GRID_OX + 4, GRID_OY + (ROWS * BLK) / 2)
      c.fillText('PRESS START', GRID_OX + 4, GRID_OY + (ROWS * BLK) / 2 + BLK * 2)
    } else {
      // Draw pixel matrix from React game layer
      const matrix = state.matrix
      c.fillStyle = '#1a2a10'
      if (matrix) {
        for (let r = 0; r < matrix.length; r++) {
          const row = matrix[r]
          for (let col = 0; col < row.length; col++) {
            const val = row[col]
            if (val !== 0) {
              c.fillRect(
                GRID_OX + col * BLK + 1,
                GRID_OY + r * BLK + 1,
                BLK - 2,
                BLK - 2
              )
            }
          }
        }
      }

      // HUD — score
      c.fillStyle = '#1a2a10'
      c.font = `bold ${BLK - 1}px monospace`
      const score = state.games[state.game]?.score ?? 0
      c.fillText(`SCR:${score}`, GRID_OX, GRID_OY - 4)
    }

    tex.needsUpdate = true
  }

  // Subscribe to Redux changes — redraw every frame
  onBrickStateChange(drawReduxState)

  // Initial draw
  drawReduxState()

  return { patchMesh, drawReduxState, tex }
}
