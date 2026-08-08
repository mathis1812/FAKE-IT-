import { redirect } from "next/navigation";
import Panel from "@/components/Panel";
import PlaceholderSection from "@/components/PlaceholderSection";
import { createClient } from "@/lib/supabase/server";

type GalleryEntry = {
  id: string;
  mode: "image" | "video";
  result_url: string;
  label: string;
  created_at: string;
};

export default async function GaleriePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: entries } = await supabase
    .from("gallery_entries")
    .select("id, mode, result_url, label, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<GalleryEntry[]>();

  if (!entries || entries.length === 0) {
    return (
      <PlaceholderSection
        eyebrow="Galerie"
        title="Vos prochaines générations apparaîtront ici."
        description="Chaque génération réussie (image ou vidéo) est automatiquement sauvegardée sur votre compte — générez votre première photo ou vidéo pour la voir apparaître."
      />
    );
  }

  return (
    <div className="animate-fade-up mx-auto max-w-6xl py-8">
      <div className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Galerie
        </p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-white">
          Vos dernières générations
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry) => (
          <Panel key={entry.id} className="overflow-hidden">
            {entry.mode === "video" ? (
              <video
                src={entry.result_url}
                controls
                muted
                loop
                playsInline
                className="aspect-square w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.result_url}
                alt={entry.label}
                className="aspect-square w-full object-cover"
              />
            )}
            <div className="p-3">
              <p className="text-xs font-medium text-neutral-200">
                {entry.label}
              </p>
              <p className="text-[11px] text-neutral-600">
                {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
