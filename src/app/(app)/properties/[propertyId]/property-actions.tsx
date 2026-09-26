import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPropertyOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { HouseRulesForm } from "./house-rules-form";

/**
 * Property actions that open as a modal over the property page and as a full
 * page on a direct visit. Callers must have passed the owner guard.
 */
export interface PropertyActionPanel {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  form: ReactNode;
}

export async function houseRulesPanel(organizationId: string, propertyId: string): Promise<PropertyActionPanel> {
  let property;
  try {
    property = await getPropertyOrThrow(organizationId, propertyId);
  } catch (error) {
    if (error instanceof InventoryError) notFound();
    throw error;
  }
  return {
    title: "House rules",
    description: `${property.name} · Shown to guests on their booking link.`,
    backHref: `/properties/${property.id}`,
    backLabel: property.name,
    form: <HouseRulesForm propertyId={property.id} defaultValue={property.houseRules ?? ""} />,
  };
}
