'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Globe, DollarSign, Target, Shield, Languages, Save, Lock, Eye, EyeOff } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardSettingsProps {
  user: SupabaseUser;
}

interface UserSettings {
  targetCountry: string;
  currency: string;
  preferredChannel: 'auto' | 'tiktok' | 'facebook' | 'instagram' | 'pinterest';
  aiPrudenceLevel: 'conservative' | 'balanced' | 'aggressive';
  language: string;
}

const defaultSettings: UserSettings = {
  targetCountry: 'FR',
  currency: 'EUR',
  preferredChannel: 'auto',
  aiPrudenceLevel: 'balanced',
  language: 'fr',
};

export function DashboardSettings({ user }: DashboardSettingsProps) {
  const { updatePassword } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // PGRST116 = no rows returned (not found)
      if (error) {
        // If table doesn't exist or row not found, use defaults silently
        if (error.code === 'PGRST116' || 
            error.code === '42P01' || 
            error.message?.includes('does not exist') ||
            error.message?.includes('Could not find the table')) {
          // Table doesn't exist or no settings found - use defaults
          // This is expected behavior, no need to log as error
          setIsLoading(false);
          return;
        }
        // For other errors, log but don't break the UI
        console.warn('Settings load warning:', error.message || error);
        setIsLoading(false);
        return;
      }

      if (data) {
        setSettings({
          targetCountry: data.target_country || defaultSettings.targetCountry,
          currency: data.currency || defaultSettings.currency,
          preferredChannel: data.preferred_channel || defaultSettings.preferredChannel,
          aiPrudenceLevel: data.ai_prudence_level || defaultSettings.aiPrudenceLevel,
          language: data.language || defaultSettings.language,
        });
      }
    } catch (error: any) {
      // Catch any unexpected errors, but don't break the UI
      // Table might not exist yet, which is fine - we use defaults
      if (error?.message && !error.message.includes('Could not find the table')) {
        console.warn('Settings load warning:', error?.message || error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          target_country: settings.targetCountry,
          currency: settings.currency,
          preferred_channel: settings.preferredChannel,
          ai_prudence_level: settings.aiPrudenceLevel,
          language: settings.language,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        // If table doesn't exist, inform user with helpful message
        if (error.code === '42P01' || 
            error.message?.includes('does not exist') ||
            error.message?.includes('Could not find the table')) {
          alert(
            'The user_settings table does not exist yet in Supabase.\n\n' +
            'To enable settings saving, execute the SQL schema in Supabase:\n' +
            '1. Open Supabase Dashboard → SQL Editor\n' +
            '2. Execute the part of the schema that creates the user_settings table\n' +
            '(See supabase/schema.sql in the project)'
          );
          setIsSaving(false);
          return;
        }
        throw error;
      }

      alert('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert('Error saving: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setIsChangingPassword(true);

    try {
      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Current password is incorrect');
        setIsChangingPassword(false);
        return;
      }

      // Update password
      await updatePassword(newPassword);
      
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        setPasswordSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Error changing password:', error);
      setPasswordError(error.message || 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Settings</h1>

        <div className="space-y-6">
          {/* General settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border-2 border-slate-200 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">General</h2>
            </div>

            <div className="space-y-4">
              {/* Target country */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Target country
                </label>
                <select
                  value={settings.targetCountry}
                  onChange={(e) => setSettings({ ...settings, targetCountry: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="FR">France</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="CA">Canada</option>
                  <option value="DE">Germany</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Main country for your Etsy sales
                </p>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} />
                    <span>Currency</span>
                  </div>
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD (C$)</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Languages size={16} />
                    <span>Language</span>
                  </div>
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="fr">French</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Marketing settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border-2 border-slate-200 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#00c9b7]/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#00c9b7]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Marketing</h2>
            </div>

            <div className="space-y-4">
              {/* Preferred channel */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Preferred advertising channel
                </label>
                <select
                  value={settings.preferredChannel}
                  onChange={(e) => setSettings({ ...settings, preferredChannel: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="auto">Automatic (AI recommended)</option>
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="pinterest">Pinterest</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  The AI will automatically choose the best channel if &quot;Automatic&quot; is selected
                </p>
              </div>
            </div>
          </motion.div>

          {/* AI settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl border-2 border-slate-200 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">AI Prudence Level</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  How should the AI evaluate risks?
                </label>
                <select
                  value={settings.aiPrudenceLevel}
                  onChange={(e) => setSettings({ ...settings, aiPrudenceLevel: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="conservative">Conservative (less risk, more selective)</option>
                  <option value="balanced">Balanced (recommended)</option>
                  <option value="aggressive">Aggressive (more opportunities, more risk)</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Influences how the AI evaluates market saturation and risks
                </p>
              </div>
            </div>
          </motion.div>

          {/* Password Change Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-xl border-2 border-slate-200 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Change Password</h2>
            </div>

            <div className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Current password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00d4ff] transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00d4ff] transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Must be at least 8 characters long
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Confirm new password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00d4ff] transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{passwordError}</p>
                </div>
              )}

              {/* Success Message */}
              {passwordSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">Password changed successfully!</p>
                </div>
              )}

              {/* Change Password Button */}
              <button
                onClick={handlePasswordChange}
                disabled={isChangingPassword}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock size={18} />
                <span>{isChangingPassword ? 'Changing...' : 'Change Password'}</span>
              </button>
            </div>
          </motion.div>

          {/* Save button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-end"
          >
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
            >
              <Save size={20} />
              <span>{isSaving ? 'Saving...' : 'Save settings'}</span>
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

