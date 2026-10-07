import type { Metadata } from "next";

import { SiteHeader } from "@/components/shell/SiteHeader";
import { RouteThemeSync } from "@/components/shell/RouteThemeSync";
import { FooterMount } from "@/components/shell/FooterMount";
import { MenuProvider, ThemeProvider, fontVariables } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Product & Brand Experience Agency - Gladeye",
  description:
    "Gladeye is a digital product and brand experience agency. Creative innovation for a regenerative future.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <ThemeProvider>
          <MenuProvider>
            <RouteThemeSync />
            <SiteHeader />
            <main className="bg-black">{children}</main>
            <FooterMount />
          </MenuProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
