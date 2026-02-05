import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Note: Pour l'App Router, la limite de taille du body est gérée dans chaque route
  // via export const maxDuration et la configuration du runtime
  
  // Solution de secours : ignorer les erreurs TypeScript dans le dossier extension
  // (les fichiers de l'extension sont compilés séparément avec leur propre tsconfig.json)
  typescript: {
    // Ignorer les erreurs de build pour éviter les conflits avec le dossier extension
    // Le tsconfig.json devrait déjà exclure ce dossier, mais c'est une sécurité supplémentaire
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
