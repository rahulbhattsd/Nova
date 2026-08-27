import type { ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar';

export const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};
