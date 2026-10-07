/**
 * `Alea 0.9` PRNG, verbatim port of the `seedrandom` module the original bundle
 * ships (`evidence/source-assets/js/596-40a806be0d0d2bb3.js:62`, module `82`).
 *
 * The site calls it exactly once — `F()(V)` with `V = "seed"` — to seed the CPU
 * simplex noise that fills `aTerrainNoise` / `aFlowerGrowNoise`. Any deviation
 * here would move every plant in the valley, so the arithmetic is copied
 * instead of re-derived.
 */

const MASH_SEED = 0xefc82499; // 4022871197, page-…js module 82 `t=4022871197`
const FRACT53 = 2.3283064365386963e-10; // minified as `23283064365386963e-26`

export type RandomFunction = () => number;

function createMash(): (data: unknown) => number {
  let n = MASH_SEED;
  return function mash(data: unknown): number {
    const str = String(data);
    for (let i = 0; i < str.length; i++) {
      n += str.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000; // 4294967296
    }
    return (n >>> 0) * FRACT53;
  };
}

/** `seedrandom(...args)` → an `Alea 0.9` PRNG. */
export function alea(...args: readonly unknown[]): RandomFunction {
  let me: readonly unknown[] = args;
  if (me.length === 0) me = [Date.now()];

  const mash = createMash();
  let s0 = mash(' ');
  let s1 = mash(' ');
  let s2 = mash(' ');
  let c = 1;

  for (let i = 0; i < me.length; i++) {
    s0 -= mash(me[i]);
    if (s0 < 0) s0 += 1;
    s1 -= mash(me[i]);
    if (s1 < 0) s1 += 1;
    s2 -= mash(me[i]);
    if (s2 < 0) s2 += 1;
  }

  const random: RandomFunction = function () {
    const t = 2091639 * s0 + c * FRACT53;
    s0 = s1;
    s1 = s2;
    s2 = t - (c = t | 0);
    return s2;
  };
  (random as RandomFunction & { uint32?: () => number }).uint32 = () => 0x100000000 * random();
  (random as RandomFunction & { fract53?: () => number }).fract53 = () =>
    random() + ((0x200000 * random()) | 0) * 1.1102230246251568e-16;
  return random;
}
