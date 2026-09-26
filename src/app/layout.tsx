import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { StayOpsToaster } from "@/components/ui/sonner";
import { parseThemePreference, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "StayOps",
    template: "%s · StayOps",
  },
  description:
    "A calmer way to run your stays. Bookings, payments, turnovers and expenses for small stay operators.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        {children}
        <StayOpsToaster />
      </body>
    </html>
  );
}
