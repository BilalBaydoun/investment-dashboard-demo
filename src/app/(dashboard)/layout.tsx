'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { AutoSync } from '@/components/AutoSync';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AutoSync />
      <Sidebar />
      <main className="md:pl-64 transition-all duration-300 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
