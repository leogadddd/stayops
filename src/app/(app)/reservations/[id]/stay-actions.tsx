import type { ReactNode } from "react";
import { loadActionReservation } from "./action-page";
import { CheckInForm } from "./check-in-form";
import { CheckOutForm } from "./check-out-form";

/**
 * Check-in and check-out for a reservation: the same rules render as a full
 * page on direct visits and as a modal over the reservation. Staff can do
 * both, so callers only need a signed-in member.
 */
export interface StayActionPanel {
  title: string;
  description: string;
  unavailable?: string;
  form?: ReactNode;
}

export async function checkInPanel(organizationId: string, id: string): Promise<StayActionPanel> {
  const { reservation, guest, unit } = await loadActionReservation(organizationId, id);
  const base = { title: "Check in guest", description: `${guest.name} · ${unit.name}. Record the arrival and any handover notes.` };
  if (reservation.status !== "confirmed") return { ...base, unavailable: "Only a confirmed reservation can be checked in." };
  return { ...base, form: <CheckInForm reservationId={id} /> };
}

export async function checkOutPanel(organizationId: string, id: string): Promise<StayActionPanel> {
  const { reservation, guest, unit, property } = await loadActionReservation(organizationId, id);
  const base = { title: "Check out guest", description: `${guest.name} · ${unit.name}. Finish the stay and start the turnover checklist.` };
  if (reservation.status !== "checked_in") return { ...base, unavailable: "Only a checked-in reservation can be checked out." };
  return { ...base, form: <CheckOutForm reservationId={id} timeZone={property?.timezone ?? "Asia/Manila"} /> };
}
