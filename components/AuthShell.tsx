import Link from "next/link";

export default function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="relative z-10 mb-8 text-center">
        <Link href="/" className="inline-block">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Blumin<span className="text-primary">oo</span>
          </h1>
        </Link>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.28em] text-neutral-500">
          Studio
        </p>
        <h2 className="font-display mt-8 text-2xl font-medium text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-400">
          {subtitle}
        </p>
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
