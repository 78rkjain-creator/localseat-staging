import { redirect } from "next/navigation";

export default function VoterImportDuplicatesRedirect() {
  redirect("/import/voters/duplicates");
}
