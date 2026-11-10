// Fit the actual rendered silhouette, including a held frame during a cold seek.
export function fitSequenceFrame({width,height,framing},canvasWidth,canvasHeight,progress,index){
  if(!framing)return Math.min(canvasWidth/width,canvasHeight/height);
  const bounds=framing.envelopes,count=bounds?.length;
  if(!count)throw new Error('Cadrage de la séquence absent.');
  const position=Math.max(0,Math.min(1,progress))*(count-1),lo=Math.floor(position),hi=Math.min(count-1,lo+1),mix=position-lo;
  const held=bounds[Math.max(0,Math.min(count-1,index))];
  const x=Math.max(bounds[lo][0]+(bounds[hi][0]-bounds[lo][0])*mix+2,held[0]);
  const y=Math.max(bounds[lo][1]+(bounds[hi][1]-bounds[lo][1])*mix+2,held[1]);
  if(!(x>0&&y>0))throw new Error('Cadrage de la séquence invalide.');
  const padding=framing.padding||0;
  return Math.min(Math.max(1,canvasWidth-padding)/(2*x),Math.max(1,canvasHeight-padding)/(2*y));
}
