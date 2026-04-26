import { redirect } from "next/navigation";

export default function ConfirmedVoterListRedirect() {
  redirect("/people/voters");
}
