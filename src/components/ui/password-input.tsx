"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export function PasswordInput({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink/45 transition-colors hover:text-pine disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        disabled={props.disabled}
      >
        {isVisible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
