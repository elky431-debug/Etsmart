'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, 
  Check, 
  Sparkles, 
  TrendingUp, 
  DollarSign, 
  Shield,
  Zap,
  BarChart3,
  Target,
  Users,
  Star,
  Play,
  ChevronRight,
  Cpu,
  LineChart,
  ShoppingBag,
  ArrowUpRight,
  Globe,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function HomePage() {
  const { user, loading } = useAuth();
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

  const features = [
    {
      icon: Cpu,
      title: 'Advanced AI Analysis',
      description: 'Our AI deeply analyzes the Etsy market and predicts your products\' potential.',
    },
    {
      icon: LineChart,
      title: 'Realistic Simulation',
      description: 'Simulate your sales with conservative, realistic, and optimistic projections.',
    },
    {
      icon: Target,
      title: 'Optimal Pricing',
      description: 'Receive pricing recommendations based on competition and your margins.',
    },
    {
      icon: Shield,
      title: 'Risk Detection',
      description: 'Identify saturated markets and avoid costly mistakes before launching.',
    },
    {
      icon: ShoppingBag,
      title: 'Competitor Analysis',
      description: 'Discover who dominates your niche and how to differentiate effectively.',
    },
    {
      icon: Sparkles,
      title: 'Intelligent Verdict',
      description: 'A clear and actionable verdict: Launch, Competitive Market, or Avoid.',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Products analyzed' },
    { value: '2.5K+', label: 'Active sellers' },
    { value: '95%', label: 'AI accuracy' },
    { value: '24/7', label: 'Availability' },
  ];

  const testimonials = [
    {
      name: 'Marie Laurent',
      role: 'Etsy Pro Seller',
      content: 'Etsmart saved me from launching 3 products that would have been failures. The AI analysis is impressively accurate.',
      avatar: 'M',
      rating: 5,
    },
    {
      name: 'Thomas Dubois',
      role: 'Dropshipper',
      content: 'The Launch/Avoid verdict saves me hours of research. Essential for any serious seller.',
      avatar: 'T',
      rating: 5,
    },
    {
      name: 'Sophie Martin',
      role: 'POD Creator',
      content: 'The pricing recommendations are spot-on. I increased my margins by 40% thanks to Etsmart.',
      avatar: 'S',
      rating: 5,
    },
  ];

  const plans = [
    {
      name: 'Smart',
      price: '$29.99',
      period: '/month',
      description: 'For Etsy sellers starting out or intermediate, who want to test products seriously without multiplying errors.',
      features: ['15 analyses / month', 'Competition & saturation analysis', 'Simplified launch simulation', 'Basic product sheet', 'Analysis history'],
      cta: 'Get started',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$49.99',
      period: '/month',
      description: 'For active sellers who want to structure their decisions and improve their marketing performance on Etsy.',
      features: ['30 analyses / month', 'Complete launch simulation', 'Complete product sheet', 'Advanced marketing', 'TikTok ideas & ad channel', 'AI ad image prompt'],
      cta: 'Choose plan',
      popular: true,
    },
    {
      name: 'Scale',
      price: '$79.99',
      period: '/month',
      description: 'For advanced sellers, high-volume shops, or users who want to test many products strategically.',
      features: ['100 analyses / month', 'Advanced simulation (risk/effort)', 'Extended market analysis', 'Advanced history organization', 'Early access to new features (beta)'],
      cta: 'Choose plan',
      popular: false,
    },
  ];

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
              {/* Logo */}
              <Link href="/" className="group">
                <Logo size="md" showText={true} />
              </Link>

              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Features
                </a>
                <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Pricing
                </a>
                <a href="#testimonials" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Testimonials
                </a>
                <Link href="/about" className="text-slate-600 hover:text-slate-900 transition-colors">
                  About
                </Link>
              </nav>

              {/* CTA */}
              <div className="flex items-center gap-4">
                {!loading && user ? (
                  // Utilisateur connecté - afficher seulement Dashboard
                  <Link href="/dashboard">
                    <button className="px-5 py-2.5 bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold rounded-full flex items-center gap-2 shadow-lg shadow-[#00d4ff]/20 transition-all">
                      <span className="text-white">Dashboard</span>
                      <ArrowRight size={16} className="text-white" />
                    </button>
                  </Link>
                ) : (
                  // User not logged in - show Login and Create account
                  <>
                    <Link href="/login" className="hidden sm:block text-slate-600 hover:text-slate-900 transition-colors">
                      Login
                    </Link>
                    <Link href="/register">
                      <button className="px-5 py-2.5 bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold rounded-full flex items-center gap-2 shadow-lg shadow-[#00d4ff]/20 transition-all">
                        <span className="text-white">Create account</span>
                        <ArrowRight size={16} className="text-white" />
                      </button>
                    </Link>
                  </>
                )}
              </div>
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
              <span className="text-sm text-slate-700">Powered by AI • GPT-4</span>
              <Cpu className="w-4 h-4 text-[#00d4ff]" />
            </motion.div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8"
            >
              <span className="text-slate-900">Launch profitable products</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">on Etsy</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Our AI analyzes your AliExpress products and reveals{' '}
              <span className="text-slate-900 font-medium">their real potential</span> on Etsy.
              <br className="hidden sm:block" />
              No more costly failures, launch with confidence.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link href="/app">
                <button className="group flex items-center gap-3 px-8 py-4 bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold rounded-full shadow-xl shadow-[#00d4ff]/20 hover:shadow-[#00d4ff]/30 transition-all">
                  <Play size={18} className="fill-white" />
                  Analyze my product
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <a href="#features">
                <button className="flex items-center gap-2 px-8 py-4 bg-white border border-slate-200 text-slate-800 font-medium rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all">
                  Discover features
                  <ChevronRight size={18} />
                </button>
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          style={{ opacity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-slate-300 flex justify-center pt-2">
            <motion.div 
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative bg-slate-50">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Features</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Everything you need to</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">dominate on Etsy</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              A complete suite of AI tools to analyze, simulate and optimize 
              your product launches.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-8 bg-white border border-slate-200 rounded-3xl hover:border-[#00d4ff]/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#00d4ff] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-[150px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">How it works</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Analyze in</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">3 steps</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                icon: ShoppingBag,
                title: 'Choose your niche',
                description: 'Select from our popular niches or enter your own.',
              },
              {
                step: '02',
                icon: Globe,
                title: 'Add your products',
                description: 'Paste the AliExpress link or enter your product details.',
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'Get your verdict',
                description: 'Our AI analyzes and gives you a clear and actionable verdict.',
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                {/* Connector line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-20 left-full w-full h-px">
                    <div className="w-3/4 h-full bg-gradient-to-r from-[#00d4ff]/50 to-transparent" />
                  </div>
                )}
                
                <div className="text-center">
                  <div className="relative inline-flex mb-8">
                    <div className="w-20 h-20 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <item.icon className="w-8 h-8 text-[#00d4ff]" />
                    </div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#00d4ff] flex items-center justify-center text-sm font-bold text-white shadow-lg">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <Link href="/app">
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold rounded-full shadow-lg shadow-[#00d4ff]/20 transition-all">
                Get started now
                <ArrowRight size={18} />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 relative bg-slate-50">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Pricing</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Transparent</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">pricing</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Start for free, upgrade when you're ready.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-8 rounded-3xl ${
                  plan.popular 
                    ? 'bg-white border-2 border-[#00d4ff] shadow-xl' 
                    : 'bg-white border border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-[#00d4ff] text-white text-sm font-semibold rounded-full shadow-lg">
                      Most popular
                    </span>
                  </div>
                )}
                
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-6">{plan.description}</p>
                
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">{plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
                
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#00d4ff]/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-[#00d4ff]" />
                      </div>
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link href="/pricing">
                  <button 
                    className={`w-full py-3.5 rounded-full font-semibold transition-all ${
                      plan.popular 
                        ? 'bg-[#00d4ff] hover:bg-[#00b8e6] text-white shadow-lg shadow-[#00d4ff]/20' 
                        : 'bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-32 relative bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Testimonials</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">They trust</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">us</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 bg-slate-50 border border-slate-200 rounded-3xl"
              >
                <div className="flex items-center gap-1 mb-6">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-8 leading-relaxed">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#00d4ff] flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden bg-[#00d4ff]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00b8e6] to-[#00c9b7] opacity-50" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/10 rounded-full blur-[150px]" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8 text-white">
              Ready to launch your
              <br />
              next success?
            </h2>
            <p className="text-white/80 text-lg mb-12 max-w-2xl mx-auto">
              Join thousands of sellers using Etsmart to 
              make better decisions and maximize their profits.
            </p>
            <Link href="/app">
              <button className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-lg font-semibold rounded-full shadow-xl hover:shadow-2xl transition-all">
                Start for free
                <ArrowUpRight size={20} className="text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </Link>
            <p className="mt-6 text-white/60 text-sm flex items-center justify-center gap-2">
              <Lock size={14} />
              No credit card required
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00d4ff] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">
                Ets<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">mart</span>
              </span>
            </Link>
            
            <div className="flex items-center gap-8 text-sm text-slate-500">
              <a href="#" className="hover:text-slate-900 transition-colors">Legal</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Contact</a>
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
