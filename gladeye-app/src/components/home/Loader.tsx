'use client';

import { DOM_CLASS_NAMES } from '@/experience/data/scene-settings';
import styles from '@/experience/flower-valley.module.css';

/**
 * `Loader` — verbatim structure and timing from the bundle
 * (`page-4c279de0997d388f.js:41230-41600`): five `circleWrapper` divs rotated by
 * `360 * n / 5` inside a `spinner` that rotates once every 10 s, each `circle`
 * running the 4 s `circle-animation`, the whole overlay fading with a 0.3 s
 * opacity transition. The live site never showed a percentage; this port adds
 * one because the clone reports real load progress.
 */
const CIRCLES = [0, 1, 2, 3, 4];

export interface LoaderProps {
  loading: boolean;
  percent?: number;
}

export default function Loader({ loading, percent = 0 }: LoaderProps): JSX.Element {
  return (
    <div
      aria-hidden={loading ? undefined : 'true'}
      className={[
        styles.loaderOverlay,
        styles.loader,
        DOM_CLASS_NAMES.loader,
        loading ? '' : styles.loaderFade,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ opacity: loading ? 1 : 0, transition: 'opacity .3s ease-in-out' }}
      data-testid="gladeye-loader"
    >
      <div className={`${styles.spinnerWrapper} ${DOM_CLASS_NAMES.spinnerWrapper}`}>
        <div className={`${styles.spinner} ${DOM_CLASS_NAMES.spinner}`}>
          {CIRCLES.map((index) => (
            <div
              key={index}
              className={`${styles.circleWrapper} ${DOM_CLASS_NAMES.circleWrapper}`}
              style={{ transform: `rotate(${(360 * index) / CIRCLES.length}deg)` }}
            >
              <div className={`${styles.circle} ${DOM_CLASS_NAMES.circle}`} />
            </div>
          ))}
        </div>
      </div>
      <p className={styles.progressLabel}>{`loading ${percent}%`}</p>
    </div>
  );
}
