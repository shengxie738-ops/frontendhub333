'use client';

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';

import { audioStore } from '@/experience/lib/audio-manager';
import { DOM_CLASS_NAMES, HERO_COPY } from '@/experience/data/scene-settings';
import styles from '@/experience/flower-valley.module.css';

/**
 * `AudioControl` — verbatim port of `ew` + `ey`
 * (`page-4c279de0997d388f.js:40700-41180`).
 *
 *  - `eg = [.3, .6, .3, 1, .3]` are the five line peaks used when the bars are
 *    paused; while playing each line gets
 *    `scaleY: [peak, .3, peak]`, `duration: .5 + .3*rand`, `delay: .2*rand`.
 *  - `x = (index + 1) * 3.6666666666666665`, `y1 = 15`, `y2 = 0`,
 *    `stroke #FCF9F9`, `stroke-width 2`, `stroke-linecap round`,
 *    viewBox `0 0 22 15`, `width 22`, `height 15`.
 *  - `aria-label` is `"Unmute audio"` while muted (the shipped default) and
 *    `"Mute audio"` once playing.
 */
const LINE_PEAKS = [0.3, 0.6, 0.3, 1, 0.3];
const LINE_SPACING = 22 / 6;

interface LineVariant {
  peak: number;
  duration: number;
  delay: number;
}

/** `ex(count, randomize)` */
function buildVariants(count: number, randomize: boolean): LineVariant[] {
  return Array.from({ length: count }, (_unused, index) => {
    const peak = randomize ? 0.3 + 1.5 * Math.random() : LINE_PEAKS[index];
    return {
      peak,
      duration: 0.5 + 0.3 * Math.random(),
      delay: 0.2 * Math.random(),
    };
  });
}

export function AudioLines({ mute, pauseCurrentState }: { mute: boolean; pauseCurrentState: boolean }): JSX.Element {
  const [variants, setVariants] = useState<LineVariant[]>([]);
  const animated = !(mute || pauseCurrentState);

  useEffect(() => {
    setVariants(buildVariants(5, animated));
  }, [animated]);

  return (
    <svg width="22" height="15" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      {variants.map((variant, index) => {
        const x = (index + 1) * LINE_SPACING;
        return (
          <line
            key={index}
            x1={x}
            y1={15}
            x2={x}
            y2={'0'}
            stroke="#FCF9F9"
            strokeWidth="2"
            strokeLinecap="round"
            className={animated ? `${styles.audioBar} ${styles.audioBarAnimated}` : styles.audioBar}
            style={
              {
                '--peak': String(variant.peak),
                '--bar-duration': `${variant.duration}s`,
                '--bar-delay': `${variant.delay}s`,
                transform: animated ? undefined : `scaleY(${variant.peak})`,
              } as CSSProperties
            }
          />
        );
      })}
    </svg>
  );
}

export default function AudioControl(): JSX.Element {
  const state = useSyncExternalStore(
    audioStore.subscribe,
    audioStore.getSnapshot,
    audioStore.getServerSnapshot,
  );

  return (
    <button
      type="button"
      className={`${styles.audioButton} ${DOM_CLASS_NAMES.audioButton}`}
      onClick={() => {
        if (state.isInitialized) audioStore.toggleMute();
      }}
      aria-label={state.isMuted ? HERO_COPY.audioUnmuteLabel : HERO_COPY.audioMuteLabel}
      data-testid="gladeye-audio"
    >
      <AudioLines mute={state.isMuted} pauseCurrentState={false} />
    </button>
  );
}
