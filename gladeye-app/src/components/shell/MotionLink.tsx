"use client";

import Link from "next/link";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

/**
 * Port of webpack module 413 (component) + module 1245 (class map) from
 * `evidence/source-assets/js/131-8efcfd03f067c029.js`.
 *
 * The roll-over is done entirely in CSS on the original: the element holds two
 * identical `<span>`s, the first absolutely positioned, and `:hover` slides one
 * out while the other slides in (`MotionLink_inner__hsBoJ span:nth-child(odd|2n)`
 * in 70ccb8e7fa150b80.css). `after` renders trailing content such as the address
 * arrow or the `|` separator.
 */
export const MOTION_LINK_STYLES = {
  main: "MotionLink_main__kgq4W",
  inner: "MotionLink_inner__hsBoJ",
  selected: "MotionLink_selected__vaZaj",
} as const;

export interface MotionLinkProps {
  href: string;
  title: ReactNode;
  className?: string;
  selected?: boolean;
  target?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLElement>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Trailing node, e.g. `<span>|</span>` or the address arrow. */
  after?: ReactNode;
  label?: string;
}

const EXTERNAL = /^(https?:|mailto:|tel:)/i;

export function MotionLink(props: MotionLinkProps) {
  const {
    href,
    title,
    className,
    selected,
    target,
    style,
    onClick,
    onMouseEnter,
    onMouseLeave,
    after,
    label,
  } = props;

  const classes = [
    MOTION_LINK_STYLES.main,
    className,
    selected ? MOTION_LINK_STYLES.selected : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <div className={MOTION_LINK_STYLES.inner}>
        <span>{title}</span>
        <span>{title}</span>
      </div>
      {after}
    </>
  );

  const shared = {
    className: classes,
    style,
    onClick,
    onMouseEnter,
    onMouseLeave,
    "aria-label": label,
  };

  if (EXTERNAL.test(href) || target === "_blank") {
    return (
      <a
        {...shared}
        href={href}
        target={target}
        rel={target === "_blank" ? "nofollow noopener" : undefined}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link {...shared} href={href} scroll={false}>
      {inner}
    </Link>
  );
}
