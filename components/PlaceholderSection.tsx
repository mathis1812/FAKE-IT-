import Panel from "@/components/Panel";

type PlaceholderSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
};

/** Page de contenu "bientôt disponible", réutilisée par les sections encore vides du menu. */
export default function PlaceholderSection({
  eyebrow,
  title,
  description,
}: PlaceholderSectionProps) {
  return (
    <div className="animate-fade-up mx-auto max-w-2xl py-12">
      <Panel className="p-8 text-center sm:p-10">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground/50">
          {description}
        </p>
      </Panel>
    </div>
  );
}
