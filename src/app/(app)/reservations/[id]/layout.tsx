import type { ReactNode } from "react";

/** `modal` holds money actions (payment, refund, deduction) opened over the reservation. */
export default function ReservationLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
