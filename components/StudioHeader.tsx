"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import AuthControls from "@/components/AuthControls";

export type StudioMode = "image" | "video";

type StudioHeaderProps = {
  mode?: StudioMode;
  onModeChange?: (mode: StudioMode) => void;
  showModeSwitch?: boolean;
};

const NAV = [
  { href: "/", label: "Studio" },
  { href: "/galerie", label: "Galerie" },
  { href: "/aide", label: "Aide" },
] as const;

function NavLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`text-xs font-semibold uppercase tracking-[0.14em] transition ${
        active
          ? "text-primary"
          : "text-neutral-400 hover:text-neutral-100"
      }`}
    >
      {label}
    </Link>
  );
}

export default function StudioHeader({
  mode = "image",
  onModeChange,
  showModeSwitch = false,
}: StudioHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/55 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-baseline gap-3">
            <span className="font-display text-3xl font-semibold tracking-tight text-white">
              Blumin<span className="text-primary">oo</span>
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500 sm:inline">
              Studio
            </span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex" aria-label="Principal">
            {NAV.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {showModeSwitch && onModeChange && (
            <div className="hidden rounded-full border border-white/10 bg-white/[0.03] p-1 sm:inline-flex">
              {(["image", "video"] as StudioMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModeChange(m)}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition duration-200 ${
                    mode === m
                      ? "bg-primary text-ink"
                      : "text-neutral-400 hover:text-neutral-100"
                  }`}
                >
                  {m === "image" ? "Image" : "Vidéo"}
                </button>
              ))}
            </div>
          )}

          <div className="hidden sm:block">
            <AuthControls />
          </div>

          <button
            type="button"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-neutral-200 transition hover:border-primary/40 hover:text-white md:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              {open ? (
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M3 5h10M3 8h10M3 11h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          id={menuId}
          className="border-t border-white/[0.06] bg-ink/95 px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-4" aria-label="Mobile">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>

          {showModeSwitch && onModeChange && (
            <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 sm:hidden">
              {(["image", "video"] as StudioMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onModeChange(m);
                    setOpen(false);
                  }}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    mode === m
                      ? "bg-primary text-ink"
                      : "text-neutral-400 hover:text-neutral-100"
                  }`}
                >
                  {m === "image" ? "Image" : "Vidéo"}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-white/[0.06] pt-4 sm:hidden">
            <AuthControls />
          </div>
        </div>
      )}
    </header>
  );
}
