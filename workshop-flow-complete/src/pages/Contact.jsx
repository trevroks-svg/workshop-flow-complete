import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Mail, MessageSquare, CheckCircle } from 'lucide-react';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Opens default mail client with pre-filled content
    const subject = encodeURIComponent(`Enquiry from ${form.name}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`);
    window.location.href = `mailto:support@servicepartsorder.com.au?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

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
            <Link to="/about" className="text-slate-600 hover:text-slate-900">About</Link>
            <Link to="/contact" className="text-slate-900 font-medium">Contact</Link>
            <Link to="/" className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">Sign In</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-full mb-6">
            <MessageSquare className="h-4 w-4" />
            Get in Touch
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6 leading-tight">
            Contact Us
          </h1>
          <p className="text-lg text-slate-600">
            Have a question, need support, or want to learn more about Service Parts Order System? We'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          {/* Contact form */}
          <div className="sm:col-span-1">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Send us a message</h2>
            {submitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                <p className="font-semibold text-slate-900">Message prepared!</p>
                <p className="text-sm text-slate-600 mt-1">Your email client should have opened with your message pre-filled.</p>
                <button onClick={() => setSubmitted(false)} className="mt-4 text-sm text-slate-500 underline">Send another</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Jane Smith"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="jane@workshop.com.au"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us how we can help..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  Send Message
                </button>
              </form>
            )}
          </div>

          {/* Direct contact */}
          <div className="sm:col-span-1">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Direct contact</h2>
            <div className="space-y-4">
              <a
                href="mailto:support@servicepartsorder.com.au"
                className="flex items-start gap-4 bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-400 transition-colors"
              >
                <div className="p-2.5 bg-slate-100 rounded-xl shrink-0">
                  <Mail className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Email Support</p>
                  <p className="text-sm text-slate-600 mt-0.5">support@servicepartsorder.com.au</p>
                  <p className="text-xs text-slate-400 mt-1">We aim to respond within 1 business day</p>
                </div>
              </a>
            </div>

            <div className="mt-8 bg-slate-100 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 text-sm mb-2">Existing customers</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                If you're already using Service Parts Order System and need help, please include your business name and a brief description of the issue in your message.
              </p>
            </div>
          </div>
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