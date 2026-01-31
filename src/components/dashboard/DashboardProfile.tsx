'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Save, Edit2, X } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface DashboardProfileProps {
  user: SupabaseUser;
}

export function DashboardProfile({ user }: DashboardProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (error) throw error;

      // Update user profile in public.users table
      const { error: profileError } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      setIsEditing(false);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert('Error saving: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(user.user_metadata?.full_name || '');
    setIsEditing(false);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Mon profil</h1>

        <div className="space-y-6">
          {/* Profile card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border-2 border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Informations personnelles</h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-[#00d4ff] hover:bg-[#00d4ff]/10 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                  <span>Modifier</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span>Nom complet</span>
                  </div>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                    placeholder="Votre nom"
                  />
                ) : (
                  <p className="px-4 py-3 bg-slate-50 rounded-xl text-slate-900">
                    {fullName || 'Non renseigné'}
                  </p>
                )}
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Mail size={16} />
                    <span>Email</span>
                  </div>
                </label>
                <p className="px-4 py-3 bg-slate-50 rounded-xl text-slate-600">
                  {user.email}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  L'email ne peut pas être modifié depuis cette page.
                </p>
              </div>

              {/* Edit actions */}
              {isEditing && (
                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    <Save size={18} />
                    <span>{isSaving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    <X size={18} />
                    <span>Annuler</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Account info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border-2 border-slate-200 p-6"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-4">Account Information</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Account type</span>
                <span className="font-semibold text-slate-900">Free</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Member since</span>
                <span className="font-semibold text-slate-900">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}





