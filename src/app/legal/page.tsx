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
            <Logo size={32} />
            <span className="text-xl font-bold bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">
              Etsmart
            </span>
          </Link>
          <Link 
            href="/"
            className="flex items-center gap-2 text-slate-600 hover:text-cyan-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
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
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Legal Notice</h1>
            <p className="text-slate-600">Last updated: January 28, 2025</p>
          </div>

          {/* Content */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 space-y-8">
            
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <FileText className="w-6 h-6 text-cyan-500" />
                Company Information
              </h2>
              <div className="bg-slate-50 rounded-xl p-6 space-y-2">
                <p className="text-slate-700"><strong>Company Name:</strong> Etsmart</p>
                <p className="text-slate-700"><strong>Legal Form:</strong> SAS (Société par Actions Simplifiée)</p>
                <p className="text-slate-700"><strong>Headquarters:</strong> Paris, France</p>
                <p className="text-slate-700"><strong>Email:</strong> contact@etsmart.app</p>
                <p className="text-slate-700"><strong>Website:</strong> https://etsmart.app</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Shield className="w-6 h-6 text-cyan-500" />
                Terms of Service
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>
                  By accessing and using Etsmart, you agree to be bound by these Terms of Service. 
                  If you do not agree with any part of these terms, you may not use our service.
                </p>
                
                <h3 className="text-lg font-semibold text-slate-800 mt-6">1. Service Description</h3>
                <p>
                  Etsmart is an AI-powered product analysis tool designed to help Etsy sellers 
                  evaluate product potential before launching. Our service provides market analysis, 
                  competition assessment, and pricing recommendations.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">2. User Accounts</h3>
                <p>
                  To use Etsmart, you must create an account with a valid email address. You are 
                  responsible for maintaining the confidentiality of your account credentials and 
                  for all activities that occur under your account.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">3. Subscription and Billing</h3>
                <p>
                  Etsmart offers subscription plans with monthly billing. Subscriptions automatically 
                  renew unless canceled before the end of the billing period. Refunds are not provided 
                  for partial months of service.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">4. Acceptable Use</h3>
                <p>
                  You agree not to misuse our service, including but not limited to: attempting to 
                  access unauthorized features, sharing account credentials, or using the service 
                  for any illegal purposes.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">5. Disclaimer</h3>
                <p>
                  The analysis and recommendations provided by Etsmart are for informational purposes 
                  only. We do not guarantee specific sales results or business outcomes. Users are 
                  responsible for their own business decisions.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">6. Limitation of Liability</h3>
                <p>
                  Etsmart shall not be liable for any indirect, incidental, special, consequential, 
                  or punitive damages resulting from your use of or inability to use the service.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">7. Modifications</h3>
                <p>
                  We reserve the right to modify these terms at any time. Continued use of the service 
                  after changes constitutes acceptance of the new terms.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Intellectual Property</h2>
              <p className="text-slate-600">
                All content, features, and functionality of Etsmart, including but not limited to 
                text, graphics, logos, and software, are the exclusive property of Etsmart and are 
                protected by international copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Governing Law</h2>
              <p className="text-slate-600">
                These terms shall be governed by and construed in accordance with the laws of France. 
                Any disputes arising from these terms shall be subject to the exclusive jurisdiction 
                of the courts of Paris, France.
              </p>
            </section>

          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">© 2025 Etsmart. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/legal" className="text-cyan-600 font-medium">Legal</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

