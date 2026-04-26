import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ personId: string }>;
}

export default async function ConfirmedPersonRedirect({ params }: PageProps) {
  const { personId } = await params;
  redirect(`/people/${personId}`);
}
