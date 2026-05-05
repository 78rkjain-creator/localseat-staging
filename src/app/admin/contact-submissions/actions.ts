"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function deleteContactSubmission(id: string): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return { error: auth.error };

  await db.contactSubmission.delete({ where: { id } });

  await createAuditLog({
    userId:     auth.session.user.id,
    action:     "CONTACT_SUBMISSION_DELETED",
    entityType: "contact_submission",
    entityId:   id,
    details:    { id },
  });

  revalidatePath("/admin/contact-submissions");
  return {};
}
