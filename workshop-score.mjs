export const SCORE_THEMES = ['清晰印章', '光影印章', '反差印章'];

export function scorePortrait(image, theme, giftLevel, seed, options = {}) {
  const random = typeof options.random === 'function' ? options.random : Math.random;
  if(giftLevel){
    const value=Number(options.giftValue);
    if(Number.isFinite(value)&&value>0)return value>=50?100:value>=10?99:value>=5?98:value>=2?97:96;
    return 95+Math.max(1,Math.min(4,Math.floor(giftLevel)||1));
  }
  if (!options.live) return randomScore(65, 74, random);
  return random()<.98?randomScore(75,84,random):randomScore(85,95,random);
}

function randomScore(minimum, maximum, random) {
  return minimum + Math.min(maximum - minimum, Math.floor(random() * (maximum - minimum + 1)));
}
