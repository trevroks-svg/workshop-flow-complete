import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, UserPlus, Loader2, Shield, Wrench, Package, ClipboardList, Headphones, RefreshCw, Trash2, KeyRound } from "lucide-react";
import { createPageUrl } from "@/utils";

const STAFF_ROLES = [
  { value: "technician", label: "Technician", icon: Wrench, color: "bg-blue-100 text-blue-700" },
  { value: "parts_interpreter", label: "Parts Interpreter", icon: Package, color: "bg-purple-100 text-purple-700" },
  { value: "workshop_controller", label: "Workshop Controller", icon: ClipboardList, color: "bg-amber-100 text-amber-700" },
  { value: "service_advisor", label: "Service Advisor", icon: Headphones, color: "bg-cyan-100 text-cyan-700" },
  { value: "service_manager", label: "Service Manager", icon: Headphones, color: "bg-teal-100 text-teal-700" },
  { value: "admin", label: "Administrator", icon: Shield, color: "bg-red-100 text-red-700" }
];

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("technician");
  const [isInviting, setIsInviting] = useState(false);

  

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => entities.User.list(),
    refetchInterval: 5000
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, newRole }) => entities.User.update(userId, { staff_role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allUsers']);
      toast.success("Role updated successfully");
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => entities.User.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['allUsers']);
      toast.success("User removed successfully");
    },
    onError: () => {
      toast.error("Failed to remove user");
    }
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      setIsInviting(true);
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, business_id: currentUser?.business_id })
      });
      if (!res.ok) throw new Error('Invite failed');
      toast.success(`Invitation sent to ${inviteEmail}. New users will appear here after they complete signup.`);
      setShowInviteDialog(false);
      setInviteEmail("");
      setTimeout(() => refetch(), 2000);
    } catch (error) {
      toast.error("Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const getRoleConfig = (role) => {
    return STAFF_ROLES.find(r => r.value === role) || STAFF_ROLES[0];
  };

  if (currentUser?.staff_role !== 'admin' && currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">You don't have permission to access this page</p>
          <Button onClick={() => navigate(createPageUrl("Dashboard"))}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
            <p className="text-slate-500">Manage staff roles and permissions</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="icon" title="Refresh users list">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowInviteDialog(true)} className="bg-slate-900 hover:bg-slate-800 gap-2">
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
          </div>
        </div>

        {/* Role Legend */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STAFF_ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <div key={role.value} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className={`p-2 rounded-lg ${role.color.replace('text-', 'bg-').replace('-700', '-100')}`}>
                      <Icon className={`h-4 w-4 ${role.color.split(' ')[1]}`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{role.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {role.value === 'technician' && "Create requests, view quotes"}
                        {role.value === 'parts_interpreter' && "Price parts, upload quotes"}
                        {role.value === 'workshop_controller' && "Review & approve repairs"}
                        {role.value === 'service_advisor' && "Send to customer, SMS, record approval"}
                        {role.value === 'service_manager' && "View all, SMS, oversee service"}
                        {role.value === 'admin' && "Full access, manage users"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">All Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Staff Role</TableHead>
                    <TableHead className="w-[200px]">Change Role</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const roleConfig = getRoleConfig(user.staff_role);
                    const Icon = roleConfig.icon;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{user.full_name}</p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${roleConfig.color} gap-1`}>
                            <Icon className="h-3 w-3" />
                            {roleConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.staff_role || "technician"}
                            onValueChange={(value) => updateRoleMutation.mutate({ userId: user.id, newRole: value })}
                            disabled={user.id === currentUser?.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAFF_ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Send password reset email"
                              onClick={async () => {
                                const { supabase } = await import('@/api/supabaseClient');
                                await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin + '/reset-password' });
                                toast.success(`Password reset email sent to ${user.email}`);
                              }}
                            >
                              <KeyRound className="h-4 w-4 text-slate-500" />
                            </Button>
                            {user.id !== currentUser?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove <span className="font-medium">{user.full_name}</span> ({user.email})? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUserMutation.mutate(user.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Invite Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="mt-1.5"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900 font-medium mb-1">How it works:</p>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>User receives invitation email</li>
                  <li>They click the link and complete signup</li>
                  <li>New user appears here (may take a moment)</li>
                  <li>You assign their staff role</li>
                </ol>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={isInviting} className="bg-slate-900 hover:bg-slate-800">
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}