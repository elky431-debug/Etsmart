'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { ArrowLeft, Scale, FileText, Shield } from 'lucide-react';

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-teal-50/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="md" />
            <span className="text-xl font-bold bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">
              Etsmart
            </span>
          </Link>
          <Link 
            href="/"
            className="flex items-center gap-2 text-slate-600 hover:text-cyan-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/25">
              <Scale className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Mentions légales</h1>
            <p className="text-slate-600">Dernière mise à jour : 28 janvier 2025</p>
          </div>

          {/* Content */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 space-y-8">
            
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <FileText className="w-6 h-6 text-cyan-500" />
                Informations sur l'entreprise
              </h2>
              <div className="bg-slate-50 rounded-xl p-6 space-y-2">
                <p className="text-slate-700"><strong>Raison sociale :</strong> Etsmart</p>
                <p className="text-slate-700"><strong>Forme juridique :</strong> SAS (Société par Actions Simplifiée)</p>
                <p className="text-slate-700"><strong>Siège social :</strong> Paris, France</p>
                <p className="text-slate-700"><strong>Email :</strong> elky431@gmail.com</p>
                <p className="text-slate-700"><strong>Site web :</strong> https://etsmart.app</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Shield className="w-6 h-6 text-cyan-500" />
                Conditions d'utilisation
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>
                  En accédant et en utilisant Etsmart, vous acceptez d'être lié par ces Conditions d'utilisation. 
                  Si vous n'acceptez pas une partie de ces conditions, vous ne pouvez pas utiliser notre service.
                </p>
                
                <h3 className="text-lg font-semibold text-slate-800 mt-6">1. Description du service</h3>
                <p>
                  Etsmart est un outil d'analyse de produits alimenté par l'IA conçu pour aider les vendeurs Etsy 
                  à évaluer le potentiel d'un produit avant son lancement. Notre service fournit une analyse de marché, 
                  une évaluation de la concurrence et des recommandations de prix.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">2. Comptes utilisateurs</h3>
                <p>
                  Pour utiliser Etsmart, vous devez créer un compte avec une adresse email valide. Vous êtes 
                  responsable de maintenir la confidentialité de vos identifiants de compte et de toutes les 
                  activités qui se produisent sous votre compte.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">3. Abonnement et facturation</h3>
                <p>
                  Etsmart propose des plans d'abonnement avec facturation mensuelle. Les abonnements se renouvellent 
                  automatiquement sauf annulation avant la fin de la période de facturation. Aucun remboursement 
                  n'est fourni pour les mois partiels de service.
                </p>
                <p className="mt-3 font-semibold text-slate-800">
                  ⚠️ Important : Aucun remboursement ne sera accordé si l'utilisateur a déjà utilisé au moins un crédit. 
                  Une fois qu'un crédit a été consommé, l'abonnement devient non remboursable pour cette période de facturation.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">4. Utilisation acceptable</h3>
                <p>
                  Vous acceptez de ne pas utiliser abusivement notre service, notamment mais sans s'y limiter : tenter d'accéder 
                  à des fonctionnalités non autorisées, partager vos identifiants de compte, ou utiliser le service 
                  à des fins illégales.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">5. Avertissement</h3>
                <p>
                  Les analyses et recommandations fournies par Etsmart sont à titre informatif uniquement. Nous ne garantissons 
                  pas de résultats de ventes spécifiques ou de résultats commerciaux. Les utilisateurs sont responsables de 
                  leurs propres décisions commerciales.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">6. Limitation de responsabilité</h3>
                <p>
                  Etsmart ne sera pas responsable de tout dommage indirect, accessoire, spécial, consécutif ou punitif résultant 
                  de votre utilisation ou de votre incapacité à utiliser le service.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">7. Modifications</h3>
                <p>
                  Nous nous réservons le droit de modifier ces conditions à tout moment. L'utilisation continue du service 
                  après les modifications constitue une acceptation des nouvelles conditions.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Propriété intellectuelle</h2>
              <p className="text-slate-600">
                Tout le contenu, les fonctionnalités et les fonctionnalités d'Etsmart, y compris mais sans s'y limiter 
                le texte, les graphiques, les logos et les logiciels, sont la propriété exclusive d'Etsmart et sont 
                protégés par les lois internationales sur le droit d'auteur, les marques de commerce et autres lois sur la propriété intellectuelle.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Droit applicable</h2>
              <p className="text-slate-600">
                Ces conditions sont régies et interprétées conformément aux lois de la France. 
                Tout litige découlant de ces conditions sera soumis à la juridiction exclusive 
                des tribunaux de Paris, France.
              </p>
            </section>

          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">© 2025 Etsmart. Tous droits réservés.</p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/legal" className="text-cyan-600 font-medium">Mentions légales</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Confidentialité</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

