"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VoterImportModal } from "./import-modal";

export function ImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        Import CSV
      </Button>
      <VoterImportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
