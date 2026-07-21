# 8th Wall & Three.js Integration Rules

When building or modifying 8th Wall XR experiences integrated with Three.js (without using A-Frame), you MUST strictly adhere to the following architectural rules. Failure to do so will result in invisible 3D models, frozen tracking, or WebGL context conflicts.

## 1. Image Tracking Events MUST Use Pipeline Listeners
**NEVER use `window.addEventListener()` for 8th Wall tracking events.**

8th Wall does NOT dispatch `reality.imagefound`, `reality.imageupdated`, or `reality.imagelost` as standard DOM events on the `window` object. 
These events flow **internally** through the camera pipeline.

**Incorrect (DO NOT DO THIS):**
```typescript
// ❌ WRONG
window.addEventListener('reality.imagefound', (e) => {
  // This will NEVER fire.
});
```

**Correct (MUST DO THIS):**
Create a custom pipeline module and define a `listeners` array.
```typescript
const myThreejsPipelineModule = () => {
  return {
    name: 'custom-threejs-module',
    listeners: [
      {
        event: 'reality.imagefound',
        process: ({ detail }: any) => {
          console.log('Image found:', detail.name, detail.position, detail.rotation, detail.scale);
          // Make Three.js meshes visible here
          if (detail.name === 'my-target' && myMesh) {
             myMesh.visible = true;
             myMesh.position.set(detail.position.x, detail.position.y, detail.position.z);
             myMesh.quaternion.set(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w);
             myMesh.scale.set(detail.scale, detail.scale, detail.scale);
          }
        },
      },
      {
        event: 'reality.imageupdated',
        process: ({ detail }: any) => {
          // Update pose here
        }
      },
      {
        event: 'reality.imagelost',
        process: ({ detail }: any) => {
          // Hide mesh here
        }
      }
    ]
  };
};
```

## 2. Syncing Camera Intrinsics via `onUpdate`
You must manually update the Three.js camera's projection matrix and pose every frame using the data provided by 8th Wall. If you skip this, the 3D content will render in an incorrect coordinate space relative to the camera feed.

Use the `onUpdate` lifecycle hook inside your pipeline module:

```typescript
const myThreejsPipelineModule = () => {
  return {
    name: 'custom-threejs-module',
    onUpdate: ({ processCpuResult }: any) => {
      if (processCpuResult?.reality) {
        const { intrinsics, position, rotation } = processCpuResult.reality;

        // Sync projection matrix
        if (intrinsics) {
          camera.projectionMatrix.fromArray(intrinsics);
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        }

        // Sync camera pose
        if (position) {
          camera.position.set(position.x, position.y, position.z);
        }
        if (rotation) {
          camera.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }
      }
    },
    // ...
  };
};
```

## 3. The Two-Canvas Architecture
To avoid WebGL context clearing issues and Z-fighting between the 8th Wall camera feed and the Three.js scene, implement a **Two-Canvas Method**:

1. **Canvas 1 (The Camera Feed):**
   * Typically an `<canvas id="camerafeed">` in your HTML.
   * Controlled entirely by 8th Wall's `XR8.GlTextureRenderer.pipelineModule()`.
   * You pass this canvas to `XR8.run({ canvas: document.getElementById('camerafeed') })`.

2. **Canvas 2 (The Three.js Overlay):**
   * A separate canvas created dynamically or via HTML (e.g., `#threejs-overlay`).
   * Absolutely positioned to exactly cover Canvas 1.
   * CSS `pointer-events: none;` so UI interactions pass through to HTML buttons.
   * Three.js `WebGLRenderer` should be configured with `alpha: true`.
   * Clear color must be transparent: `renderer.setClearColor(0x000000, 0)`.

```css
#threejs-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1; /* Above camerafeed (z-index: 0), below UI */
  pointer-events: none; 
}
```

## 4. Proper Module Registration Order
When configuring `XR8.addCameraPipelineModules`, the order is critical.

1. `XR8.GlTextureRenderer.pipelineModule()` MUST come first to draw the camera feed.
2. `XR8.XrController.pipelineModule()` MUST come before your custom module so that `processCpuResult.reality` is populated.
3. `yourCustomPipelineModule()` MUST come after the above so it can read the tracking data and render Three.js on top.

```typescript
XR8.addCameraPipelineModules([
  XR8.GlTextureRenderer.pipelineModule(),
  XR8.XrController.pipelineModule(),
  myThreejsPipelineModule(),
]);
```
