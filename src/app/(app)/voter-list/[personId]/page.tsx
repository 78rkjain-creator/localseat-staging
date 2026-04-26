import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ personId: string }>;
}

export default async function VoterListPersonRedirect({ params }: PageProps) {
  const { personId } = await params;
  redirect(`/people/${personId}`);
}
