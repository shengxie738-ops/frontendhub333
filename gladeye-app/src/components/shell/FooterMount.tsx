"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/shell/SiteFooter";

/**
 * The live site keeps one footer in the shell and lets the page hide it: the
 * FlowerValley hero calls `setShowFooter(false)` because the WebGL scene owns
 * the whole viewport. Everything else — /work, case studies, /about, /contact,
 * /careers — shows it.
 */
export function FooterMount() {
  const pathname = usePathname();
  return <SiteFooter hidden={pathname === "/"} />;
}
