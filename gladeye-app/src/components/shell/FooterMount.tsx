"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/shell/SiteFooter";

/**
 * Home and Contact own the full viewport and suppress the shell footer.
 * Contact's page chunk calls setShowFooter(false) on mount and restores it on
 * cleanup; current live DOM also contains no newsletter or footer on Contact.
 * Unmount it on hidden routes so its mount-scoped height observer is cleaned
 * up and measures the new footer DOM when a visible route returns.
 * Other routes retain the shared footer instance.
 */
export function FooterMount() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/contact") return null;
  return <SiteFooter />;
}
