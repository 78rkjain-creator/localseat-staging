"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NewListModal } from "./new-list-modal";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  tags?: Tag[];
}

export function NewListButton({ tags = [] }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="md">
        Create list from addresses
      </Button>
      <NewListModal open={open} onClose={() => setOpen(false)} tags={tags} />
    </>
  );
}
