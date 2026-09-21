/** Descriptive statistics over plain arrays. Pure, allocation-light. */

export function mean(xs) {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample variance (n − 1). */
export function variance(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return s / (xs.length - 1);
}

export function std(xs) {
  return Math.sqrt(variance(xs));
}

/** Standard error of the mean. */
export function standardError(xs) {
  return std(xs) / Math.sqrt(xs.length);
}

/** Linear-interpolated percentile (R type 7) on an already sorted array. */
export function percentileSorted(sorted, p) {
  if (sorted.length === 0) return NaN;
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export function sorted(xs) {
  return Float64Array.from(xs).sort();
}

/** Equal-width histogram; the last bin is closed on the right. */
export function histogram(xs, binCount = 40) {
  if (xs.length === 0) return { edges: [], counts: [] };
  let min = Infinity;
  let max = -Infinity;
  for (const x of xs) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (max === min) return { edges: [min, max], counts: [xs.length] };
  const width = (max - min) / binCount;
  const counts = new Array(binCount).fill(0);
  for (const x of xs) counts[Math.min(binCount - 1, Math.floor((x - min) / width))] += 1;
  const edges = Array.from({ length: binCount + 1 }, (_, i) => min + i * width);
  return { edges, counts };
}
