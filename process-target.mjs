#!/usr/bin/env node
/**
 * Process mural.png for 8th Wall image tracking.
 * Generates processed image files in image-targets/ directory.
 */
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'
import { applyCrop } from '@8thwall/image-target-cli/src/apply.js'
import { getDefaultCrop } from '@8thwall/image-target-cli/src/crop.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT_IMAGE = path.join(__dirname, 'public', 'assets', 'mural.png')
const OUTPUT_DIR = path.join(__dirname, 'image-targets')
const TARGET_NAME = 'mural'

async function processTarget() {
  console.log('Loading image:', INPUT_IMAGE)
  const rawImage = sharp(INPUT_IMAGE)
  const metadata = await rawImage.metadata()
  console.log('Image dimensions:', metadata.width, 'x', metadata.height)

  // Calculate default crop (3:4 aspect ratio)
  const crop = getDefaultCrop({ width: metadata.width, height: metadata.height }, false)
  console.log('Crop:', crop)

  // Create planar crop result
  const cropResult = {
    type: 'PLANAR',
    geometry: crop,
  }

  console.log('Processing image target...')
  const result = await applyCrop(
    rawImage,
    cropResult,
    OUTPUT_DIR,
    TARGET_NAME,
    true, // overwrite
    { uuid: 'mural-8thwall-target' }
  )

  console.log('Image target processed successfully!')
  console.log('Metadata written to:', result.dataPath)

  // List generated files
  const fs = await import('fs/promises')
  const files = await fs.readdir(OUTPUT_DIR)
  console.log('\nGenerated files:')
  files.forEach(f => console.log(' -', f))
}

processTarget().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
