/**
 * Game Loop — sets up Three.js scene, loads the GLB model,
 * hooks into 8th Wall's pipeline-based frame loop, and handles image tracking.
 *
 * Correct 8th Wall API: XR8.addCameraPipelineModules([...]) + XR8.run({canvas})
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createScreenRenderer } from './screen-patcher'

const IMAGE_TARGET_NAME = 'mural'
const IMAGE_TARGET_UUID = 'mural-8thwall-target'

export function initGameLoop() {
  const XR8 = (window as any).XR8
  const XRExtras = (window as any).XRExtras

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

  // Style the Three.js canvas on top of camera feed
  renderer.domElement.style.position = 'fixed'
  renderer.domElement.style.top = '0'
  renderer.domElement.style.left = '0'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.zIndex = '1'
  renderer.domElement.style.pointerEvents = 'none'

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(0, 5, 5)
  scene.add(dirLight)

  // ── Screen Renderer ─────────────────────────────────────────────
  const screen = createScreenRenderer()

  // ── GLB Loading ─────────────────────────────────────────────────
  let trackedContent: THREE.Object3D | null = null

  new GLTFLoader().load(
    './assets/ImageTracking.glb',
    (gltf) => {
      console.log('[GameLoop] GLB loaded —', gltf.scene.children.length, 'children')

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

  // ── Custom Pipeline Module — Three.js Rendering ─────────────────
  const threejsPipelineModule = () => ({
    name: 'brickgame-threejs',
    onRender: () => {
      screen.drawReduxState()
      renderer.render(scene, camera)
    },
    onUpdate: () => {},
  })

  // ── Image Tracking Events ───────────────────────────────────────
  // Engine event detail has: {name, type, scale, position:{x,y,z}, rotation:{x,y,z,w}, properties}
  window.addEventListener('reality.imagefound', (e: any) => {
    const detail = e.detail || e
    console.log('[GameLoop] reality.imagefound:', JSON.stringify({ name: detail.name, scale: detail.scale }))
    if (detail.name === IMAGE_TARGET_NAME) {
      if (trackedContent) {
        trackedContent.visible = true
        const p = detail.position
        const r = detail.rotation
        if (p && r) {
          trackedContent.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0)
          trackedContent.quaternion.set(r.x ?? 0, r.y ?? 0, r.z ?? 0, r.w ?? 1)
          const s = detail.scale ?? 1
          trackedContent.scale.set(s, s, s)
        }
        console.log('[GameLoop] Mesh shown at:', trackedContent.position.toArray())
      } else {
        console.warn('[GameLoop] trackedContent not loaded yet when image found')
      }
    }
  })

  window.addEventListener('reality.imageupdated', (e: any) => {
    const detail = e.detail || e
    if (detail.name === IMAGE_TARGET_NAME) {
      if (!trackedContent) return
      const p = detail.position
      const r = detail.rotation
      if (p && r) {
        trackedContent.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0)
        trackedContent.quaternion.set(r.x ?? 0, r.y ?? 0, r.z ?? 0, r.w ?? 1)
        const s = detail.scale ?? 1
        trackedContent.scale.set(s, s, s)
      }
    }
  })

  window.addEventListener('reality.imagelost', (e: any) => {
    const detail = e.detail || e
    console.log('[GameLoop] reality.imagelost:', detail.name)
    if (detail.name === IMAGE_TARGET_NAME) {
      if (trackedContent) {
        trackedContent.visible = false
      }
    }
  })

  // Also log loading/scanning events for diagnostics
  window.addEventListener('reality.imageloading', (e: any) => {
    console.log('[GameLoop] reality.imageloading:', e.detail?.name || 'unknown')
  })
  window.addEventListener('reality.imagescanning', (e: any) => {
    console.log('[GameLoop] reality.imagescanning:', e.detail?.name || 'unknown')
  })

  // ── 8th Wall Session Setup ──────────────────────────────────────
  // Configure image tracking BEFORE registering pipelines
  // imagePath must point to a 480x640 image (color or grayscale)
  // properties describe the crop within that imagePath image
  const imagePath = './image-targets/mural_color_480x640.png'

  const imageTargetMetadata = {
    imagePath,
    metadata: {},
    name: IMAGE_TARGET_NAME,
    type: 'PLANAR',
    properties: {
      left: 0,
      top: 0,
      width: 480,
      height: 640,
      isRotated: false,
      originalWidth: 480,
      originalHeight: 640,
    },
  }

  console.log('[GameLoop] Configuring image targets:', imagePath)

  XR8.XrController.configure({
    imageTargetData: [imageTargetMetadata],
  })

  // Register pipeline modules — GlTextureRenderer MUST be first
  const pipelineModules = [
    XR8.GlTextureRenderer.pipelineModule(),
    threejsPipelineModule(),
  ]

  // Add XrController for image tracking if available
  if (XR8.XrController && XR8.XrController.pipelineModule) {
    pipelineModules.splice(1, 0, XR8.XrController.pipelineModule())
  }

  // Add XRExtras modules if available
  if (XRExtras) {
    if (XRExtras.FullWindowCanvas && XRExtras.FullWindowCanvas.pipelineModule) {
      pipelineModules.push(XRExtras.FullWindowCanvas.pipelineModule())
    }
    if (XRExtras.Loading && XRExtras.Loading.pipelineModule) {
      pipelineModules.push(XRExtras.Loading.pipelineModule())
    }
    if (XRExtras.RuntimeError && XRExtras.RuntimeError.pipelineModule) {
      pipelineModules.push(XRExtras.RuntimeError.pipelineModule())
    }
  }

  XR8.addCameraPipelineModules(pipelineModules)

  // ── Splash Screen → Start Session ───────────────────────────────
  const splash = document.getElementById('ar-splash')

  const startSession = () => {
    console.log('[GameLoop] Starting XR8 session')

    XR8.run({
      canvas: document.getElementById('camerafeed'),
      allowedDevices: XR8.XrConfig.device().ANY,
    })

    if (splash) {
      splash.style.display = 'none'
    }
  }

  if (splash) {
    splash.addEventListener('click', startSession)
    splash.addEventListener('touchstart', startSession)
  } else {
    startSession()
  }

  // ── Window Resize ───────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })
}
