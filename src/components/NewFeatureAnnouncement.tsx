"use client";

import { useEffect, useState } from "react";

export function NewFeatureAnnouncement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const storageKey = "etsmart-feature-listing-image-v2-seen";
    const seen = sessionStorage.getItem(storageKey);
    if (!seen) {
      setVisible(true);
      sessionStorage.setItem(storageKey, "true");
      const t = setTimeout(() => setVisible(false), 9000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-[120] max-w-sm rounded-xl border border-[#00d4ff]/40 bg-[#0b0f14]/95 p-4 shadow-2xl shadow-[#00d4ff]/20 backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#00d4ff]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Nouvelle fonctionnalité</p>
          <p className="mt-1 text-xs leading-relaxed text-white/80">
            Listings et generation d'image ameliores: resultats plus opti, plus propres et plus performants.
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="ml-1 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Fermer"
        >
          x
        </button>
      </div>
    </div>
  );
}

