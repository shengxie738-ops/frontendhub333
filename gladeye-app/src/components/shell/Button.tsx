"use client";

import Link from "next/link";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";

import { ArrowRightUp } from "@/components/shared/icons";

/**
 * Port of webpack module 6554 (+ its CSS module map 3757) from
 * `evidence/source-assets/js/131-8efcfd03f067c029.js`.
 *
 * Class names are the original CSS-module exports kept literal so the captured
 * DOM (EVIDENCE §10: `Button_main__NewW7 Button_default__CcbQU`,
 * `Button_inner__d7ZPg`) maps one-to-one. Styling lives in
 * `src/styles/components.css`.
 *
 * The pill wipe is pure CSS (`:after` scaleX) under `@media (hover: hover)`, and
 * a `:focus-visible` twin of every roll-over state is provided so keyboard use
 * gets the same affordance.
 */

export type ButtonSize = "default" | "small";
export type ButtonIconName = "arrowRightUp";

const ICONS: Record<ButtonIconName, typeof ArrowRightUp> = {
  arrowRightUp: ArrowRightUp,
};

const STYLES = {
  main: "Button_main__NewW7",
  inner: "Button_inner__d7ZPg",
  ghost: "Button_ghost__gZqlA",
  filled: "Button_filled__HP3yZ",
  icon: "Button_icon__OWfxs",
  default: "Button_default__CcbQU",
  small: "Button_small__pgXYR",
} as const;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

interface ButtonOwnProps {
  size?: ButtonSize;
  icon?: ButtonIconName | false;
  uppercase?: boolean;
  className?: string;
  children?: ReactNode;
  /** Renders the visual button but removes pointer events (module 6554 `inactive`). */
  inactive?: boolean;
  ghost?: boolean;
  filled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  title?: string;
  ariaLabel?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  /**
   * Callback ref to the rendered element. Used by the header to hand focus back
   * to the Menu trigger when the overlay closes.
   */
  elementRef?: (node: HTMLElement | null) => void;
}

interface ButtonAsLink extends ButtonOwnProps {
  link: string;
  target?: string;
  rel?: string;
}

interface ButtonAsButton extends ButtonOwnProps {
  link?: undefined;
  target?: undefined;
  rel?: undefined;
}

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const {
    size = "default",
    icon = "arrowRightUp",
    uppercase = false,
    className,
    children,
    inactive = false,
    ghost,
    filled,
    onClick,
    onMouseEnter,
    onMouseLeave,
    link,
    target,
    rel,
    title,
    ariaLabel,
    ariaExpanded,
    ariaControls,
    elementRef,
    type = "button",
  } = props;

  const IconComponent = icon && typeof icon === "string" ? ICONS[icon as ButtonIconName] : null;

  const classes = cx(
    STYLES.main,
    size === "default" && STYLES.default,
    size === "small" && STYLES.small,
    ghost && STYLES.ghost,
    filled && STYLES.filled,
    inactive && "pointer-events-none",
    uppercase && "uppercase",
    className,
  );

  const content = (
    <>
      <span className={STYLES.inner}>{children}</span>
      {IconComponent ? (
        <div className={STYLES.icon}>
          <IconComponent />
        </div>
      ) : null}
    </>
  );

  if (inactive) {
    return (
      <div className={classes} title={title}>
        {content}
      </div>
    );
  }

  if (link) {
    const external = /^(https?:|mailto:|tel:)/i.test(link) || target === "_blank";
    if (external) {
      const anchorProps: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "ref"> = {
        className: classes,
        href: link,
        onMouseEnter,
        onMouseLeave,
        title,
        target,
        rel: rel ?? (target === "_blank" ? "nofollow noopener" : undefined),
        "aria-label": ariaLabel,
        "aria-expanded": ariaExpanded,
        "aria-controls": ariaControls,
      };
      return (
        <a ref={elementRef} {...anchorProps} onClick={onClick}>
          {content}
        </a>
      );
    }
    return (
      <Link
        ref={elementRef}
        href={link}
        className={classes}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        title={title}
        scroll={false}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={elementRef}
      type={type}
      className={classes}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={title}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
    >
      {content}
    </button>
  );
}

export { STYLES as BUTTON_STYLES };
