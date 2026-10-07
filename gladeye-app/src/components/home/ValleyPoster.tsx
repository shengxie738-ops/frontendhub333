'use client';

import { HERO_COPY } from '@/experience/data/scene-settings';
import styles from '@/experience/flower-valley.module.css';

/**
 * Degraded path: WebGL is unavailable or the visitor asked for reduced motion.
 * The hero copy and the CTA stay fully usable — the clone never silently swaps
 * the 3D scene for an image and claims success (`diagnostics.mode === 'poster'`
 * and `degradeReasons` say what happened).
 */
export default function ValleyPoster({ ctaHref = '/work' }: { ctaHref?: string }): JSX.Element {
  return (
    <div className={styles.poster} data-testid="gladeye-valley-poster">
      <div className={styles.posterInner}>
        <h2 className={`${styles.posterCopy} t-hero`}>
          {HERO_COPY.posterHeading[0]}
          <br />
          {`for a `}
          <em className={styles.posterItalic}>regenerative</em>
          {` future`}
        </h2>
        <a className={styles.posterCta} href={ctaHref}>
          {HERO_COPY.ctaText}
        </a>
        <p className={styles.posterNote}>
          {`Live 3D valley unavailable — static hero (WebGL disabled or reduced motion).`}
        </p>
      </div>
    </div>
  );
}
