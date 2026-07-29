import { redirect } from "next/navigation";

/** Inscription temporairement désactivée — redirige vers la connexion. */
export default function SignUpPage() {
  redirect("/sign-in");
}
