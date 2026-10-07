import type { ReactNode } from 'react';

/**
 * Verbatim re-production of `MotionLink_main__kgq4W` from the original site: the label
 * is rendered twice inside an overflow-hidden box, the duplicate absolutely positioned
 * above, and CSS rolls both by 100% on hover (`original-classes.css`).
 */
export default function MotionLink({
  text,
  children,
  className = '',
  innerClassName = '',
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <span className={`MotionLink_main__kgq4W ${className}`.trim()}>
      <div className={`MotionLink_inner__hsBoJ ${innerClassName}`.trim()}>
        <span>{text}</span>
        <span>{children ?? text}</span>
      </div>
    </span>
  );
}
