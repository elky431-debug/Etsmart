'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import { getTranslation, type Language } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Initialize from localStorage first (works immediately)
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('etsmart-language') as Language | null;
      if (savedLang && (savedLang === 'fr' || savedLang === 'en')) {
        return savedLang;
      }
    }
    return 'fr';
  });

  // Load language from user settings when user is available
  useEffect(() => {
    if (user) {
      loadLanguage();
    }
  }, [user]);

  const loadLanguage = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('language')
        .eq('user_id', user.id)
        .single();

      if (!error && data?.language && (data.language === 'fr' || data.language === 'en')) {
        setLanguageState(data.language);
        localStorage.setItem('etsmart-language', data.language);
      }
    } catch (error) {
      console.warn('Error loading language:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('etsmart-language', lang);

    // Save to database if user is logged in
    if (user) {
      try {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            language: lang,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });
      } catch (error) {
        console.warn('Error saving language:', error);
      }
    }
  };

  const t = (key: string): string => {
    return getTranslation(key, language);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

