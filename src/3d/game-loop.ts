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

      const pose = detail.pose || detail.cameraPose
      if (pose) {
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

  // ── 8th Wall Session Setup ──────────────────────────────────────
  // Configure image tracking BEFORE registering pipelines
  // NOTE: The correct API is imageTargetData (array of JSON objects), NOT tracking.imageTargets
  const imagePath = './image-targets/mural_luminance.png'

  // Fetch the image target metadata and inject the correct image URL
  const imageTargetMetadata = {
    imagePath,
    metadata: {},
    name: IMAGE_TARGET_NAME,
    type: 'PLANAR',
    properties: {
      left: 125,
      top: 0,
      width: 1616,
      height: 2155,
      isRotated: false,
      originalWidth: 1865,
      originalHeight: 2155,
    },
  }

  console.log('[GameLoop] Configuring image targets with imagePath:', imagePath)

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
