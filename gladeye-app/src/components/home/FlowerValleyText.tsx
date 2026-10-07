'use client';

import type { CSSProperties } from 'react';

import { DOM_CLASS_NAMES, HERO_TEXT } from '@/experience/data/scene-settings';
import styles from '@/experience/flower-valley.module.css';
import type { HeroMessage } from '@/experience/types';

/**
 * `FlowerValleyText` — the per-character hero reveal, ported from
 * `page-4c279de0997d388f.js:39600-40400` (`ed`, `em`, `ef`).
 *
 * The math is reproduced exactly:
 *   words      = rich-text nodes flattened (`hard_break` counts as a word)
 *   r          = .8 / wordCount
 *   c          = r * wordIndex * .5
 *   h          = c + r / wordLength
 *   --delay    = (h + .015 + .015 * charIndex) s
 *   --duration = .25s
 * Verified against the live DOM (`evidence/probe-home-2.json`): the first `C` of
 * “Creative” in a 7-word heading carries `--delay: 0.029285714285714286s`.
 */

interface WordItem {
  text: string;
  italic: boolean;
  lineBreak: boolean;
}

/** `ed = e => {...}` — the Storyblok node flattener. */
export function messageWords(message: HeroMessage | undefined): WordItem[] {
  const nodes = message?.content?.[0]?.content ?? [];
  const words: WordItem[] = [];
  for (const node of nodes) {
    if (node.type === 'hard_break') {
      words.push({ text: '', italic: false, lineBreak: true });
      continue;
    }
    const parts = (node.text ?? '').split(' ');
    for (const part of parts) {
      if (part === '') continue;
      const italic = node.marks?.find((mark) => mark.type === 'italic') !== undefined;
      words.push({ text: part, italic: italic === true, lineBreak: false });
    }
  }
  return words;
}

/** Visible-message index: `Math.floor(count * (2 * progress % 1))`. */
export function activeMessageIndex(count: number, progress: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(count * ((HERO_TEXT.messageCycleFactor * progress) % 1))));
}

interface AnimatedMessageProps {
  message: HeroMessage;
  isVisible: boolean;
}

export function AnimatedMessage({ message, isVisible }: AnimatedMessageProps): JSX.Element {
  const words = messageWords(message);
  const spread = HERO_TEXT.wordSpreadTotal / words.length;

  return (
    <div className={`${styles.messageWrapper} text-center`}>
      <div className={`${styles.messagePositioner} absolute left-[50%] w-[90%] -translate-x-[50%] -translate-y-[60%]`}>
        {words.map((word, wordIndex) => {
          if (word.lineBreak) return <br key={`break-${wordIndex}`} />;

          const characters = word.text.split('');
          const wordStart = spread * wordIndex * HERO_TEXT.wordSpreadFactor;
          const baseDelay = wordStart + spread / characters.length;

          return (
            <span
              key={`${word.text}-${wordIndex}`}
              // the original string-concatenates `null` here, so the live DOM
              // literally contains a `null` class token for non-italic words
              className={`word my-[-0.4em] inline-block h-[1.3em] overflow-hidden px-[0.15em] ${
                word.italic ? 'italic' : 'null'
              } ${styles.word}`}
              aria-hidden="true"
            >
              {characters.map((character, charIndex) => {
                const delay =
                  baseDelay +
                  HERO_TEXT.characterLeadSeconds +
                  HERO_TEXT.characterStepSeconds * charIndex;
                const style = {
                  '--delay': `${delay}s`,
                  '--duration': `${HERO_TEXT.animationSeconds}s`,
                } as CSSProperties;
                return (
                  <span
                    key={`${word.text}-${character}-${charIndex}`}
                    className={[
                      'character mx-[-0.15em] inline-block px-[0.15em]',
                      styles.characterBox,
                      styles.character,
                      DOM_CLASS_NAMES.textCharacter,
                      isVisible ? DOM_CLASS_NAMES.textIsVisible : '',
                      isVisible ? styles.isVisible : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={style}
                    aria-hidden="true"
                  >
                    {character}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export interface FlowerValleyTextProps {
  messages: readonly HeroMessage[];
  /** index of the currently revealed message */
  activeIndex: number;
  ariaLabel: string;
  ctaText: string;
  ctaHref: string;
  ctaVisible?: boolean;
  hovered?: boolean;
  onCtaMouseEnter?: () => void;
  onCtaMouseLeave?: () => void;
  onCtaClick?: (href: string) => void;
}

export default function FlowerValleyText({
  messages,
  activeIndex,
  ariaLabel,
  ctaText,
  ctaHref,
  ctaVisible = true,
  hovered = false,
  onCtaMouseEnter,
  onCtaMouseLeave,
  onCtaClick,
}: FlowerValleyTextProps): JSX.Element {
  const hoverScale = hovered ? 1.1 : 1;

  return (
    <>
      <h2
        aria-label={ariaLabel}
        role="heading"
        aria-level={2}
        className={`t-hero w-[100%] ${styles.hero}`}
        style={{
          transform: `scale(${hoverScale})`,
          transition: `transform 1s ease`,
        }}
      >
        {messages.map((message, index) => (
          <AnimatedMessage
            key={message._uid}
            message={message}
            isVisible={index === activeIndex}
          />
        ))}
      </h2>

      {ctaVisible ? (
        <div
          className={[
            'absolute bottom-0 mb-xl-16 flex w-[100%] flex-wrap justify-center text-center',
            styles.ctaPositioner,
            styles.cta,
            DOM_CLASS_NAMES.textCta,
            styles.ctaEnter,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <a
            href={ctaHref}
            className={[
              'pointer-events-auto',
              'Button_main__NewW7',
              'Button_default__CcbQU',
              'Button_filled__HP3yZ',
              styles.ctaLink ?? '',
            ]
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={onCtaMouseEnter}
            onMouseLeave={onCtaMouseLeave}
            onFocus={onCtaMouseEnter}
            onBlur={onCtaMouseLeave}
            onClick={() => {
              /* the browser follows the href; the valley reacts to the route
                 change itself (`useFlowerValley` calls startExitTransition) */
              onCtaClick?.(ctaHref);
            }}
            data-testid="gladeye-cta"
          >
            {ctaText}
          </a>
        </div>
      ) : null}
    </>
  );
}
