import { DashboardComingSoonPanel } from '@/components/dashboard/DashboardComingSoonPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DashboardKeywordsPage() {
  return (
    <div className="min-h-screen bg-black">
      <DashboardComingSoonPanel title="Analyse de keyword" />
    </div>
  );
}
