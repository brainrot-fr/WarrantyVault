export function GlassSkeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-primary/tint ${className}`} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="glass-surface rounded-glass p-5 sm:p-6" aria-label="Loading content">
      <GlassSkeleton className="mb-4 h-4 w-1/3" />
      <GlassSkeleton className="mb-3 h-7 w-2/3" />
      <GlassSkeleton className="h-4 w-1/2" />
    </div>
  );
}
