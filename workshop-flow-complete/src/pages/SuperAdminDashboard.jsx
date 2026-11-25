import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Building2, Users, Loader2, Plus, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS = {
  trial: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700"
};

export default function SuperAdminDashboard() {
  const { user, isLoadingAuth: userLoading } = useAuth();
  const queryClient = useQueryClient();

  

  const { data: businesses = [], isLoading: bizLoading } = useQuery({
    queryKey: ['all_businesses'],
    queryFn: () => entities.Business.list('-created_at', 100)
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all_users'],
    queryFn: () => entities.User.list()
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newBiz, setNewBiz] = useState({ business_name: '', contact_email: '', contact_name: '' });
  const [creating, setCreating] = useState(false);

  const staffRole = user?.staff_role;

  if (staffRole !== 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
            <p className="text-slate-500">Super Admin access required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateBusiness = async () => {
    if (!newBiz.business_name) return;
    setCreating(true);
    try {
      const today = new Date();
      const trialEnd = new Date(today);
      trialEnd.setDate(trialEnd.getDate() + 30);
      await entities.Business.create({
        ...newBiz,
        subscription_status: 'trial',
        trial_start_date: format(today, 'yyyy-MM-dd'),
        trial_end_date: format(trialEnd, 'yyyy-MM-dd'),
        is_active: true,
        onboarding_completed: false
      });
      queryClient.invalidateQueries(['all_businesses']);
      toast.success("Business created");
      setNewBiz({ business_name: '', contact_email: '', contact_name: '' });
      setShowCreate(false);
    } catch (e) {
      toast.error("Failed to create business");
    }
    setCreating(false);
  };

  const handleToggleActive = async (biz) => {
    await entities.Business.update(biz.id, {
      is_active: !biz.is_active,
      deactivated_at: !biz.is_active ? null : new Date().toISOString(),
      deactivated_by: !biz.is_active ? null : user.email
    });
    queryClient.invalidateQueries(['all_businesses']);
    toast.success(biz.is_active ? "Business deactivated" : "Business activated");
  };

  const bizStatusCounts = businesses.reduce((acc, b) => {
    acc[b.subscription_status] = (acc[b.subscription_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Shield className="h-7 w-7 text-purple-600" />
              Super Admin Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">System-wide overview of all businesses.</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 bg-purple-700 hover:bg-purple-800">
            <Plus className="h-4 w-4" /> New Business
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Businesses', value: businesses.length, icon: Building2, color: 'text-slate-700' },
            { label: 'Trial', value: bizStatusCounts.trial || 0, icon: AlertTriangle, color: 'text-yellow-600' },
            { label: 'Active', value: bizStatusCounts.active || 0, icon: CheckCircle, color: 'text-green-600' },
            { label: 'Total Users', value: allUsers.length, icon: Users, color: 'text-blue-600' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="pt-5 pb-4">
                <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Business Form */}
        {showCreate && (
          <Card className="border border-purple-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Create New Business</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Business Name *</Label>
                  <Input value={newBiz.business_name} onChange={e => setNewBiz(p => ({ ...p, business_name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Contact Name</Label>
                  <Input value={newBiz.contact_name} onChange={e => setNewBiz(p => ({ ...p, contact_name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input type="email" value={newBiz.contact_email} onChange={e => setNewBiz(p => ({ ...p, contact_email: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateBusiness} disabled={creating || !newBiz.business_name} className="gap-2 bg-purple-700 hover:bg-purple-800">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Business
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Business List */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" /> All Businesses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bizLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : businesses.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No businesses yet.</p>
            ) : (
              <div className="space-y-3">
                {businesses.map(biz => {
                  const userCount = allUsers.filter(u => u.business_id === biz.id).length;
                  return (
                    <div key={biz.id} className={`flex items-center justify-between p-3 rounded-lg border ${biz.is_active === false ? 'bg-red-50 border-red-100 opacity-60' : 'bg-white border-slate-100'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-800 text-sm">{biz.business_name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[biz.subscription_status] || 'bg-slate-100 text-slate-600'}`}>
                            {biz.subscription_status}
                          </span>
                          {!biz.is_active && <Badge variant="destructive" className="text-xs">Deactivated</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-slate-400">{biz.contact_email || 'No email'}</p>
                          <span className="text-xs text-slate-300">·</span>
                          <p className="text-xs text-slate-400">{userCount} user{userCount !== 1 ? 's' : ''}</p>
                          {biz.trial_end_date && <><span className="text-xs text-slate-300">·</span><p className="text-xs text-slate-400">Trial ends {format(new Date(biz.trial_end_date), 'dd MMM yyyy')}</p></>}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(biz)}
                        className={biz.is_active === false ? 'text-green-700 border-green-300' : 'text-red-600 border-red-200'}
                      >
                        {biz.is_active === false ? <CheckCircle className="h-3.5 w-3.5 mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
                        {biz.is_active === false ? 'Activate' : 'Deactivate'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}