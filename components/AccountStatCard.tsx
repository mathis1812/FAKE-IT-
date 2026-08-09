import type { ReactNode } from "react";
import Panel from "@/components/Panel";

export default function AccountStatCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-soft">
          {icon}
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-primary-soft">
          {title}
        </h3>
      </div>
      <div className="mt-4">{children}</div>
    </Panel>
  );
}
