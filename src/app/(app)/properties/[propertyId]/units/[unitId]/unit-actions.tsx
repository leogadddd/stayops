import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { normalizeChecklistTemplate } from "@/lib/turnover";
import { getPropertyOrThrow, getUnitOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { BlockForms } from "../block-forms";
import { ChecklistTemplateEditor } from "../checklist-template-editor";
import { UnitStatusForm } from "../unit-status-form";

/**
 * Unit actions that open as a modal over the unit page and as a full page on
 * a direct visit. Each panel carries the same title, description and form
 * for both. Callers must have passed the owner guard.
 */
export interface UnitActionPanel {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  form: ReactNode;
}

async function loadUnit(organizationId: string, propertyId: string, unitId: string) {
  try {
    // The property first, so a foreign property never leads to a unit read.
    const property = await getPropertyOrThrow(organizationId, propertyId);
    const unit = await getUnitOrThrow(organizationId, unitId);
    if (unit.propertyId !== property.id) notFound();
    return { property, unit, back: { backHref: `/properties/${property.id}/units/${unit.id}`, backLabel: unit.name } };
  } catch (error) {
    if (error instanceof InventoryError) notFound();
    throw error;
  }
}

export async function statusPanel(organizationId: string, propertyId: string, unitId: string): Promise<UnitActionPanel> {
  const { property, unit, back } = await loadUnit(organizationId, propertyId, unitId);
  return {
    ...back,
    title: "Change status",
    description: `${unit.name} · Only active units take new bookings. Existing stays are kept.`,
    form: <UnitStatusForm propertyId={property.id} unitId={unit.id} current={unit.status} />,
  };
}

export async function blockPanel(organizationId: string, propertyId: string, unitId: string): Promise<UnitActionPanel> {
  const { property, unit, back } = await loadUnit(organizationId, propertyId, unitId);
  return {
    ...back,
    title: "Block dates",
    description: `${unit.name} · Close nights for repairs or preparation. They show on the calendar and can't be booked.`,
    form: <BlockForms propertyId={property.id} unitId={unit.id} />,
  };
}

export async function checklistPanel(organizationId: string, propertyId: string, unitId: string): Promise<UnitActionPanel> {
  const { property, unit, back } = await loadUnit(organizationId, propertyId, unitId);
  return {
    ...back,
    title: "Turnover checklist",
    description: `${unit.name} · Changes apply to future turnovers. Tasks already open keep their list.`,
    form: (
      <ChecklistTemplateEditor
        propertyId={property.id}
        unitId={unit.id}
        items={normalizeChecklistTemplate(unit.checklistTemplate)}
      />
    ),
  };
}
