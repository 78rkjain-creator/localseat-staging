"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CsvImportModal } from "./csv-import-modal";

interface CsvImportButtonProps {
  listId: string;
}

export function CsvImportButton({ listId }: CsvImportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        Import CSV
      </Button>
      <CsvImportModal
        open={open}
        onClose={() => setOpen(false)}
        listId={listId}
      />
    </>
  );
}
