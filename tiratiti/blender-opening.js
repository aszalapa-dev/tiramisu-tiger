import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export const OPENING_CLIP_NAME = 'Tiratiti_Ouverture';
export const OPENING_ASSET_URL = new URL('./assets/ouverture-classique.glb?v=tab-sync-26', import.meta.url).href;

const assetCache = new Map();
const originalTopName = /^(Couvercle\s*\||Languette\s*\||Bord interieur languette$|Contour roule languette$|Estampage autour du rivet$|Nervure circulaire emboutie$|Rainure circulaire ouverture$|Rivet de languette$)/;
const readable = name => name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const materialKey = name => readable(name).replace(/\.\d{3}$/, '').toLowerCase();

// Turn only the closure assembly around its vertical axis. This puts the
// pull tab on the opposite side and reverses both the peel and withdrawal.
// The transparent body, labels and permanently crimped body rim stay put.
export function orientClosure(model) {
  const byParent = new Map();
  model.traverse(object => {
    if (!object.isMesh || !originalTopName.test(readable(object.name))) return;
    if (!byParent.has(object.parent)) byParent.set(object.parent, []);
    byParent.get(object.parent).push(object);
  });
  for (const [parent, pieces] of byParent) {
    if (parent.name === 'Closure orientation') continue;
    const pivot = new THREE.Group();
    pivot.name = 'Closure orientation';
    pivot.rotation.y = Math.PI;
    parent.add(pivot);
    for (const piece of pieces) pivot.add(piece);
  }
}

/**
 * The GLB contains only the replacement top, in the original can's local
 * metre/Y-up coordinates. The hero has already been centred and scaled.
 * Attach to the original lid's parent; never normalise the animated asset.
 */
export function prepareBlenderOpening(model, gltf) {
  const clip = gltf.animations?.find(animation => animation.name === OPENING_CLIP_NAME);
  if (!gltf.scene || !clip || gltf.animations.length !== 1 || !(clip.duration > 0) || !Number.isFinite(clip.duration) || !clip.tracks.length) {
    throw new Error(`L’ouverture doit contenir un clip unique « ${OPENING_CLIP_NAME} ».`);
  }

  const originals = [];
  const originalMaterials = new Map();
  model.traverse(object => {
    if (!object.isMesh) return;
    if (originalTopName.test(readable(object.name))) originals.push(object);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material?.name) originalMaterials.set(materialKey(material.name), material);
    }
  });
  const originalLid = originals.find(object => /^Couvercle\s*\|/.test(readable(object.name)));
  if (!originalLid?.parent) throw new Error('Le parent du couvercle original est introuvable.');

  // Object3D.clone alone would leave cloned skinned meshes bound to source bones.
  const root = cloneSkeleton(gltf.scene);
  root.name = 'Tiratiti Blender Opening';
  const ownedMaterials = new Map();
  const skeletons = new Set();
  const unmatchedMaterials = new Set();
  let skinnedMeshes = 0;
  root.traverse(object => {
    if (!object.isMesh) return;
    if (object.isSkinnedMesh) {
      skinnedMeshes += 1;
      // Closed-pose bounds cannot contain the folded and removed sheet.
      object.frustumCulled = false;
      skeletons.add(object.skeleton);
    }
    const reuseMaterial = authored => {
      const source = originalMaterials.get(materialKey(authored.name));
      if (!source) { unmatchedMaterials.add(authored.name); return authored; }
      const doubleSide = authored.side === THREE.DoubleSide && source.side !== THREE.DoubleSide;
      const normalUV = source.normalMap ? `uv${source.normalMap.channel || ''}` : null;
      const cutEdgeWithoutUV = normalUV && !object.geometry.hasAttribute(normalUV);
      if (!doubleSide && !cutEdgeWithoutUV) return source;
      // Preserve the exported foil's visible underside without altering the
      // shared metal material on the body or the closed product viewer.
      const key = `${source.uuid}:${doubleSide}:${Boolean(cutEdgeWithoutUV)}`;
      if (!ownedMaterials.has(key)) {
        const material = source.clone();
        if (doubleSide) material.side = THREE.DoubleSide;
        // New cut edges have no baked UVs; the original normal map only
        // belongs on the stamped surfaces, not these sub-millimetre walls.
        if (cutEdgeWithoutUV) material.normalMap = null;
        ownedMaterials.set(key, material);
      }
      return ownedMaterials.get(key);
    };
    object.material = Array.isArray(object.material) ? object.material.map(reuseMaterial) : reuseMaterial(object.material);
  });
  if (!skinnedMeshes) {
    for (const material of ownedMaterials.values()) material.dispose();
    throw new Error('L’opercule Blender doit contenir un maillage lié à son armature.');
  }

  const departureBone = root.getObjectByName('Opening_Root');
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const originalVisibility = originals.map(object => ({ object, visible: object.visible }));
  let lastProgress = NaN;
  let disposed = false;
  const update = progress => {
    if (disposed) return;
    const amount = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
    if (amount === lastProgress) return;
    // reset() also clears LoopOnce's finished/paused state: seeking backward
    // from the last frame must reproduce the exact closed pose.
    action.reset().play();
    mixer.setTime(amount * clip.duration);
    if (departureBone) {
      // The authored release moves 120 mm sideways, 17 mm up and 12 mm
      // backward. Redirect only that departure above the viewport. Sampling
      // the clip first keeps the foil/tab bend and backward seeking exact.
      // Fixed rim meshes are outside this bone's hierarchy.
      const release = THREE.MathUtils.clamp(departureBone.position.x / .12, 0, 1);
      departureBone.position.x = 0;
      departureBone.position.y += (.22 - .017) * release;
      departureBone.position.z += .012 * release;
    }
    root.updateMatrixWorld(true);
    lastProgress = amount;
  };

  try {
    originalLid.parent.add(root);
    update(0);
    for (const { object } of originalVisibility) object.visible = false;
  } catch (error) {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    root.removeFromParent();
    for (const material of ownedMaterials.values()) material.dispose();
    for (const skeleton of skeletons) skeleton.dispose();
    throw error;
  }

  return {
    root, mixer, clip, duration: clip.duration, originals, skinnedMeshes,
    unmatchedMaterials: [...unmatchedMaterials], update,
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      root.removeFromParent();
      for (const { object, visible } of originalVisibility) object.visible = visible;
      for (const material of ownedMaterials.values()) material.dispose();
      for (const skeleton of skeletons) skeleton.dispose();
    }
  };
}

export async function loadBlenderOpening(model, loader, url = OPENING_ASSET_URL) {
  if (!assetCache.has(url)) {
    assetCache.set(url, loader.loadAsync(url).catch(error => {
      assetCache.delete(url);
      throw error;
    }));
  }
  return prepareBlenderOpening(model, await assetCache.get(url));
}
