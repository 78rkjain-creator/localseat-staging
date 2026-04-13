"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AssignCanvasserModal } from "./assign-canvasser-modal";

interface AssignCanvasserButtonProps {
  listId: string;
  canvassers: { id: string; firstName: string; lastName: string }[];
  variant?: "primary" | "secondary";
  label?: string;
}

export function AssignCanvasserButton({
  listId,
  canvassers,
  variant = "primary",
  label = "Assign canvasser",
}: AssignCanvasserButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size="md" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AssignCanvasserModal
        open={open}
        onClose={() => setOpen(false)}
        listId={listId}
        canvassers={canvassers}
      />
    </>
  );
}
