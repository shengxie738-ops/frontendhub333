"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowRightUp, ArrowRight } from "@/components/shared/icons";
import { MotionLink } from "@/components/shell/MotionLink";
import {
  ADDRESS_HREF,
  ADDRESS_LABEL,
  CAREERS_EMAIL,
  CONTACT_EMAIL,
  NEWSLETTER_HEADING,
  NEWSLETTER_PLACEHOLDER,
  SOCIAL_LINKS,
} from "@/lib/theme";

import type { FormEvent } from "react";

/**
 * Port of webpack modules 9858 (footer + newsletter) and 7946 (contact groups)
 * from `evidence/source-assets/js/app/layout-3ab4cf37f3ac757c.js`, with the DOM
 * cross-checked against the `<footer>` captured in
 * `evidence/source-pages/_contact.html`.
 *
 * Layout facts reproduced here:
 *   • the footer is `lg:fixed … bottom-0 z-Footer bg-yellow` — a sticky footer
 *     pinned to the viewport, with a `z-Main min-h-[100vh]` spacer that the page
 *     content scrolls over (the `z-Main` class is dead on the original too:
 *     70ccb8e7fa150b80.css only defines `z-main`, lowercase);
 *   • `data-theme="yellow"` + `data-scroll-lock-fill-gap="true"`;
 *   • a 20vh `bg-yellow` bleed above it (`absolute inset-x-0 bottom-full`);
 *   • the grid is `ui-grid w-full max-w-site gap-y-12 pb-32 pt-32 lg:gap-y-0`
 *     with the form in `lg:col-span-11 lg:col-start-3 xl:col-span-8 xl:col-start-3`
 *     and the contact column in `lg:col-start-16 xl:col-start-16`.
 *
 * The newsletter is LOCAL ONLY. The original posts to `/api/newsletter`
 * (module 9858: `fetch("/api/newsletter", {method:"POST",…})`); this clone does
 * not call any endpoint and sends no mail — submission is simulated in state.
 */

const SIGNUP_STYLES = {
  form: "ContactSignUp_form__wMRUI",
  isSubmitting: "ContactSignUp_isSubmitting__WiNyE",
  fieldWrapper: "ContactSignUp_fieldWrapper__9wUtO",
  input: "ContactSignUp_input__Jz9AT",
  icon: "ContactSignUp_icon__984rC",
  fieldErrorMessage: "ContactSignUp_fieldErrorMessage__yt2wd",
  generalErrorMessage: "ContactSignUp_generalErrorMessage__jEBlq",
} as const;

/* -------------------------------------------------------------------------- */
/* Contact groups (module 7946)                                                */
/* -------------------------------------------------------------------------- */

interface ContactItem {
  label: string;
  href: string;
  external: boolean;
}

interface ContactGroup {
  heading: string;
  items: readonly ContactItem[];
}

const GROUPS: readonly ContactGroup[] = [
  {
    heading: "Request a proposal",
    items: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, external: false }],
  },
  {
    heading: "Follow us",
    items: SOCIAL_LINKS.map((s) => ({
      label: s.label,
      href: s.href,
      external: true,
    })),
  },
  {
    heading: "Join the team",
    items: [{ label: CAREERS_EMAIL, href: `mailto:${CAREERS_EMAIL}`, external: false }],
  },
];

function ContactGroupBlock({
  group,
  className,
  linkSuffix,
}: {
  group: ContactGroup;
  className?: string;
  linkSuffix?: React.ReactNode;
}) {
  return (
    <div className={`${className ?? ""} space-y-s-1 footerLarge:space-y-0`}>
      <h3 className="font-light">{group.heading}</h3>
      <ul className="space-y-s-1 font-medium footerLarge:flex footerLarge:items-center footerLarge:gap-s-2 footerLarge:space-y-0">
        {group.items.map((item, index) => (
          <li
            key={item.href}
            className="footerLarge:flex footerLarge:items-center footerLarge:gap-s-2"
          >
            <MotionLink
              href={item.href}
              title={item.label}
              target={item.external ? "_blank" : undefined}
            />
            {index < group.items.length - 1 ? (
              <span className="hidden font-light footerLarge:block">|</span>
            ) : null}
            {index === group.items.length - 1 ? linkSuffix : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface FooterContactProps {
  className?: string;
  /** `false` inside the menu overlay, where reveal animation is handled by the panel. */
  animate?: boolean;
  /** Lays the four groups out on one row (`flex-1` + right-aligned year). */
  isHorizontal?: boolean;
}

/**
 * module 7946 `t.Z` — the four contact groups plus the copyright line.
 * Reused verbatim by the footer (vertical) and the menu overlay (horizontal).
 */
export function FooterContact({
  className,
  animate = true,
  isHorizontal = false,
}: FooterContactProps) {
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  const groupWrapper = ["mb-6", isHorizontal ? "flex-1" : ""]
    .filter(Boolean)
    .join(" ");

  const addressWrapper = ["relative", groupWrapper].filter(Boolean).join(" ");

  const yearWrapper = [
    groupWrapper,
    isHorizontal ? "footerLarge:text-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const addressSuffix = (
    <span className="ml-3 w-[0.5em] self-center">
      <ArrowRightUp className="fill-current" />
    </span>
  );

  return (
    <div className={className}>
      {GROUPS.map((group) => (
        <div key={group.heading} className={groupWrapper}>
          <ContactGroupBlock group={group} />
        </div>
      ))}

      <div className={addressWrapper}>
        <ContactGroupBlock
          className="mr-3 inline-block"
          linkSuffix={addressSuffix}
          group={{
            heading: "Find us",
            items: [{ label: ADDRESS_LABEL, href: ADDRESS_HREF, external: true }],
          }}
        />
      </div>

      <div className={yearWrapper} data-animate={animate ? "true" : "false"}>
        <p>{`© Gladeye ${year}`}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Newsletter (module 9858 `k`) — local simulation only                        */
/* -------------------------------------------------------------------------- */

type SignupPhase = "idle" | "sending" | "success" | "error";

function NewsletterSignUp() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SignupPhase>("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      // No network call: this clone must never hit the origin's endpoints.
      event.preventDefault();
      setGeneralError(null);

      if (email.trim().length === 0) {
        setFieldError("This field is required.");
        return;
      }
      setFieldError(null);

      setPhase("sending");
      timerRef.current = window.setTimeout(() => {
        setPhase("success");
        setEmail("");
        timerRef.current = window.setTimeout(() => setPhase("idle"), 4000);
      }, 600);
    },
    [email],
  );

  return (
    <div>
      <h2 className="t-h2 mb-8 xl:mb-12">
        {NEWSLETTER_HEADING.split("\n").map((line, index) => (
          <span key={line}>
            {index > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </h2>

      {phase === "success" ? (
        <p className="rich-text t-p-md">Thanks for signing up.</p>
      ) : (
        <form
          className={`${SIGNUP_STYLES.form} ${
            phase === "sending" ? SIGNUP_STYLES.isSubmitting : ""
          }`}
          action="#"
          onSubmit={handleSubmit}
          noValidate={false}
        >
          <div className={SIGNUP_STYLES.fieldWrapper}>
            <input
              className={SIGNUP_STYLES.input}
              type="email"
              name="email"
              required
              placeholder={NEWSLETTER_PLACEHOLDER}
              aria-label={NEWSLETTER_PLACEHOLDER}
              aria-invalid={fieldError ? "true" : "false"}
              aria-describedby={fieldError ? "newsletter-email-error" : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button className={SIGNUP_STYLES.icon} type="submit" disabled={phase === "sending"}>
              <span className="sr-only">Subscribe</span>
              <ArrowRight className="h-s-4 w-s-4 fill-current" />
            </button>
          </div>
          {fieldError ? (
            <p id="newsletter-email-error" className={SIGNUP_STYLES.fieldErrorMessage}>
              {fieldError}
            </p>
          ) : null}
          {generalError ? (
            <p className={SIGNUP_STYLES.generalErrorMessage}>{generalError}</p>
          ) : null}
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer shell (module 9858 `P`)                                              */
/* -------------------------------------------------------------------------- */

export interface SiteFooterProps {
  /** `showFooter` from module 4666 — the home page hides it entirely. */
  hidden?: boolean;
}

const FOOTER_SPACER =
  "min-h-[100vh] w-full desktop:h-auto desktop:aspect-[1728/600]";

export function SiteFooter({ hidden = false }: SiteFooterProps) {
  const footerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const [isLg, setIsLg] = useState(true);

  /* `lg` (1024px) is when the footer becomes `lg:fixed`; below it the spacer
     must not be rendered (module 9858 `H = useMediaQuery(screens.lg)`). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLg(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = footerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setFooterHeight(node.getBoundingClientRect().height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Parallax: `useTransform(scrollYProgress, [start, 1], [footerHeight / 2, 0])`.
     The original computes `start` from `documentValues.scrollHeight - innerHeight`
     and re-derives it on resize; a passive scroll listener reproduces it without
     pulling in Framer Motion. Disabled under `prefers-reduced-motion`. */
  useEffect(() => {
    if (hidden || footerHeight === 0 || !isLg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const inner = innerRef.current;
      const html = document.documentElement;
      if (!inner) return;
      const scrollable = html.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = window.scrollY / scrollable;
      const startRatio =
        (scrollable - (footerHeight > window.innerHeight ? footerHeight / 2 : footerHeight)) /
        scrollable;
      const t = Math.min(1, Math.max(0, (progress - startRatio) / Math.max(0.0001, 1 - startRatio)));
      const half = footerHeight / 2;
      inner.style.transform = `translateY(${(1 - t) * half}px)`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [footerHeight, hidden, isLg]);

  if (hidden) return null;

  return (
    <>
      {isLg ? (
        <div
          className={`z-Main ${FOOTER_SPACER}`}
          aria-hidden="true"
        />
      ) : null}

      <footer
        ref={footerRef}
        className={`lg:fixed lg:flex lg:items-center inset-x-0 bottom-0 z-Footer bg-yellow lg:justify-center ${FOOTER_SPACER}`}
        data-theme="yellow"
        data-scroll-lock-fill-gap="true"
      >
        <div className="absolute inset-x-0 bottom-full h-[20vh] bg-yellow" />

        <div
          ref={innerRef}
          className="ui-grid w-full max-w-site gap-y-12 pb-32 pt-32 lg:gap-y-0"
        >
          <div className="col-span-full lg:col-span-11 lg:col-start-3 xl:col-span-8 xl:col-start-3">
            <NewsletterSignUp />
          </div>

          <FooterContact className="t-footer-meta col-span-full lg:col-start-16 xl:col-start-16" />
        </div>
      </footer>
    </>
  );
}
