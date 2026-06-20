import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wrench, ClipboardList, Package, Headphones, CheckCircle, Zap, Shield } from 'lucide-react';
import SubscribeButton from '@/components/SubscribeButton';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Wrench,
      title: 'Technician Requests',
      description: 'Technicians can quickly submit parts requests with tyre and brake measurements directly from the workshop floor.',
    },
    {
      icon: Package,
      title: 'Parts Interpreter Quotes',
      description: 'Parts interpreters receive requests instantly, upload quotes, and keep the workflow moving without delays.',
    },
    {
      icon: ClipboardList,
      title: 'Workshop Controller Approvals',
      description: 'Controllers review and approve quotes in one click, with full audit trails and approval notes.',
    },
    {
      icon: Headphones,
      title: 'Service Advisor Handoff',
      description: 'Advisors get AI-generated SMS drafts ready to send to customers — no manual writing needed.',
    },
  ];

  const benefits = [
    'Eliminate paper-based parts ordering',
    'Real-time status updates for all roles',
    'Built-in audit trail and history',
    'AI-generated customer SMS drafts',
    'Vehicle inspection reports',
    'Multi-business support',
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg leading-tight">My Workshop</span>
              <p className="text-xs text-slate-500 -mt-0.5">Flow</p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate('/login')} className="text-slate-600">
            Login
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Zap className="h-3.5 w-3.5" />
            Built for automotive service teams
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
            Streamline your workshop's
            <span className="text-slate-500"> parts ordering</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            Connect your technicians, parts interpreters, workshop controllers, and service advisors
            in one seamless workflow — from parts request to customer approval.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <SubscribeButton label="Start Free Trial — $49/month" size="lg" className="text-base px-8" />
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="text-base px-8">
              Login to your account
            </Button>
          </div>
          <p className="text-sm text-slate-400 mt-4">30-day free trial · Cancel anytime</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Built for every role in your workshop</h2>
            <p className="text-slate-500 text-lg">Each team member has a tailored experience designed for their workflow.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need, nothing you don't</h2>
              <p className="text-slate-500 mb-8">
                Designed specifically for automotive service centres. Replace messy group chats and paper trails
                with a purpose-built system your whole team will actually use.
              </p>
              <ul className="space-y-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-slate-700">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-2xl p-8 text-white">
              <Shield className="h-8 w-8 mb-4 text-slate-400" />
              <h3 className="text-xl font-semibold mb-3">Multi-business ready</h3>
              <p className="text-slate-400 leading-relaxed mb-6">
                Whether you run a single location or manage a group of dealerships, My Workshop Flow
                scales with you. Each business gets its own isolated workspace.
              </p>
              <SubscribeButton label="Set up your business" variant="outline" className="border-slate-600 text-white hover:bg-slate-800" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-slate-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-slate-400 mb-8 text-lg">
            Join workshops already using My Workshop Flow to reduce delays and improve customer communication.
          </p>
          <SubscribeButton label="Get Started Free" size="lg" className="bg-white text-slate-900 hover:bg-slate-100 text-base px-8" variant="outline" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-900 rounded-lg">
              <Wrench className="h-3.5 w-3.5 text-white" />
            </div>
            My Workshop Flow
          </div>
          <div className="flex items-center gap-6">
            <Link to="/about" className="hover:text-slate-700 transition-colors">About</Link>
            <Link to="/contact" className="hover:text-slate-700 transition-colors">Contact</Link>
            <p>© {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
