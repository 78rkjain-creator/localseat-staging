"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NewListModal } from "./new-list-modal";

export function NewListButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="md">
        Create list from addresses
      </Button>
      <NewListModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
