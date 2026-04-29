import { redirect } from "next/navigation";

export default function VoterImportRedirect() {
  redirect("/import/voters");
}
