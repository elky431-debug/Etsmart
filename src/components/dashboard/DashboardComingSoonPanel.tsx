'use client';

export function DashboardComingSoonPanel({ title }: { title: string }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-black px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-10 text-center shadow-xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Etsmart</p>
        <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">{title}</h2>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          Cette fonctionnalité arrive bientôt. Merci pour ta patience.
        </p>
      </div>
    </div>
  );
}
