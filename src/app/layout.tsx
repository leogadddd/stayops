import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { StayOpsToaster } from "@/components/ui/sonner";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        {children}
        <StayOpsToaster />
      </body>
    </html>
  );
}
