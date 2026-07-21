import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';

// Mock browser environment for Three.js GLTFLoader
global.window = {};
global.document = {
    createElementNS: () => { return {}; }
};

const loader = new GLTFLoader();
const data = fs.readFileSync('./public/assets/ImageTracking.glb');

loader.parse(data.buffer, '', (gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    console.log('Bounding box:', box);
    const size = new THREE.Vector3();
    box.getSize(size);
    console.log('Size:', size);
}, (err) => {
    console.error(err);
});
