import type { ReactNode } from "react";

/** `modal` holds property actions (house rules) opened over the property. */
export default function PropertyLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
