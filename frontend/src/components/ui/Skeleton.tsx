

// ─── Base shimmer animation style ─────────────────────────────
const shimmerClass = "animate-pulse bg-zinc-800 rounded";

// ─── Single skeleton block ─────────────────────────────────────
export const SkeletonBlock = ({
  className = '',
}: {
  className?: string;
}) => <div className={`${shimmerClass} ${className}`} />;

// ─── A card-shaped skeleton ────────────────────────────────────
export const SkeletonCard = () => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
    <SkeletonBlock className="h-4 w-1/3" />
    <SkeletonBlock className="h-8 w-1/2" />
  </div>
);

// ─── A row-shaped skeleton (for tables / lists) ────────────────
export const SkeletonRow = () => (
  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 space-y-2">
    <div className="flex items-center justify-between">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-5 w-16 rounded-full" />
    </div>
    <SkeletonBlock className="h-3 w-1/2" />
    <div className="flex gap-2 pt-1">
      <SkeletonBlock className="h-8 w-20 rounded-lg" />
      <SkeletonBlock className="h-8 w-20 rounded-lg" />
    </div>
  </div>
);

// ─── Stats row skeleton (3 cards) ─────────────────────────────
export const SkeletonStats = ({ count = 3 }: { count?: number }) => (
  <div className={`grid grid-cols-2 sm:grid-cols-${count} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// ─── Full-page loading overlay ─────────────────────────────────
export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
        <div className="absolute inset-0 rounded-full border-2 border-t-zinc-100 animate-spin" />
      </div>
      <p className="text-zinc-500 text-sm">Loading…</p>
    </div>
  </div>
);

// ─── Table skeleton ────────────────────────────────────────────
export const SkeletonTable = ({ rows = 5, cols = 5 }: { rows?: number, cols?: number }) => (
  <div className="w-full">
    {/* Fake header row */}
    <div className="flex items-center gap-4 p-4 border-b border-zinc-800 bg-zinc-900/50">
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBlock key={i} className="h-4 flex-1" />
      ))}
    </div>
    {/* Fake body rows */}
    <div className="divide-y divide-zinc-800/50 bg-zinc-950">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 p-4">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} className={`h-4 flex-1 ${c === 0 ? 'w-1/4' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);
