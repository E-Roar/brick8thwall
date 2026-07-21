/**
 * Game Loop — sets up Three.js scene, loads the GLB model,
 * handles 8th Wall image tracking events, and runs the render loop.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createScreenRenderer } from './screen-patcher'

// Image target — runtime processing (no CLI-generated metadata needed)
const IMAGE_TARGET_NAME = 'mural'
const IMAGE_TARGET_SRC = './assets/mural.png'
const IMAGE_TARGET_UUID = 'mural-8thwall-target'

export function initGameLoop() {
  // ── Three.js Setup ──────────────────────────────────────────────
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.01,
    1000
  )
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  document.body.appendChild(renderer.domElement)

  // Position renderer canvas above camera feed
  renderer.domElement.style.position = 'fixed'
  renderer.domElement.style.top = '0'
  renderer.domElement.style.left = '0'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.zIndex = '1'
  renderer.domElement.style.pointerEvents = 'none'

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(0, 5, 5)
  scene.add(directionalLight)

  // ── Screen Renderer ─────────────────────────────────────────────
  const screen = createScreenRenderer()

  // ── GLB Loading ─────────────────────────────────────────────────
  let trackedContent: THREE.Object3D | null = null

  const loader = new GLTFLoader()
  loader.load(
    './assets/ImageTracking.glb',
    (gltf) => {
      console.log('[GameLoop] GLB loaded —', gltf.scene.children.length, 'children')

      // Patch screen_plane material with canvas texture
      gltf.scene.traverse((node) => {
        if ((node as any).isMesh && node.name === 'screen_plane') {
          screen.patchMesh(node as THREE.Mesh)
        }
      })

      trackedContent = gltf.scene
      trackedContent.visible = false
      scene.add(trackedContent)
      console.log('[GameLoop] Tracked content added to scene')
    },
    undefined,
    (err) => {
      console.error('[GameLoop] Failed to load GLB:', err)
    }
  )

  // ── Image Tracking Events ───────────────────────────────────────
  window.addEventListener('reality.imagefound', (e: any) => {
    const detail = e.detail || e
    console.log('[GameLoop] Image found:', detail.name || detail.id)
    if (detail.name === IMAGE_TARGET_NAME || detail.id === IMAGE_TARGET_UUID) {
      if (trackedContent) {
        trackedContent.visible = true
      }
    }
  })

  window.addEventListener('reality.imageupdated', (e: any) => {
    const detail = e.detail || e
    if (detail.name === IMAGE_TARGET_NAME || detail.id === IMAGE_TARGET_UUID) {
      if (!trackedContent) return

      // Extract camera pose from the tracking event
      // 8th Wall provides camera position/rotation relative to the image
      const pose = detail.pose || detail.cameraPose
      if (pose) {
        // Position the tracked content so it appears where the image is
        trackedContent.position.set(
          pose.position?.x ?? 0,
          pose.position?.y ?? 0,
          pose.position?.z ?? 0
        )
        trackedContent.quaternion.set(
          pose.rotation?.x ?? 0,
          pose.rotation?.y ?? 0,
          pose.rotation?.z ?? 0,
          pose.rotation?.w ?? 1
        )
      }
    }
  })

  window.addEventListener('reality.imagelost', (e: any) => {
    const detail = e.detail || e
    if (detail.name === IMAGE_TARGET_NAME || detail.id === IMAGE_TARGET_UUID) {
      if (trackedContent) {
        trackedContent.visible = false
      }
    }
  })

  // ── 8th Wall Frame Loop ────────────────────────────────────────
  const waitForXR = () => {
    if (typeof (window as any).XR8 === 'undefined') {
      requestAnimationFrame(waitForXR)
      return
    }

    console.log('[GameLoop] XR8 detected — hooking into frame loop')

    // Configure image tracking with runtime processing
    ;(window as any).XR8.XrController.configure({
      tracking: {
        imageTargets: {
          targets: [
            {
              name: IMAGE_TARGET_NAME,
              src: IMAGE_TARGET_SRC,
              uuid: IMAGE_TARGET_UUID,
            },
          ],
        },
      },
    })

    // Add camera renderer module — called every frame
    ;(window as any).XR8.addCameraRendererModule({
      onRender: () => {
        screen.drawReduxState()
        renderer.render(scene, camera)
      },
      onCameraColorChange: () => {},
    })
  }

  waitForXR()

  // ── Window Resize ───────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })
}
