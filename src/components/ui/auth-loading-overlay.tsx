"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import greenLoader from "@/assets/stayops-loader-green.gif";
import whiteLoader from "@/assets/stayops-loader-white.gif";

export function AuthLoadingOverlay({
  label,
  tone = "light",
}: {
  label: string;
  tone?: "light" | "dark";
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Avoid a distracting flash when authentication resolves immediately.
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  const dark = tone === "dark";
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-6 ${dark ? "theme-keep-light bg-pine-deep/95 text-paper" : "bg-paper/95 text-pine"}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center text-center">
        <Image
          src={dark ? whiteLoader : greenLoader}
          alt=""
          width={112}
          height={112}
          unoptimized
          priority
          className={dark ? undefined : "dark:hidden"}
        />
        {dark ? null : (
          <Image src={whiteLoader} alt="" width={112} height={112} unoptimized className="hidden dark:block" />
        )}
        <p className="mt-4 text-sm font-medium">{label}</p>
      </div>
    </div>
  );
}
