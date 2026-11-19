export const SCORE_THEMES = ['清晰印章', '光影印章', '反差印章'];

export function scorePortrait(image, theme, giftLevel, seed, options = {}) {
  const fallback = Math.max(0, Math.min(1, (seed - 60) / 39));
  let quality = fallback;
  if (image?.data?.length && image.width > 1 && image.height > 1) {
    const {width, height, data} = image;
    let sum = 0, square = 0, edges = 0, weight = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (((x - width / 2) / width) ** 2 + ((y - height / 2) / height) ** 2 > .22) continue;
        const i = (y * width + x) * 4;
        const light = (data[i] * .2126 + data[i+1] * .7152 + data[i+2] * .0722) / 255;
        sum += light;
        square += light * light;
        edges += Math.abs(light - (data[i-4] * .2126 + data[i-3] * .7152 + data[i-2] * .0722) / 255);
        weight++;
      }
    }
    if (weight) {
      const mean = sum / weight;
      const contrast = Math.min(1, Math.sqrt(Math.max(0, square / weight - mean * mean)) * 4);
      const detail = Math.min(1, edges / weight * 12);
      const lighting = Math.max(0, 1 - Math.abs(mean - .52) * 2);
      const axes = [detail, lighting, contrast];
      quality = axes[theme] * .55 + (detail + lighting + contrast) * .15;
    }
  }
  const ratio = .82 * quality + .18 * fallback;
  if (!options.live) return 65 + Math.round(9 * ratio);
  const stayBonus=Math.min(6,Math.floor(Math.max(0,options.stayMinutes||0)/5));
  if (!giftLevel) return Math.min(87,75+Math.round(6*ratio)+stayBonus);
  const value=Number(options.giftValue)||0;
  const giftBase=Math.min(91,88+Math.floor(Math.log2(Math.max(1,value))));
  return Math.min(92,giftBase+Math.min(2,Math.floor(stayBonus/3)));
}
