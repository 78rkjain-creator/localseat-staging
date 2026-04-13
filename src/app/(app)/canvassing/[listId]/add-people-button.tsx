"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddPeopleModal } from "./add-people-modal";

interface Tag {
  id: string;
  name: string;
}

interface AddPeopleButtonProps {
  listId: string;
  tags: Tag[];
}

export function AddPeopleButton({ listId, tags }: AddPeopleButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        Add people
      </Button>
      <AddPeopleModal
        open={open}
        onClose={() => setOpen(false)}
        listId={listId}
        tags={tags}
      />
    </>
  );
}
