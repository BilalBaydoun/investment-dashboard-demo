'use client';

import { Header } from '@/components/layout/Header';
import { Backtesting } from '@/components/dashboard/Backtesting';
import { CorrelationMatrix } from '@/components/dashboard/CorrelationMatrix';
import { InsiderTracker } from '@/components/dashboard/InsiderTracker';
import { SectorHeatmap } from '@/components/dashboard/SectorHeatmap';
import { PaperTrading } from '@/components/dashboard/PaperTrading';

export default function ToolsPage() {
  return (
    <div className="min-h-screen">
      <Header
        title="Research Tools"
        subtitle="Advanced analysis and trading tools"
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* Top Row: Sector Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectorHeatmap />
          <InsiderTracker />
        </div>

        {/* Backtesting */}
        <Backtesting />

        {/* Paper Trading & Correlation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <PaperTrading />
          <CorrelationMatrix />
        </div>
      </div>
    </div>
  );
}
