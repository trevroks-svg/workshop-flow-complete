import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Loader2, Shield, Save, Users, Wrench } from "lucide-react";
import { useBusinessContext } from "@/lib/useBusinessContext";
import { format } from "date-fns";

const STATUS_COLORS = {
  trial: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700"
};

export default function BusinessSettings() {
  const queryClient = useQueryClient();
  const { user, businessId, business, businessLoading, isSuperAdmin, canManageBusiness } = useBusinessContext();

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business && !form) {
      setForm({
        business_name: business.business_name || '',
        trading_name: business.trading_name || '',
        contact_name: business.contact_name || '',
        contact_email: business.contact_email || '',
        phone: business.phone || '',
        address: business.address || '',
        sms_sign_off: business.sms_sign_off || '',
        default_labour_rate: business.default_labour_rate || 110,
        job_card_prefix: business.job_card_prefix || '',
        job_card_format_hint: business.job_card_format_hint || ''
      });
    }
  }, [business]);

  const { data: bizUsers = [] } = useQuery({
    queryKey: ['biz_users', businessId],
    queryFn: () => entities.User.filter({ business_id: businessId }),
    enabled: !!businessId
  });

  const updateMutation = useMutation({
    mutationFn: (data) => entities.Business.update(businessId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['business', businessId]);
      toast.success("Settings saved");
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message || 'Unknown error'}`);
    }
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateMutation.mutateAsync(form);
    } finally {
      setSaving(false);
    }
  };

  if (!canManageBusiness) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
            <p className="text-slate-500">Only Business Admins and Service Managers can access business settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (businessLoading || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!businessId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">No Business Linked</h2>
            <p className="text-slate-500 mb-4">Your account isn't linked to a business yet. Complete onboarding to get started.</p>
            <Button onClick={() => window.location.href = '/BusinessOnboarding'}>Start Onboarding</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Building2 className="h-7 w-7 text-slate-600" />
              Business Settings
            </h1>
            <p className="text-sm text-slate-500 mt-1">Manage your business profile and configuration.</p>
          </div>
          {business?.subscription_status && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_COLORS[business.subscription_status]}`}>
              {business.subscription_status}
            </span>
          )}
        </div>

        {/* Subscription Info */}
        {business?.trial_end_date && business?.subscription_status === 'trial' && (
          <Card className="border border-yellow-200 bg-yellow-50 shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                Trial ends <strong>{format(new Date(business.trial_end_date), 'dd MMMM yyyy')}</strong>. Contact support to upgrade.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Business Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" /> Business Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Business Name', key: 'business_name', required: true },
                { label: 'Trading Name', key: 'trading_name' },
                { label: 'Contact Name', key: 'contact_name' },
                { label: 'Contact Email', key: 'contact_email', type: 'email' },
                { label: 'Phone', key: 'phone' },
                { label: 'Address', key: 'address' }
              ].map(f => (
                <div key={f.key}>
                  <Label>{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</Label>
                  <Input
                    type={f.type || 'text'}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
            <div>
              <Label>SMS Sign-off</Label>
              <Input
                value={form.sms_sign_off}
                onChange={e => setForm(p => ({ ...p, sms_sign_off: e.target.value }))}
                className="mt-1"
                placeholder="e.g. ABC Motors Service 08 9000 0000"
              />
              <p className="text-xs text-slate-400 mt-1">Appended to every customer SMS draft.</p>
            </div>
          </CardContent>
        </Card>

        {/* Job Card Number */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-slate-400" /> Job Card Number Format
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Prefix</Label>
                <Input
                  value={form.job_card_prefix}
                  onChange={e => setForm(p => ({ ...p, job_card_prefix: e.target.value }))}
                  className="mt-1"
                  placeholder="e.g. JC- or WO-"
                />
                <p className="text-xs text-slate-400 mt-1">Added before the number.</p>
              </div>
              <div>
                <Label>Format Example</Label>
                <Input
                  value={form.job_card_format_hint}
                  onChange={e => setForm(p => ({ ...p, job_card_format_hint: e.target.value }))}
                  className="mt-1"
                  placeholder="e.g. JC-0001"
                />
                <p className="text-xs text-slate-400 mt-1">Shown as a hint to staff when entering job card numbers.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Labour Rate */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-slate-400" /> Default Labour Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">$</span>
              <Input
                type="number"
                value={form.default_labour_rate}
                onChange={e => setForm(p => ({ ...p, default_labour_rate: parseFloat(e.target.value) || 0 }))}
                className="w-32"
                min="0"
                step="5"
              />
              <span className="text-slate-500 text-sm">/ hour ex GST</span>
            </div>
          </CardContent>
        </Card>

        {/* Users summary */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" /> Team ({bizUsers.length} users)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bizUsers.length === 0 ? (
              <p className="text-sm text-slate-400">No users linked to this business yet.</p>
            ) : (
              <div className="space-y-2">
                {bizUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{u.staff_role || 'technician'}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={() => window.location.href = '/AdminUsers'}
            >
              <Users className="h-3.5 w-3.5" /> Manage Users
            </Button>
          </CardContent>
        </Card>

        {/* Save */}
        <Button onClick={handleSave} disabled={saving || !form.business_name} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
