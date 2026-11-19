export const SCORE_THEMES = ['清晰印章', '光影印章', '反差印章'];

export function scorePortrait(image, theme, giftLevel, seed, options = {}) {
  const random = typeof options.random === 'function' ? options.random : Math.random;
  if (!options.live) return randomScore(65, 74, random);
  if (!giftLevel) {
    const roll = random();
    return roll < .8
      ? randomScore(75, 84, random)
      : randomScore(85, 95, random);
  }

  const value = Number(options.giftValue);
  let band;
  if (Number.isFinite(value) && value > 0) {
    band = value >= 50 ? 3 : value >= 10 ? 2 : value >= 5 ? 1 : 0;
  } else {
    band = Math.max(0, Math.min(3, Math.floor(giftLevel) - 1));
  }
  const minimum = 85 + band * 4;
  return randomScore(minimum, minimum + 3, random);
}

function randomScore(minimum, maximum, random) {
  return minimum + Math.min(maximum - minimum, Math.floor(random() * (maximum - minimum + 1)));
}
