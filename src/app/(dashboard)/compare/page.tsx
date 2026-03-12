'use client';

import { Header } from '@/components/layout/Header';
import { StockComparison } from '@/components/dashboard/StockComparison';

export default function ComparePage() {
  return (
    <div className="min-h-screen">
      <Header
        title="Stock Comparison"
        subtitle="Compare up to 4 stocks side by side"
      />

      <div className="p-3 md:p-6">
        <StockComparison />
      </div>
    </div>
  );
}
