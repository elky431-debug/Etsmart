'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Globe, Save, Lock, Eye, EyeOff, ChevronDown, Check, CreditCard, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscription } from '@/lib/subscriptions';

interface DashboardSettingsProps {
  user: SupabaseUser;
}

interface UserSettings {
  targetCountry: string;
}

interface SubscriptionInfo {
  status: 'active' | 'canceling' | 'canceled' | 'none';
  plan?: string;
  cancelAt?: string;
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
          bg-white/5
          border-2 rounded-lg
          font-semibold text-white
          transition-all duration-300 ease-out
          flex items-center gap-3
          backdrop-blur-sm
          ${isOpen 
            ? 'border-[#00d4ff] shadow-xl shadow-[#00d4ff]/25 ring-2 ring-[#00d4ff]/30 bg-white/10' 
            : 'border-white/10 hover:border-[#00d4ff]/60 hover:shadow-lg hover:shadow-[#00d4ff]/10'
          }
        `}
      >
        {/* Icon */}
        {Icon && (
          <Icon 
            size={18} 
            className={`transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-white/60'}`} 
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
            className={`transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-white/60'}`} 
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
              bg-black rounded-lg border-2 border-white/10
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
                        : 'hover:bg-white/5'
                      }
                    `}
                  >
                    {/* Option icon */}
                    {OptionIcon && (
                      <OptionIcon 
                        size={16} 
                        className={`transition-colors ${
                          isSelected ? 'text-[#00d4ff]' : 'text-white/60 group-hover:text-[#00d4ff]'
                        }`} 
                      />
                    )}
                    
                    {/* Option label */}
                    <span className={`flex-1 font-medium ${
                      isSelected ? 'text-[#00d4ff]' : 'text-white/80'
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
};

export function DashboardSettings({ user }: DashboardSettingsProps) {
  const { updatePassword } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo>({ status: 'none' });
  
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
  const [isRefreshingSubscription, setIsRefreshingSubscription] = useState(false);

  // Load subscription status
  const loadSubscriptionStatus = async (showLoading = false) => {
    try {
      if (showLoading) {
        setIsRefreshingSubscription(true);
      }

      if (!user?.id) {
        console.log('[Settings] No user ID, skipping subscription check');
        if (showLoading) setIsRefreshingSubscription(false);
        return;
      }

      // Use getUserSubscription which checks both database and Stripe
      const subscription = await getUserSubscription(user.id);
      console.log('[Settings] Subscription data:', subscription);

      if (subscription && subscription.status === 'active') {
        // Check if subscription is set to cancel
        if (subscription.cancel_at_period_end) {
          setSubscriptionInfo({
            status: 'canceling',
            plan: subscription.plan_id,
            cancelAt: subscription.current_period_end,
          });
        } else {
          setSubscriptionInfo({
            status: 'active',
            plan: subscription.plan_id,
          });
        }
      } else {
        console.log('[Settings] No active subscription found');
        setSubscriptionInfo({ status: 'none' });
      }
    } catch (error) {
      console.error('[Settings] Error loading subscription status:', error);
      setSubscriptionInfo({ status: 'none' });
    } finally {
      if (showLoading) {
        setIsRefreshingSubscription(false);
      }
    }
  };

  useEffect(() => {
    loadSettings();
    loadSubscriptionStatus();
  }, [user]);

  // Reload subscription status when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        loadSubscriptionStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
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
    <div className="p-4 md:p-8 bg-black">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

        <div className="space-y-6">
          {/* General settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 rounded-lg border border-white/10 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#00d4ff]/20 flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <h2 className="text-xl font-bold text-white">General</h2>
            </div>

            <div className="space-y-4">
              {/* Target country */}
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
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
                <p className="mt-1 text-xs text-white/60">
                  Main country for your Etsy sales
                </p>
              </div>
            </div>
          </motion.div>

          {/* Password Change Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 rounded-lg border border-white/10 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Change Password</h2>
            </div>

            <div className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  Current password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 bg-white/5 border-2 border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all text-white placeholder:text-white/40"
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-[#00d4ff] transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 bg-white/5 border-2 border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all text-white placeholder:text-white/40"
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-[#00d4ff] transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-white/60">
                  Must be at least 8 characters long
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2">
                  Confirm new password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 bg-white/5 border-2 border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all text-white placeholder:text-white/40"
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-[#00d4ff] transition-colors"
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

          {/* Subscription Management Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`bg-white/5 rounded-lg border p-6 ${
              subscriptionInfo.status === 'canceling' || subscriptionInfo.status === 'none'
                ? 'border-[#00d4ff]/30'
                : 'border-red-500/30'
            }`}
          >
            {/* Refresh button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => loadSubscriptionStatus(true)}
                disabled={isRefreshingSubscription}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all disabled:opacity-50"
                title="Rafraîchir le statut d'abonnement"
              >
                <RefreshCw size={16} className={isRefreshingSubscription ? 'animate-spin' : ''} />
                <span>{isRefreshingSubscription ? 'Actualisation...' : 'Actualiser'}</span>
              </button>
            </div>
            {/* Active subscription - show cancel option */}
            {subscriptionInfo.status === 'active' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-red-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Cancel Subscription</h2>
                </div>

                <div className="bg-red-500/10 rounded-lg p-4 mb-5 border border-red-500/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-300 font-medium mb-1">
                        Are you sure you want to cancel?
                      </p>
                      <p className="text-sm text-red-200/80">
                        You will lose access to all premium features at the end of your current billing period. 
                        Your analyses history will be preserved.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
                      return;
                    }

                    setIsCanceling(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      
                      if (!session?.access_token) {
                        alert('Please sign in to cancel your subscription');
                        return;
                      }

                      const response = await fetch('/api/cancel-subscription', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${session.access_token}`,
                          'Content-Type': 'application/json',
                        },
                      });

                      const data = await response.json();

                      if (!response.ok) {
                        if (data.error === 'No active subscription found') {
                          alert('You don\'t have an active subscription to cancel.');
                        } else {
                          throw new Error(data.error || 'Failed to cancel subscription');
                        }
                        return;
                      }

                      alert('Subscription canceled successfully. You will retain access until the end of your billing period.');
                      // Reload subscription status to get updated info
                      await loadSubscriptionStatus();
                    } catch (error: any) {
                      console.error('Error canceling subscription:', error);
                      alert(error.message || 'Failed to cancel subscription. Please try again.');
                    } finally {
                      setIsCanceling(false);
                    }
                  }}
                  disabled={isCanceling}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 border-2 border-red-500/30 text-red-400 font-semibold rounded-lg hover:bg-red-500/20 hover:border-red-500/50 transition-all disabled:opacity-50"
                >
                  <XCircle size={18} />
                  <span>{isCanceling ? 'Canceling...' : 'Cancel my subscription'}</span>
                </button>
              </>
            )}

            {/* No subscription - show subscribe option */}
            {subscriptionInfo.status === 'none' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#00d4ff]/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-[#00d4ff]" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Subscription</h2>
                </div>

                <div className="bg-[#00d4ff]/10 rounded-lg p-4 mb-5 border border-[#00d4ff]/20">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-[#00d4ff] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-[#00d4ff] font-medium mb-1">
                        No active subscription
                      </p>
                      <p className="text-sm text-white/70">
                        Subscribe to unlock all premium features and analyze unlimited products.
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  <CreditCard size={18} />
                  <span>Subscribe now</span>
                </a>
              </>
            )}
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
              className="flex items-center gap-2 px-8 py-4 bg-white/10 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/20 transition-all disabled:opacity-50"
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

