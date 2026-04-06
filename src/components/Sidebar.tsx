import { type ReactNode } from 'react';
import { BookOpen, Headphones, Settings, User, LogOut, ListMusic, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';

export type Page = 'audio' | 'listening' | 'listeningTest' | 'reading' | 'progress' | 'settings';

interface SidebarProps {
  onClose?: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ onClose, currentPage, onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    if (onClose) onClose();
  };

  const navItem = (page: Page, label: string, icon: ReactNode) => {
    const isActive = currentPage === page;
    return (
      <button
        onClick={() => { onNavigate(page); onClose?.(); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
          isActive
            ? 'bg-indigo-600/20 text-indigo-400'
            : 'hover:bg-slate-800 text-slate-300'
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 h-full flex flex-col shadow-xl md:shadow-none">
      <div className="p-6 hidden md:block">
        <h1 className="text-2xl font-bold text-white tracking-tight">BECI ENGLISH</h1>
      </div>

      <nav className="flex-1 px-4 py-6 md:py-0 space-y-2 overflow-y-auto">
        {navItem('audio', 'Audio & Shadowing', <Headphones size={20} />)}
        {navItem('listening', 'Listening', <ListMusic size={20} />)}
        {navItem('listeningTest', 'Listening Test', <ClipboardCheck size={20} />)}
        {navItem('reading', 'Reading Practice', <BookOpen size={20} />)}
        {navItem('progress', 'My Progress', <User size={20} />)}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        {user && (
          <div className="px-4 py-2 text-xs text-slate-500 truncate" title={user.email || ''}>
            {user.email}
          </div>
        )}
        {navItem('settings', 'Settings', <Settings size={20} />)}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-600/10 text-red-400 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
