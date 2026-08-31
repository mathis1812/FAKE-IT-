import Link from "next/link";

/**
 * Page 404. Relevée sur le modèle le 31/08 : un simple bloc centré, sans
 * illustration ni en-tête propre — l'en-tête partagé reste au-dessus.
 * Bluminoo n'en avait aucune et servait donc celle par défaut de Next.js,
 * qui ignore la palette du site (fond blanc, typographie système).
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="text-2xl font-bold text-white">Page not found</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/60">
        This page doesn&apos;t exist, or is no longer available.
      </p>
      <Link href="/" className="mt-6 text-sm font-semibold underline">
        Back to the studio
      </Link>
    </main>
  );
}
