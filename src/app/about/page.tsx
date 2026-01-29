'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, Target, Zap, Shield, Cpu, ArrowRight, Play, CheckCircle2, Eye } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import Link from 'next/link';

export default function AboutPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Cursor glow effect */}
      <div 
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 212, 255, 0.06), transparent 80%)`,
        }}
      />

      {/* Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mx-4 mt-4">
          <div className="max-w-7xl mx-auto px-6 py-4 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <Link href="/" className="group">
                <Logo size="md" showText={true} />
              </Link>
              <Link href="/">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-full transition-all">
                  <ArrowLeft size={16} />
                  Back
                </button>
              </Link>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 overflow-hidden">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00d4ff]/5 to-transparent" />
        <div className="absolute top-40 left-1/4 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#00c9b7]/5 rounded-full blur-[100px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
              <span className="text-sm text-slate-700">Powered by AI</span>
              <Cpu className="w-4 h-4 text-[#00d4ff]" />
            </motion.div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8"
            >
              <span className="text-slate-900">About</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">Etsmart</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              The AI analysis tool that turns your product ideas into{' '}
              <span className="text-slate-900 font-medium">Etsy wins</span>.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Mission */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mb-20"
        >
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#00d4ff]/5 to-[#00c9b7]/5 border border-[#00d4ff]/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                <Target size={28} className="text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Our Mission</h2>
            </div>
            <div className="space-y-4 text-lg text-slate-700 leading-relaxed">
              <p>
                Etsmart was built to help Etsy sellers make confident decisions before launching products.
                We believe every product deserves a chance to succeed—but only if it's launched at the right time,
                at the right price, with the right strategy.
              </p>
              <p>
                With <strong className="text-slate-900">our advanced AI</strong>, we analyze your AliExpress products and provide a complete analysis including:
                a <strong className="text-[#00d4ff]">Launch Potential Score</strong> (0-10), competitor analysis, pricing recommendations,
                launch simulation, and a complete marketing strategy with SEO tags, viral titles, and ad ideas.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mb-20"
        >
          <div className="text-center mb-12">
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Why Etsmart</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">What makes us</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">different</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Eye,
                title: 'Vision-based AI analysis',
                description: "Our AI analyzes your product image—not just the title—so the analysis is more accurate and reliable.",
                color: 'from-violet-500 to-purple-500',
              },
              {
                icon: Target,
                title: 'Launch Potential Score',
                description: 'Get a clear 0-10 score that evaluates market saturation, competition density, and product specificity to guide your launch decision.',
                color: 'from-[#00d4ff] to-[#00c9b7]',
              },
              {
                icon: Zap,
                title: 'Speed',
                description: 'Get a full analysis in seconds—no more hours of manual research.',
                color: 'from-amber-500 to-orange-500',
              },
              {
                icon: Shield,
                title: 'Reliability',
                description: 'Built on real Etsy market and competition signals—not rough guesses.',
                color: 'from-emerald-500 to-teal-500',
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="group p-8 bg-white border-2 border-slate-200 rounded-3xl hover:border-[#00d4ff]/30 hover:shadow-xl transition-all duration-300"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <Icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] p-12 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#00b8e6] to-[#00c9b7] opacity-50" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/10 rounded-full blur-[120px]" />
          
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm mb-6"
            >
              <CheckCircle2 size={40} className="text-white" />
            </motion.div>
            
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white">
              Ready to launch your
              <br />
              first product?
            </h2>
            <p className="text-white/90 mb-8 text-lg max-w-2xl mx-auto">
              Start for free and discover your products' potential in seconds.
            </p>
            <Link href="/app">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group inline-flex items-center gap-3 px-10 py-5 bg-white text-[#00d4ff] text-lg font-semibold rounded-full shadow-xl hover:shadow-2xl transition-all"
              >
                <Play size={20} className="fill-[#00d4ff]" />
                Start now
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <Link href="/">
              <Logo size="md" showText={true} />
            </Link>
            
            <div className="flex items-center gap-8 text-sm text-slate-500">
              <Link href="/about" className="hover:text-slate-900 transition-colors">About</Link>
              <Link href="/legal" className="hover:text-slate-900 transition-colors">Legal</Link>
              <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
            </div>
            
            <p className="text-sm text-slate-400">
              © 2026 Etsmart. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

