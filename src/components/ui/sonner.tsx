"use client";

import { useEffect } from "react";
import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";

const FLASH_KEY = "stayops-toast";

export type ToastKind = "success" | "error" | "info" | "warning";

export function setToastAfterNavigation(kind: ToastKind, message: string) {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ kind, message }));
}

export function StayOpsToaster() {
  useEffect(() => {
    const value = sessionStorage.getItem(FLASH_KEY);
    if (!value) return;
    sessionStorage.removeItem(FLASH_KEY);
    try {
      const flash = JSON.parse(value) as { kind?: ToastKind; message?: string };
      if (flash.kind && flash.message) toast[flash.kind](flash.message);
    } catch {
      // Ignore invalid or stale browser data.
    }
  }, []);

  return (
    <Sonner
      className="stayops-toaster"
      position="bottom-right"
      offset={{ bottom: 18, right: 18 }}
      mobileOffset={{ bottom: 12, right: 12, left: 12 }}
      duration={4500}
      gap={10}
      visibleToasts={4}
      closeButton
      icons={{
        success: <CircleCheck className="h-5 w-5" />,
        error: <CircleX className="h-5 w-5" />,
        info: <Info className="h-5 w-5" />,
        warning: <TriangleAlert className="h-5 w-5" />,
        loading: <LoaderCircle className="h-5 w-5 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "stayops-toast",
          title: "stayops-toast-title",
          description: "stayops-toast-description",
          closeButton: "stayops-toast-close",
        },
      }}
    />
  );
}
