"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function deleteContactSubmissions(ids: string[]): Promise<{ error?: string; deleted?: number }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return { error: auth.error };
  if (ids.length === 0) return { deleted: 0 };

  const result = await db.contactSubmission.deleteMany({
    where: { id: { in: ids } },
  });

  await createAuditLog({
    userId:     auth.session.user.id,
    action:     "CONTACT_SUBMISSION_DELETED",
    entityType: "contact_submission",
    entityId:   ids.join(","),
    details:    { ids, count: ids.length },
  });

  revalidatePath("/admin/contact-submissions");
  return { deleted: result.count };
}
