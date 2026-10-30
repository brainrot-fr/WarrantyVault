import { useState } from 'react';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassChip } from '../components/ui/GlassChip';
import { GlassInput } from '../components/ui/GlassInput';
import { GlassModal } from '../components/ui/GlassModal';
import { GlassSkeleton } from '../components/ui/GlassSkeleton';
import { useToast } from '../context/ToastContext';

export function DesignShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Design system preview</p>
        <h1>Liquid glass, made useful.</h1>
        <p>Preview the shared components, status states, focus treatments, and loading surfaces.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <h2 className="mb-4 font-heading text-3xl font-semibold">Buttons & feedback</h2>
          <div className="flex flex-wrap gap-3">
            <GlassButton onClick={() => toast('Your changes are safely stored.')}>Primary action</GlassButton>
            <GlassButton variant="secondary">Secondary</GlassButton>
            <GlassButton variant="ghost">Quiet action</GlassButton>
            <GlassButton variant="danger">Destructive</GlassButton>
            <GlassButton loading>Saving</GlassButton>
          </div>
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-heading text-3xl font-semibold">Expiry status chips</h2>
          <div className="flex flex-wrap gap-2">
            <GlassChip status="active" />
            <GlassChip status="expiring" />
            <GlassChip status="expired" />
            <GlassChip status="active">Warranty still active</GlassChip>
          </div>
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-heading text-3xl font-semibold">Inputs & dialog</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassInput label="Product name" placeholder="Espresso machine" />
            <GlassInput label="Purchase date" type="date" />
          </div>
          <GlassButton className="mt-5" onClick={() => setModalOpen(true)}>Open dialog</GlassButton>
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-heading text-3xl font-semibold">Skeleton loading</h2>
          <div className="grid gap-3">
            <GlassSkeleton className="h-4 w-1/3" />
            <GlassSkeleton className="h-7 w-2/3" />
            <GlassSkeleton className="h-4 w-1/2" />
          </div>
        </GlassCard>
      </div>
      <GlassModal open={modalOpen} title="A calmer way to keep receipts" onClose={() => setModalOpen(false)}>
        <p className="mb-6 text-muted-foreground">This dialog uses the shared glass surface, keyboard dismissal, and a clear focusable close control.</p>
        <GlassButton onClick={() => setModalOpen(false)}>Got it</GlassButton>
      </GlassModal>
    </main>
  );
}
