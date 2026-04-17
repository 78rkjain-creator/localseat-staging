import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ personId: string }>;
}

export default async function PersonRedirectPage({ params }: PageProps) {
  const { personId } = await params;
  redirect(`/voter-list/${personId}`);
}
