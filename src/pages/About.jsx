import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Users, Zap, Shield } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-900 rounded-lg">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">Service Parts Order</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/about" className="text-slate-900 font-medium">About</Link>
            <Link to="/contact" className="text-slate-600 hover:text-slate-900">Contact</Link>
            <Link to="/" className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">Sign In</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-full mb-6">
            <Wrench className="h-4 w-4" />
            About Us
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6 leading-tight">
            Built for Automotive Service Teams
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Service Parts Order System is a purpose-built workflow platform that streamlines how automotive dealerships and independent workshops manage parts requests, quotes, and customer approvals.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <div className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed text-base">
          <p>
            Managing parts quotes in a busy workshop has traditionally meant phone calls, scribbled notes, and missed follow-ups. Service Parts Order System replaces that friction with a structured digital workflow that connects every person in the process — from the technician who spots the need, to the parts interpreter who sources the quote, to the workshop controller who approves it, and the service advisor who communicates with the customer.
          </p>
          <p>
            The platform is designed specifically for automotive service departments: franchised dealerships, multi-brand service centres, and independent workshops that handle a high volume of daily jobs. Every role in the team has a tailored view, so each person sees exactly what they need to act on — nothing more, nothing less.
          </p>
          <p>
            Key capabilities include real-time status tracking across all parts requests, AI-assisted SMS drafts that help advisors communicate professionally and quickly with customers, digital vehicle inspection reports with photo uploads and multi-point checklists, labour time and parts ETA management, and a full audit trail on every job card.
          </p>
          <p>
            Service Parts Order System is developed and maintained by a team passionate about reducing the administrative overhead in automotive service operations. Our goal is simple: give workshop teams the tools they need to move faster, make fewer mistakes, and deliver a better customer experience — without adding complexity to already busy workflows.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
          {[
            { icon: Users, title: "Every Role, One Platform", desc: "Technicians, parts interpreters, workshop controllers, and service advisors all work from the same source of truth." },
            { icon: Zap, title: "AI-Powered SMS Drafts", desc: "Generate professional customer-ready SMS messages in seconds using context from the job and quote." },
            { icon: Shield, title: "Full Audit Trail", desc: "Every status change is logged with timestamps and user details, giving management complete visibility." },
            { icon: Wrench, title: "Built for Workshops", desc: "Designed around real workshop workflows — not generic project management tools repurposed for automotive." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="p-2.5 bg-slate-100 rounded-xl w-fit mb-4">
                <Icon className="h-5 w-5 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Service Parts Order System</span>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-slate-900 transition-colors">About</Link>
            <Link to="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
            <Link to="/landing" className="hover:text-slate-900 transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}