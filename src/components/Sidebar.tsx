import { BookOpen, Headphones, Settings, User, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    if (onClose) onClose();
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 h-full flex flex-col shadow-xl md:shadow-none">
      <div className="p-6 hidden md:block">
        <h1 className="text-2xl font-bold text-white tracking-tight">BECI ENGLISH</h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 md:py-0 space-y-2 overflow-y-auto">
        <a href="#" onClick={onClose} className="flex items-center gap-3 px-4 py-3 bg-indigo-600/20 text-indigo-400 rounded-lg font-medium">
          <Headphones size={20} />
          Audio & Shadowing
        </a>
        <a href="#" onClick={onClose} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-lg transition-colors">
          <BookOpen size={20} />
          Reading Practice
        </a>
        <a href="#" onClick={onClose} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-lg transition-colors">
          <User size={20} />
          My Progress
        </a>
      </nav>
      
      <div className="p-4 border-t border-slate-800 space-y-2">
        {/* User info */}
        {user && (
          <div className="px-4 py-2 text-xs text-slate-500 truncate" title={user.email || ''}>
            {user.email}
          </div>
        )}
        <a href="#" onClick={onClose} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-lg transition-colors">
          <Settings size={20} />
          Settings
        </a>
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
