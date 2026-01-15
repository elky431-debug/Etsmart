'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Globe, DollarSign, Target, Shield, Languages, Save } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
            'La table user_settings n\'existe pas encore dans Supabase.\n\n' +
            'Pour activer la sauvegarde des réglages, exécutez le schéma SQL dans Supabase:\n' +
            '1. Ouvrez Supabase Dashboard → SQL Editor\n' +
            '2. Exécutez la partie du schéma qui crée la table user_settings\n' +
            '(Voir supabase/schema.sql dans le projet)'
          );
          setIsSaving(false);
          return;
        }
        throw error;
      }

      alert('Réglages enregistrés avec succès !');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert('Erreur lors de la sauvegarde: ' + (error?.message || 'Erreur inconnue'));
    } finally {
      setIsSaving(false);
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
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Réglages</h1>

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
              <h2 className="text-xl font-bold text-slate-900">Général</h2>
            </div>

            <div className="space-y-4">
              {/* Target country */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Pays cible
                </label>
                <select
                  value={settings.targetCountry}
                  onChange={(e) => setSettings({ ...settings, targetCountry: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="FR">France</option>
                  <option value="US">États-Unis</option>
                  <option value="GB">Royaume-Uni</option>
                  <option value="CA">Canada</option>
                  <option value="DE">Allemagne</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Pays principal pour vos ventes Etsy
                </p>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} />
                    <span>Devise</span>
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
                    <span>Langue</span>
                  </div>
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="fr">Français</option>
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
                  Canal publicitaire préféré
                </label>
                <select
                  value={settings.preferredChannel}
                  onChange={(e) => setSettings({ ...settings, preferredChannel: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="auto">Automatique (recommandé par l&apos;IA)</option>
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="pinterest">Pinterest</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  L&apos;IA choisira automatiquement le meilleur canal si &quot;Automatique&quot; est sélectionné
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
              <h2 className="text-xl font-bold text-slate-900">Niveau de prudence IA</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Comment l&apos;IA doit-elle évaluer les risques ?
                </label>
                <select
                  value={settings.aiPrudenceLevel}
                  onChange={(e) => setSettings({ ...settings, aiPrudenceLevel: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/20 focus:border-[#00d4ff] transition-all"
                >
                  <option value="conservative">Conservateur (moins de risques, plus sélectif)</option>
                  <option value="balanced">Équilibré (recommandé)</option>
                  <option value="aggressive">Agressif (plus d&apos;opportunités, plus de risques)</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Influence la façon dont l&apos;IA évalue la saturation et les risques de marché
                </p>
              </div>
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
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les réglages'}</span>
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

