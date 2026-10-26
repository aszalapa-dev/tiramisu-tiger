export function chooseDelivery({width=1280,coarsePointer=false}={}) {
  const compact=width<=760||(coarsePointer&&width<=1024);
  return {modelFile:compact?'classique-mobile.glb':'classique.glb'};
}
export function browserDelivery() {
  return chooseDelivery({width:innerWidth,coarsePointer:matchMedia('(pointer:coarse)').matches});
}
