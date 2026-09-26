"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteGuestAction } from "../actions";

export function DeleteGuestButton({ guestId, name }: { guestId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmationDialog
      title={`Delete ${name}?`}
      description="This permanently removes the guest profile. Only guests who have never had a reservation can be deleted."
      confirmLabel="Delete"
      successMessage="Guest deleted."
      onConfirm={async () => {
        const result = await deleteGuestAction(guestId);
        if (result.error) throw new Error(result.error);
        router.replace("/guests");
        router.refresh();
      }}
      trigger={<><Trash2 className="h-4 w-4" aria-hidden />Delete</>}
      triggerClassName="text-clay-deep hover:bg-clay-mist/70"
    />
  );
}
