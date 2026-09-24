"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface ActionFeedbackState {
  error?: string;
  success?: boolean;
}

export interface InformationalToast {
  type?: "info" | "warning" | "success";
  message: string;
  description?: string;
}

type ActionFeedbackOptions<State> = {
  success?: string | ((state: State) => string);
  errorTitle?: string;
  getInformation?: (state: State) => InformationalToast | null;
};

export function showActionFeedback<State extends ActionFeedbackState>(
  state: State,
  options: ActionFeedbackOptions<State> = {},
) {
  if (state.error) {
    toast.error(options.errorTitle ?? "That didn’t work", {
      description: state.error,
    });
    return;
  }

  if (state.success && options.success) {
    toast.success(
      typeof options.success === "function" ? options.success(state) : options.success,
    );
    return;
  }

  const information = options.getInformation?.(state);
  if (information) {
    toast[information.type ?? "info"](information.message, {
      description: information.description,
    });
  }
}

export function useActionFeedback<State extends ActionFeedbackState>(
  state: State,
  options: ActionFeedbackOptions<State> = {},
) {
  const previous = useRef(state);

  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;

    showActionFeedback(state, options);
  }, [options, state]);
}
