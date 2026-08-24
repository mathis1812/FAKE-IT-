import { redirect } from "next/navigation";
import GalleryGrid from "@/components/GalleryGrid";
import PlaceholderSection from "@/components/PlaceholderSection";
import { createClient } from "@/lib/supabase/server";

type GalleryEntry = {
  id: string;
  mode: "image" | "video";
  result_url: string;
  label: string;
  created_at: string;
};

export default async function GalleryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
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
        eyebrow="Gallery"
        title="Your next generations will show up here."
        description="Every successful generation (photo or video) is automatically saved to your account — generate your first photo or video to see it appear."
      />
    );
  }

  return (
    <div className="animate-fade-up mx-auto max-w-6xl py-8">
      <div className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Gallery
        </p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-white">
          Your latest generations
        </h2>
      </div>
      <GalleryGrid entries={entries} />
    </div>
  );
}
