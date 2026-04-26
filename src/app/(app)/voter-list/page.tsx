import { redirect } from "next/navigation";

export default function VoterListRedirect() {
  redirect("/people/residents");
}
