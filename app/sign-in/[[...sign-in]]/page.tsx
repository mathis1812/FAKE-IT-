import { SignIn } from "@clerk/nextjs";
import AuthShell from "@/components/AuthShell";
import { clerkAppearance } from "@/lib/clerk-appearance";

const signInAppearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    // Inscription désactivée pour le moment
    footerAction: { display: "none" },
  },
};

export default function SignInPage() {
  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à Bluminoo Studio pour générer vos images et vidéos."
    >
      <SignIn
        appearance={signInAppearance}
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl="/"
      />
    </AuthShell>
  );
}
