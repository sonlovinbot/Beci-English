import { useState } from 'react';
import { User, Lock, LogOut, Loader2, CheckCircle2, Globe, Eye, EyeOff, Palette, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useTheme, THEMES, THEME_SWATCHES, type ThemeColor } from '../lib/theme';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { themeColor, setThemeColor } = useTheme();

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePassword = async () => {
    setPasswordMsg(null);

    if (!newPassword || !confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMsg({ type: 'error', text: error.message });
      } else {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'Failed to update password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Settings</h2>
        <p className="text-slate-500 mt-2 text-base md:text-lg">Manage your account and preferences.</p>
      </header>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <User size={18} className="text-indigo-500" />
            Profile
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Email</label>
              <p className="text-slate-800 bg-slate-50 rounded-lg px-4 py-2.5 text-sm border border-slate-200">
                {user?.email || 'No email'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Account ID</label>
              <p className="text-slate-500 bg-slate-50 rounded-lg px-4 py-2.5 text-xs font-mono border border-slate-200 truncate">
                {user?.id || '-'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Member since</label>
              <p className="text-slate-800 bg-slate-50 rounded-lg px-4 py-2.5 text-sm border border-slate-200">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Theme Picker */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Palette size={18} className="text-indigo-500" />
            Menu Color
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(THEMES) as ThemeColor[]).map(key => {
              const isActive = themeColor === key;
              return (
                <button
                  key={key}
                  onClick={() => setThemeColor(key)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    isActive ? 'border-indigo-500 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-full h-10 rounded-lg ${THEME_SWATCHES[key]}`} />
                  <span className="text-xs font-medium text-slate-700">{THEMES[key].label}</span>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Lock size={18} className="text-indigo-500" />
            Change Password
          </h3>

          {passwordMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`px-4 py-3 rounded-lg mb-4 text-sm ${
                passwordMsg.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {passwordMsg.type === 'success' && <CheckCircle2 size={14} className="inline mr-1" />}
              {passwordMsg.text}
            </motion.div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={passwordLoading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-5 rounded-xl text-sm transition-all"
            >
              {passwordLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              Update Password
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Globe size={18} className="text-indigo-500" />
            About
          </h3>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>App</span>
              <span className="font-medium text-slate-800">English City Campus</span>
            </div>
            <div className="flex justify-between">
              <span>AI Engine</span>
              <span className="font-medium text-slate-800">Google Gemini</span>
            </div>
            <div className="flex justify-between">
              <span>Backend</span>
              <span className="font-medium text-slate-800">Supabase</span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-5 md:p-6">
          <h3 className="font-semibold text-red-700 mb-4">Danger Zone</h3>
          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
