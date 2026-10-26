import { ShaderChunk } from 'three';

// The product uses a clear, zero-thickness PET shell. Three r160's default
// transmission sampler applies both a roughness mip level and a bicubic blur,
// even for this shell. Sample its full-resolution buffer directly so the food
// keeps its detail. Fresnel reflection, IOR and the physical material remain.
export function preserveThinPETDetail(material) {
  if (!material.isMeshPhysicalMaterial || material.transmission <= 0 ||
      material.thickness !== 0 || material.roughness > .01) return;

  const filtered = 'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );';
  const source = ShaderChunk.transmission_pars_fragment;
  if (!source.includes(filtered)) throw new Error('Le shader PET doit être vérifié pour cette version de Three.js.');

  const transmission = source.replace(filtered,
    'return textureLod( transmissionSamplerMap, fragCoord.xy, 0.0 );');
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <transmission_pars_fragment>', transmission);
  };
  material.customProgramCacheKey = () => 'tiratiti-clear-thin-pet-native-v1';
  material.needsUpdate = true;
}
