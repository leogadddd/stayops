import type { ReactNode } from "react";

/** `modal` holds unit actions (status, blocks, checklist) opened over the unit. */
export default function UnitLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
