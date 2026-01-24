'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Globe, DollarSign, Target, Shield, Languages, Save, Lock, Eye, EyeOff, ChevronDown, Check, Sparkles, Facebook, Instagram, Share2, Trash2, AlertTriangle } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardSettingsProps {
  user: SupabaseUser;
}

interface UserSettings {
  targetCountry: string;
  currency: string;
  preferredChannel: 'auto' | 'all' | 'tiktok' | 'facebook' | 'instagram' | 'pinterest';
  aiPrudenceLevel: 'conservative' | 'balanced' | 'aggressive';
  language: string;
}

interface FilterDropdownProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ComponentType<{ size?: number; className?: string }> }[];
  placeholder?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
}

function FilterDropdown<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon: Icon,
  className = '',
}: FilterDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative w-full px-4 py-3.5 pr-11
          bg-gradient-to-br from-white via-white to-slate-50
          border-2 rounded-xl
          font-semibold text-slate-900
          transition-all duration-300 ease-out
          flex items-center gap-3
          backdrop-blur-sm
          ${isOpen 
            ? 'border-[#00d4ff] shadow-xl shadow-[#00d4ff]/25 ring-2 ring-[#00d4ff]/30 bg-gradient-to-br from-[#00d4ff]/5 via-white to-[#00c9b7]/5' 
            : 'border-slate-200 hover:border-[#00d4ff]/60 hover:shadow-lg hover:shadow-[#00d4ff]/10'
          }
        `}
      >
        {/* Icon */}
        {Icon && (
          <Icon 
            size={18} 
            className={`transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-slate-500'}`} 
          />
        )}
        
        {/* Selected value */}
        <span className="flex-1 text-left">
          {selectedOption?.label || placeholder}
        </span>

        {/* Chevron icon */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute right-3"
        >
          <ChevronDown 
            size={18} 
            className={`transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-slate-400'}`} 
          />
        </motion.div>

        {/* Gradient overlay when open */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-gradient-to-r from-[#00d4ff]/5 to-[#00c9b7]/5 rounded-xl pointer-events-none"
          />
        )}
      </motion.button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 z-50
              bg-white rounded-xl border-2 border-slate-200
              shadow-2xl shadow-[#00d4ff]/15
              overflow-hidden
              backdrop-blur-xl"
          >
            <div className="max-h-64 overflow-y-auto">
              {options.map((option, index) => {
                const OptionIcon = option.icon;
                const isSelected = option.value === value;
                
                return (
                  <motion.button
                    key={option.value}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ backgroundColor: 'rgba(0, 212, 255, 0.05)' }}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-3.5 text-left
                      flex items-center gap-3
                      transition-all duration-200 ease-out
                      relative group
                      ${isSelected 
                        ? 'bg-gradient-to-r from-[#00d4ff]/15 via-[#00d4ff]/10 to-[#00c9b7]/15 border-l-4 border-[#00d4ff]' 
                        : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-50/50'
                      }
                    `}
                  >
                    {/* Option icon */}
                    {OptionIcon && (
                      <OptionIcon 
                        size={16} 
                        className={`transition-colors ${
                          isSelected ? 'text-[#00d4ff]' : 'text-slate-400 group-hover:text-[#00d4ff]'
                        }`} 
                      />
                    )}
                    
                    {/* Option label */}
                    <span className={`flex-1 font-medium ${
                      isSelected ? 'text-[#00d4ff]' : 'text-slate-700'
                    }`}>
                      {option.label}
                    </span>

                    {/* Checkmark for selected */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center"
                      >
                        <Check size={12} className="text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const defaultSettings: UserSettings = {
  targetCountry: 'ALL', // Default to "All countries"
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
  
  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDeleteAccount = async () => {
    // Verify confirmation text
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type "DELETE" to confirm');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete account');
      }

      // Account deleted successfully - redirect to home
      alert('Your account has been deleted successfully.');
      window.location.href = '/';
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setDeleteError(error.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
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
                <FilterDropdown
                  value={settings.targetCountry}
                  onChange={(value) => setSettings({ ...settings, targetCountry: value })}
                  options={[
                    { value: 'ALL', label: 'All countries', icon: Globe },
                    { value: 'FR', label: 'France', icon: Globe },
                    { value: 'US', label: 'United States', icon: Globe },
                    { value: 'GB', label: 'United Kingdom', icon: Globe },
                    { value: 'CA', label: 'Canada', icon: Globe },
                    { value: 'DE', label: 'Germany', icon: Globe },
                  ]}
                  icon={Globe}
                />
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
                <FilterDropdown
                  value={settings.currency}
                  onChange={(value) => setSettings({ ...settings, currency: value })}
                  options={[
                    { value: 'EUR', label: 'EUR (€)', icon: DollarSign },
                    { value: 'USD', label: 'USD ($)', icon: DollarSign },
                    { value: 'GBP', label: 'GBP (£)', icon: DollarSign },
                    { value: 'CAD', label: 'CAD (C$)', icon: DollarSign },
                  ]}
                  icon={DollarSign}
                />
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Languages size={16} />
                    <span>Language</span>
                  </div>
                </label>
                <FilterDropdown
                  value={settings.language}
                  onChange={(value) => setSettings({ ...settings, language: value })}
                  options={[
                    { value: 'fr', label: 'French', icon: Languages },
                    { value: 'en', label: 'English', icon: Languages },
                  ]}
                  icon={Languages}
                />
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
                <FilterDropdown
                  value={settings.preferredChannel}
                  onChange={(value) => setSettings({ ...settings, preferredChannel: value as any })}
                  options={[
                    { value: 'auto', label: 'Automatic (AI recommended)', icon: Sparkles },
                    { value: 'all', label: 'All channels', icon: Target },
                    { value: 'tiktok', label: 'TikTok', icon: Sparkles },
                    { value: 'facebook', label: 'Facebook', icon: Facebook },
                    { value: 'instagram', label: 'Instagram', icon: Instagram },
                    { value: 'pinterest', label: 'Pinterest', icon: Share2 },
                  ]}
                  icon={Target}
                />
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
                <FilterDropdown
                  value={settings.aiPrudenceLevel}
                  onChange={(value) => setSettings({ ...settings, aiPrudenceLevel: value as any })}
                  options={[
                    { value: 'conservative', label: 'Conservative (less risk, more selective)', icon: Shield },
                    { value: 'balanced', label: 'Balanced (recommended)', icon: Shield },
                    { value: 'aggressive', label: 'Aggressive (more opportunities, more risk)', icon: Shield },
                  ]}
                  icon={Shield}
                />
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

          {/* Delete Account Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-red-50 rounded-xl border-2 border-red-200 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-900">Delete Account</h2>
                <p className="text-sm text-red-700 mt-1">
                  Permanently delete your account and all associated data
                </p>
              </div>
            </div>

            {!showDeleteConfirm ? (
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-lg border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900 mb-2">
                        This action cannot be undone
                      </p>
                      <p className="text-sm text-red-700">
                        Deleting your account will permanently remove:
                      </p>
                      <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                        <li>All your product analyses</li>
                        <li>All your saved products</li>
                        <li>Your subscription and settings</li>
                        <li>Your account and login credentials</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                  <span>Delete My Account</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-lg border-2 border-red-300">
                  <p className="text-sm font-semibold text-red-900 mb-3">
                    Type <strong className="font-mono">DELETE</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => {
                      setDeleteConfirmText(e.target.value);
                      setDeleteError(null);
                    }}
                    placeholder="Type DELETE"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono"
                  />
                </div>

                {deleteError && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-sm text-red-700">{deleteError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                      setDeleteError(null);
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        <span>Delete Account</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Save button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
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

