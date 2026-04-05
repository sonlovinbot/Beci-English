import { useState } from 'react';
import { Sidebar, type Page } from './components/Sidebar';
import { AudioShadowing } from './components/AudioShadowing';
import { ListeningMenu } from './components/ListeningMenu';
import { AuthPage } from './components/AuthPage';
import { AuthProvider, useAuth } from './lib/auth';
import { Menu, X, Loader2 } from 'lucide-react';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('audio');

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'audio':
        return <AudioShadowing />;
      case 'listening':
        return <ListeningMenu />;
      default:
        return (
          <div className="max-w-5xl mx-auto p-4 md:p-8">
            <p className="text-slate-500 text-lg">Coming soon...</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-20 shadow-md">
        <h1 className="text-xl font-bold tracking-tight">BECI ENGLISH</h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1 hover:bg-slate-800 rounded-md transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-20 h-full w-64 md:w-auto transition-transform duration-300 ease-in-out`}>
        <Sidebar
          onClose={() => setIsMobileMenuOpen(false)}
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />
      </div>

      <main className="flex-1 overflow-y-auto w-full">
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
