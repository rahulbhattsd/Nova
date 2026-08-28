import type { ReactNode } from 'react';
import { PlusCircle, LayoutDashboard, CheckSquare, FolderGit2, HardDrive, FileText, Settings, Shield, Activity, Search, Briefcase, FileSignature, Presentation } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

const SidebarItem = ({ icon, label, active }: SidebarItemProps) => (
  <button className={cn(
    "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors",
    active ? "bg-secondary text-secondary-foreground font-medium" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
  )}>
    {icon}
    <span>{label}</span>
  </button>
);

const SidebarSection = ({ title, children }: { title: string, children: ReactNode }) => (
  <div className="mb-6">
    <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
      {title}
    </h3>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

export const Sidebar = () => {
  return (
    <aside className="w-64 h-screen border-r bg-background flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">NOVA</h1>
      </div>

      <div className="p-4">
        <button className="w-full flex items-center justify-center space-x-2 bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors">
          <PlusCircle size={18} />
          <span className="font-medium">New Task</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <SidebarSection title="Workspace">
          <SidebarItem active icon={<LayoutDashboard size={18} />} label="Overview" />
          <SidebarItem icon={<CheckSquare size={18} />} label="Tasks" />
          <SidebarItem icon={<FolderGit2 size={18} />} label="Projects" />
          <SidebarItem icon={<HardDrive size={18} />} label="Memory" />
          <SidebarItem icon={<FileText size={18} />} label="Files" />
          <SidebarItem icon={<Activity size={18} />} label="Automations" />
        </SidebarSection>

        <SidebarSection title="Career">
          <SidebarItem icon={<Search size={18} />} label="Job Search" />
          <SidebarItem icon={<Briefcase size={18} />} label="Jobs" />
          <SidebarItem icon={<FileSignature size={18} />} label="Applications" />
          <SidebarItem icon={<FileText size={18} />} label="Resume" />
          <SidebarItem icon={<Presentation size={18} />} label="Interview Prep" />
        </SidebarSection>

        <SidebarSection title="Agents">
          <SidebarItem icon={<Search size={18} />} label="Research" />
          <SidebarItem icon={<LayoutDashboard size={18} />} label="Browser" />
          <SidebarItem icon={<FolderGit2 size={18} />} label="Coding" />
        </SidebarSection>
      </div>

      <div className="p-2 border-t">
        <SidebarSection title="System">
          <SidebarItem icon={<Settings size={18} />} label="Settings" />
          <SidebarItem icon={<Activity size={18} />} label="Usage" />
          <SidebarItem icon={<Shield size={18} />} label="Security" />
        </SidebarSection>
      </div>
    </aside>
  );
};
