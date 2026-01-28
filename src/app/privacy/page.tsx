'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { ArrowLeft, Shield, Eye, Lock, Database, Cookie, Mail } from 'lucide-react';

export default function PrivacyPage() {
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
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
            <p className="text-slate-600">Last updated: January 28, 2025</p>
          </div>

          {/* Content */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 space-y-8">
            
            <section>
              <p className="text-lg text-slate-600 leading-relaxed">
                At Etsmart, we take your privacy seriously. This Privacy Policy explains how we collect, 
                use, disclose, and safeguard your information when you use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Database className="w-6 h-6 text-cyan-500" />
                Information We Collect
              </h2>
              <div className="space-y-4 text-slate-600">
                <h3 className="text-lg font-semibold text-slate-800">Personal Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Email address (required for account creation)</li>
                  <li>Name (optional)</li>
                  <li>Payment information (processed securely by Stripe)</li>
                </ul>

                <h3 className="text-lg font-semibold text-slate-800 mt-6">Usage Data</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Product URLs analyzed</li>
                  <li>Analysis history</li>
                  <li>Feature usage statistics</li>
                  <li>Device and browser information</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Eye className="w-6 h-6 text-cyan-500" />
                How We Use Your Information
              </h2>
              <div className="space-y-3 text-slate-600">
                <p>We use the information we collect to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide and maintain our service</li>
                  <li>Process your transactions and manage your subscription</li>
                  <li>Send you important updates about your account</li>
                  <li>Improve our AI analysis algorithms</li>
                  <li>Respond to your inquiries and provide customer support</li>
                  <li>Detect and prevent fraud or abuse</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Lock className="w-6 h-6 text-cyan-500" />
                Data Security
              </h2>
              <div className="bg-cyan-50 rounded-xl p-6 border border-cyan-100">
                <p className="text-slate-700">
                  We implement industry-standard security measures to protect your data:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-4 text-slate-600">
                  <li>SSL/TLS encryption for all data transmission</li>
                  <li>Secure password hashing</li>
                  <li>Regular security audits</li>
                  <li>Access controls and authentication</li>
                  <li>Payment processing via PCI-compliant Stripe</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Cookie className="w-6 h-6 text-cyan-500" />
                Cookies
              </h2>
              <div className="space-y-3 text-slate-600">
                <p>
                  We use cookies and similar technologies to enhance your experience:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Essential cookies:</strong> Required for the service to function</li>
                  <li><strong>Analytics cookies:</strong> Help us understand how you use our service</li>
                  <li><strong>Preference cookies:</strong> Remember your settings and preferences</li>
                </ul>
                <p className="mt-4">
                  You can control cookies through your browser settings. However, disabling certain 
                  cookies may affect the functionality of our service.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Data Retention</h2>
              <p className="text-slate-600">
                We retain your personal information for as long as your account is active or as needed 
                to provide you with our services. If you close your account, we will delete your data 
                within 30 days, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Rights (GDPR)</h2>
              <div className="space-y-3 text-slate-600">
                <p>Under the General Data Protection Regulation (GDPR), you have the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Access your personal data</li>
                  <li>Rectify inaccurate data</li>
                  <li>Request deletion of your data</li>
                  <li>Object to data processing</li>
                  <li>Data portability</li>
                  <li>Withdraw consent at any time</li>
                </ul>
                <p className="mt-4">
                  To exercise any of these rights, please contact us at{' '}
                  <a href="mailto:privacy@etsmart.app" className="text-cyan-600 hover:underline">
                    privacy@etsmart.app
                  </a>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Third-Party Services</h2>
              <div className="space-y-3 text-slate-600">
                <p>We use the following third-party services:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Stripe:</strong> Payment processing</li>
                  <li><strong>Supabase:</strong> Database and authentication</li>
                  <li><strong>OpenAI:</strong> AI-powered analysis</li>
                  <li><strong>Netlify:</strong> Hosting</li>
                </ul>
                <p className="mt-4">
                  Each of these services has their own privacy policy governing how they handle your data.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Mail className="w-6 h-6 text-cyan-500" />
                Contact Us
              </h2>
              <div className="bg-slate-50 rounded-xl p-6">
                <p className="text-slate-700">
                  If you have any questions about this Privacy Policy, please contact us:
                </p>
                <div className="mt-4 space-y-2">
                  <p className="text-slate-600">
                    <strong>Email:</strong>{' '}
                    <a href="mailto:privacy@etsmart.app" className="text-cyan-600 hover:underline">
                      privacy@etsmart.app
                    </a>
                  </p>
                  <p className="text-slate-600">
                    <strong>Website:</strong>{' '}
                    <a href="https://etsmart.app/contact" className="text-cyan-600 hover:underline">
                      etsmart.app/contact
                    </a>
                  </p>
                </div>
              </div>
            </section>

          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">© 2025 Etsmart. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/legal" className="hover:text-slate-900 transition-colors">Legal</Link>
            <Link href="/privacy" className="text-cyan-600 font-medium">Privacy</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

