import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SubscribeButton from "@/components/SubscribeButton";
import { DEFAULT_LABOUR_RATE_INC_GST } from "@/lib/labourRate";

const STEPS = ['Business Details', 'Configuration', 'Done'];

export default function BusinessOnboarding() {
  const { user, isLoadingAuth: userLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    trading_name: '',
    contact_name: '',
    contact_email: '',
    phone: '',
    address: '',
    default_labour_rate: DEFAULT_LABOUR_RATE_INC_GST,
    sms_sign_off: '',
    job_card_prefix: '',
    job_card_format_hint: ''
  });
  const [createdId, setCreatedId] = useState(null);

  

  const handleCreate = async () => {
    if (!form.business_name) { toast.error("Business name is required"); return; }
    setSaving(true);
    try {
      const today = new Date();
      const trialEnd = new Date(today);
      trialEnd.setDate(trialEnd.getDate() + 30);
      const created = await entities.Business.create({
        ...form,
        subscription_status: 'trial',
        trial_start_date: format(today, 'yyyy-MM-dd'),
        trial_end_date: format(trialEnd, 'yyyy-MM-dd'),
        is_active: true,
        onboarding_completed: true
      });
      setCreatedId(created.id);
      // Link current user to business
      if (user?.id) {
        const { supabase } = await import('@/api/supabaseClient');
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { entities } = await import('@/api/entities');
          await entities.User.update(authUser.id, { business_id: created.id });
        }
      }
      setStep(2);
      toast.success("Business created!");
    } catch (e) {
      toast.error("Failed to create business: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex p-3 bg-slate-900 rounded-2xl mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Business Onboarding</h1>
          <p className="text-sm text-slate-500 mt-1">Set up your workshop in a few steps</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= step ? 'text-slate-900' : 'text-slate-400'}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {i < step ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`h-px w-8 ${i < step ? 'bg-green-400' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 0: Business Details */}
        {step === 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Business Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Business Name *</Label>
                <Input value={form.business_name} onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))} className="mt-1" placeholder="ABC Motors" />
              </div>
              <div>
                <Label>Trading Name</Label>
                <Input value={form.trading_name} onChange={e => setForm(p => ({ ...p, trading_name: e.target.value }))} className="mt-1" placeholder="ABC Motors Service" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact Name</Label>
                  <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <Button onClick={() => setStep(1)} disabled={!form.business_name} className="w-full gap-2">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Configuration */}
        {step === 1 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Default Labour Rate (inc GST)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-400">$</span>
                  <Input type="number" value={form.default_labour_rate} onChange={e => setForm(p => ({ ...p, default_labour_rate: parseFloat(e.target.value) || 0 }))} className="w-32" min="0" step="5" />
                  <span className="text-slate-500 text-sm">/ hour</span>
                </div>
              </div>
              <div>
                <Label>SMS Sign-off</Label>
                <Input value={form.sms_sign_off} onChange={e => setForm(p => ({ ...p, sms_sign_off: e.target.value }))} className="mt-1" placeholder="e.g. ABC Motors Service 08 9000 0000" />
                <p className="text-xs text-slate-400 mt-1">Appended to every customer SMS.</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-slate-700 mb-3">Job Card Number Format</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Prefix</Label>
                    <Input value={form.job_card_prefix} onChange={e => setForm(p => ({ ...p, job_card_prefix: e.target.value }))} className="mt-1" placeholder="e.g. JC- or WO-" />
                    <p className="text-xs text-slate-400 mt-1">Added before the number.</p>
                  </div>
                  <div>
                    <Label>Format Example</Label>
                    <Input value={form.job_card_format_hint} onChange={e => setForm(p => ({ ...p, job_card_format_hint: e.target.value }))} className="mt-1" placeholder="e.g. JC-0001" />
                    <p className="text-xs text-slate-400 mt-1">Shown as a hint to staff.</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
                <Button onClick={handleCreate} disabled={saving} className="flex-1 gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create Business
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Business Created!</h2>
              <p className="text-slate-500 mb-2">Your workshop is set up. Activate your subscription to get started — includes a 30-day free trial.</p>
              <p className="text-sm text-slate-400 mb-6">$49/month after trial · Cancel anytime</p>
              <div className="flex flex-col gap-3">
                <SubscribeButton
                  label="Activate Free Trial"
                  size="lg"
                  className="w-full"
                  businessId={createdId}
                  email={form.contact_email}
                  businessName={form.business_name}
                />
                <Button variant="ghost" onClick={() => window.location.href = '/Dashboard'} className="text-slate-400 text-sm">
                  Skip for now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}