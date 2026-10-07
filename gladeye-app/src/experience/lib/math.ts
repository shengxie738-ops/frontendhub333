/**
 * `M = (e,t,n,i,o,s)=>{...}` — the single remapping helper the original bundle
 * uses everywhere (`page-4c279de0997d388f.js:4100`). Copied exactly, including
 * its asymmetric clamp branches (they are what the site actually produces).
 *
 * `M(value, inMin, inMax, outMin, outMax, restrict?)`
 */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  restrict?: boolean,
): number {
  if (Math.abs(inMin - inMax) < Number.EPSILON) return outMin;
  const mapped = ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
  if (!restrict) return mapped;
  return outMin < outMax
    ? Math.max(Math.min(mapped, outMax), outMin)
    : Math.max(Math.min(mapped, outMin), outMax);
}

/**
 * `I = e => 43758.5453*Math.sin(A(e,[12.9898,78.233]))%1` — the GLSL-style
 * hash the original runs on the CPU for `aYNoise`. Note this keeps **JS** `%`
 * semantics (negative results for negative operands), which is what the site
 * stores in the attribute.
 */
export function hash2(vec: readonly [number, number] | readonly number[]): number {
  const dot = vec[0] * 12.9898 + vec[1] * 78.233;
  return (43758.5453 * Math.sin(dot)) % 1;
}

/** `A = (e,t)=>e.map((n,i)=>e[i]*t[i]).reduce((e,t)=>e+t)` */
export function dot2(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1];
}

/** `I` — the exact call site used by the placement loop for `aYNoise`. */
export function hashYNoise(vec: readonly [number, number]): number {
  return hash2(vec);
}
