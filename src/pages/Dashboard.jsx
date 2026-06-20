import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FileText, Clock, CheckCircle, AlertCircle, Loader2, RefreshCw, Package, ClipboardList, Headphones, Wrench } from "lucide-react";
import { getStartOfToday, getStartOfMonth } from "@/lib/dateUtils";
import { createPageUrl } from "@/utils";
import RequestCard from "../components/RequestCard";
import InspectionQueueCard from "../components/inspection/InspectionQueueCard";

export default function Dashboard() {
  const { user, isLoadingAuth: userLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoNavigated, setAutoNavigated] = useState(false);
  const [adminViewAs, setAdminViewAs] = useState(null); // null = default admin view
  const navigate = useNavigate();

  

  // Redirect new users without a business to onboarding
  useEffect(() => {
    if (!userLoading && user) {
      const staffRole = user?.staff_role;
      if (!user.business_id && staffRole !== 'super_admin') {
        navigate('/BusinessOnboarding');
      }
    }
  }, [user, userLoading, navigate]);

  const { data: allRequests = [], isLoading: requestsLoading, refetch } = useQuery({
    queryKey: ['partsRequests'],
    queryFn: () => entities.PartsRequest.list('-created_at', 100),
    refetchInterval: 10000,
    enabled: !!user
  });

  const staffRole = user?.staff_role || 'technician';
  const isSuperOrAdmin = staffRole === 'admin' || staffRole === 'super_admin';
  // Admin/SuperAdmin can impersonate other roles for viewing
  const effectiveRole = (isSuperOrAdmin && adminViewAs) ? adminViewAs : staffRole;

  const showInspectionQueue = ['service_advisor', 'service_manager', 'admin', 'super_admin'].includes(staffRole) || ['service_advisor', 'service_manager'].includes(adminViewAs);

  const { data: submittedInspections = [] } = useQuery({
    queryKey: ['submittedInspections'],
    queryFn: () => entities.VehicleInspection.filter({ status: 'submitted' }),
    refetchInterval: 10000,
    enabled: !!user && showInspectionQueue
  });

  // Filter out expired, archived, and WC-completed requests (unless viewing as admin/manager)
  const requests = allRequests.filter(r => {
    if (r.is_archived) return false;
    const created = new Date(r.created_at);
    const expiresAt = new Date(created.getTime() + 5 * 24 * 60 * 60 * 1000);
    const isExpired = new Date() > expiresAt;
    if (isExpired) return false;
    
    // For workshop controller, exclude completed items from their active queue
    if (effectiveRole === 'workshop_controller' && r.wc_completed) return false;
    
    return true;
  });

  // Get action required count based on role
  const getActionsRequired = () => {
    if (!user) return 0;
    
    switch (effectiveRole) {
      case 'parts_interpreter':
        return requests.filter(r => r.status === 'sent_to_parts').length;
      case 'workshop_controller':
        return requests.filter(r => ['quoted', 'awaiting_workshop_approval', 'customer_approved', 'customer_denied'].includes(r.status)).length;
      case 'service_advisor':
        return requests.filter(r => ['sent_to_advisor', 'advisor_action_required', 'sent_to_customer'].includes(r.status)).length;
      default:
        return 0;
    }
  };

  const actionsRequiredCount = getActionsRequired();

  // Update document title based on actions required
  useEffect(() => {
    if (actionsRequiredCount > 0) {
      document.title = `🔴 ACTION REQUIRED (${actionsRequiredCount}) – My Workshop Flow`;
    } else {
      document.title = 'My Workshop Flow';
    }
    
    return () => {
      document.title = 'My Workshop Flow';
    };
  }, [actionsRequiredCount]);

  // Auto-navigate to actions required on first load
  useEffect(() => {
    if (!autoNavigated && user && requests.length > 0 && actionsRequiredCount > 0) {
      // Set appropriate filter based on role
      if (effectiveRole === 'parts_interpreter') {
        setStatusFilter('sent_to_parts');
      } else if (effectiveRole === 'workshop_controller') {
        setStatusFilter('quoted');
      }
      setAutoNavigated(true);
    }
  }, [user, requests, actionsRequiredCount, effectiveRole, autoNavigated]);

  // Filter requests based on role
  const getFilteredByRole = () => {
    switch (effectiveRole) {
      case 'technician':
        return requests.filter(r => r.created_by === user?.email);
      case 'parts_interpreter':
        if (statusFilter === 'quote_history') {
          return allRequests.filter(r => !r.is_archived && r.quote_pdf_url);
        }
        return requests.filter(r => ['sent_to_parts', 'quoted'].includes(r.status));
      case 'workshop_controller':
        if (statusFilter === 'history') {
          return allRequests.filter(r => !r.is_archived);
        }
        return requests.filter(r => r.status !== 'advisor_action_required');
      case 'service_advisor':
        return requests.filter(r => ['sent_to_parts', 'quoted', 'awaiting_workshop_approval', 'sent_to_advisor', 'advisor_action_required', 'recommendation_added', 'sent_to_customer', 'customer_approved', 'customer_denied'].includes(r.status));
      case 'service_manager':
        return requests;
      case 'admin':
      case 'super_admin':
        return requests;
      default:
        return [];
    }
  };

  const roleFilteredRequests = getFilteredByRole();

  // Apply status and search filters
  const filteredRequests = roleFilteredRequests.filter(request => {
    // Quote history tab: all records already filtered by getFilteredByRole
    let matchesStatus = statusFilter === "all" || statusFilter === "quote_history" || statusFilter === "history" || request.status === statusFilter;
    
    // Workshop controller special filters
    if (effectiveRole === 'workshop_controller') {
      if (statusFilter === 'customer_approved') {
        matchesStatus = ['customer_approved', 'customer_denied'].includes(request.status) && !request.wc_completed;
      } else if (statusFilter === 'history') {
        matchesStatus = true;
      }
    }
    
    // Service Advisor special filters
    if (effectiveRole === 'service_advisor') {
      if (statusFilter === 'sent_to_parts') {
        matchesStatus = ['sent_to_parts', 'quoted'].includes(request.status);
      } else if (statusFilter === 'awaiting_workshop_approval') {
        matchesStatus = ['awaiting_workshop_approval'].includes(request.status);
      }
    }

    // Service Manager/Admin (default view) special filters
    if ((staffRole === 'service_manager') || (staffRole === 'admin' && !adminViewAs)) {
      if (statusFilter === 'wc_completed') {
        matchesStatus = request.wc_completed === true;
      } else if (statusFilter === 'all') {
        matchesStatus = true;
      }
    }
    
    const matchesSearch = !searchQuery || 
      request.job_card_number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Stats - customized per role
  const getStats = () => {
    if (effectiveRole === 'workshop_controller') {
      const todayStart = getStartOfToday();
      const activeNonArchived = allRequests.filter(r => !r.is_archived);

      // Requests received today (created today, past draft)
      const receivedToday = activeNonArchived.filter(r =>
        r.status !== 'draft' && new Date(r.created_at) >= todayStart
      ).length;

      // WC action statuses: immediate upsell approval, recommendation path, or returned/declined.
      const wcApprovalStatuses = ['sent_to_advisor', 'advisor_action_required'];
      const wcActionStatuses = [...wcApprovalStatuses, 'returned_to_workshop_controller'];

      // Actioned today = WC pushed to any action status today
      const actionedToday = activeNonArchived.filter(r =>
        (r.audit_log || []).some(e =>
          wcActionStatuses.includes(e.new_status) &&
          new Date(e.changed_at) >= todayStart
        )
      ).length;

      // WC approved today = immediate upsell approval OR recommendation path.
      const approvedToday = activeNonArchived.filter(r =>
        (r.audit_log || []).some(e =>
          wcApprovalStatuses.includes(e.new_status) &&
          new Date(e.changed_at) >= todayStart
        )
      ).length;

      // WC declined/returned today
      const declinedToday = activeNonArchived.filter(r =>
        (r.audit_log || []).some(e => e.new_status === 'returned_to_workshop_controller' && new Date(e.changed_at) >= todayStart)
      ).length;

      // Avg time from quote uploaded to any WC action taken today.
      const times = activeNonArchived.flatMap(r => {
        const auditLog = r.audit_log || [];
        const quotedEntries = auditLog
          .filter(e => e.new_status === 'quoted')
          .map(e => new Date(e.changed_at))
          .filter(d => !Number.isNaN(d.getTime()));

        return auditLog
          .filter(e => wcActionStatuses.includes(e.new_status) && new Date(e.changed_at) >= todayStart)
          .map(e => {
            const actionTime = new Date(e.changed_at);
            if (Number.isNaN(actionTime.getTime())) return null;

            const quotedTime = quotedEntries
              .filter(d => d <= actionTime)
              .sort((a, b) => b - a)[0];

            if (!quotedTime) return null;
            return actionTime - quotedTime;
          });
      }).filter(t => t !== null && t > 0);

      let avgTimeText = '—';
      if (times.length > 0) {
        const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
        const avgMins = Math.round(avgMs / 60000);
        if (avgMs < 60000) avgTimeText = '<1m';
        else if (avgMins < 60) avgTimeText = `${avgMins}m`;
        else if (avgMins < 1440) avgTimeText = `${Math.round(avgMins / 60)}h`;
        else avgTimeText = `${Math.round(avgMins / 1440)}d`;
      }

      return { receivedToday, actionedToday, approvedToday, declinedToday, avgTimeText };
    }
    if (effectiveRole === 'service_advisor') {
      const todayStart = getStartOfToday();
      // Active advisor requests = not archived, not expired, in advisor-relevant statuses
      const advisorActive = requests.filter(r =>
        ['sent_to_parts', 'quoted', 'awaiting_workshop_approval', 'sent_to_advisor', 'advisor_action_required', 'recommendation_added', 'sent_to_customer', 'customer_approved', 'customer_denied'].includes(r.status)
      );
      // Decisions recorded today (by decision date, not created date)
      const decidedToday = allRequests.filter(r =>
        !r.is_archived && r.customer_decision_recorded_at && new Date(r.customer_decision_recorded_at) >= todayStart
      );
      return {
        total: advisorActive.length,
        pending: requests.filter(r => ['sent_to_advisor', 'advisor_action_required', 'sent_to_customer'].includes(r.status)).length,
        approved: decidedToday.filter(r => r.customer_decision === 'approved').length,
        denied: decidedToday.filter(r => r.customer_decision === 'denied').length
      };
    }
    if (((staffRole === 'admin' || staffRole === 'super_admin') && !adminViewAs) || staffRole === 'service_manager') {
      const startOfMonth = getStartOfMonth();
      const thisMonth = allRequests.filter(r => new Date(r.created_at) >= startOfMonth);
      const pendingStatuses = ['draft', 'sent_to_parts', 'quoted', 'awaiting_workshop_approval', 'approved', 'sent_to_advisor', 'advisor_action_required', 'sent_to_customer', 'recommendation_added'];
      return {
        total: thisMonth.length,
        pending: thisMonth.filter(r => pendingStatuses.includes(r.status)).length,
        approved: thisMonth.filter(r => r.status === 'customer_approved').length,
        denied: thisMonth.filter(r => r.status === 'customer_denied').length
      };
    }
    if (effectiveRole === 'parts_interpreter') {
      const startOfMonth = getStartOfMonth();
      const thisMonth = allRequests.filter(r => !r.is_archived && new Date(r.created_at) >= startOfMonth);

      const totalRequested = thisMonth.filter(r => r.status !== 'draft').length;
      const actioned = thisMonth.filter(r => r.quote_pdf_url);
      const totalActioned = actioned.length;

      const times = actioned
        .map(r => {
          const sentToPartsEntry = (r.audit_log || []).find(e => e.new_status === 'sent_to_parts');
          const quotedEntry = (r.audit_log || []).find(e => e.new_status === 'quoted');
          if (!quotedEntry) return null;
          const startTime = sentToPartsEntry ? new Date(sentToPartsEntry.changed_at) : new Date(r.created_at);
          return new Date(quotedEntry.changed_at) - startTime;
        })
        .filter(t => t !== null && t > 0);

      let avgTimeText = '—';
      if (times.length > 0) {
        const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
        const avgMins = Math.round(avgMs / 60000);
        if (avgMs < 60000) avgTimeText = '<1m';
        else if (avgMins < 60) avgTimeText = `${avgMins}m`;
        else if (avgMins < 1440) avgTimeText = `${Math.round(avgMins / 60)}h`;
        else avgTimeText = `${Math.round(avgMins / 1440)}d`;
      }

      return { totalRequested, totalActioned, avgTimeText };
    }
    // Technician default
    return {
      total: roleFilteredRequests.length,
      approved: roleFilteredRequests.filter(r => ['approved', 'customer_approved'].includes(r.status)).length
    };
  };
  const stats = getStats();

  const getRoleLabel = (role) => {
    const labels = {
      technician: 'Technician',
      parts_interpreter: 'Parts Interpreter',
      workshop_controller: 'Workshop Controller',
      service_advisor: 'Service Advisor',
      service_manager: 'Service Manager',
      admin: 'Administrator'
    };
    return labels[role] || role;
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Parts Requests</h1>
            <p className="text-slate-500 mt-1">
              Logged in as <span className="font-medium text-slate-700">{getRoleLabel(staffRole)}</span>
              {adminViewAs && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Viewing as {getRoleLabel(adminViewAs)}</span>}
            </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
            {isSuperOrAdmin && (
              <>
                <Button
                  onClick={() => { setAdminViewAs(null); setStatusFilter('all'); }}
                  variant={!adminViewAs ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  Overview
                </Button>
                <Button
                  onClick={() => { setAdminViewAs('technician'); setStatusFilter('all'); }}
                  variant={adminViewAs === 'technician' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Technician
                </Button>
                <Button
                  onClick={() => { setAdminViewAs('parts_interpreter'); setStatusFilter('all'); }}
                  variant={adminViewAs === 'parts_interpreter' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <Package className="h-3.5 w-3.5" />
                  Parts
                </Button>
                <Button
                  onClick={() => { setAdminViewAs('workshop_controller'); setStatusFilter('all'); }}
                  variant={adminViewAs === 'workshop_controller' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Workshop
                </Button>
                <Button
                  onClick={() => { setAdminViewAs('service_advisor'); setStatusFilter('all'); }}
                  variant={adminViewAs === 'service_advisor' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <Headphones className="h-3.5 w-3.5" />
                  Advisor
                </Button>
                <Button
                  onClick={() => { setAdminViewAs('service_manager'); setStatusFilter('all'); }}
                  variant={adminViewAs === 'service_manager' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <Headphones className="h-3.5 w-3.5" />
                  Manager
                </Button>
              </>
            )}
            <Button onClick={() => refetch()} variant="outline" size="icon" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {staffRole === 'technician' && (
              <>
                <Link to={createPageUrl("VehicleInspection")}>
                  <Button variant="outline" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    New Inspection
                  </Button>
                </Link>
                <Link to="/PartsRequestForm">
                  <Button className="bg-slate-900 hover:bg-slate-800 gap-2">
                    <Plus className="h-4 w-4" />
                    New Request
                  </Button>
                </Link>
              </>
            )}
            </div>
        </div>

        {/* Stats Cards */}
        <div className={`grid gap-4 mb-8 ${effectiveRole === 'workshop_controller' ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {(((staffRole === 'admin' || staffRole === 'super_admin') && !adminViewAs) || staffRole === 'service_manager') ? (
            <>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 rounded-xl">
                      <FileText className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                      <p className="text-xs text-slate-500">Total This Month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 rounded-xl">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                      <p className="text-xs text-slate-500">Pending / Unactioned</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stats.approved}</p>
                      <p className="text-xs text-slate-500">Approved</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-100 rounded-xl">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stats.denied}</p>
                      <p className="text-xs text-slate-500">Declined</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 rounded-xl">
                      <FileText className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {effectiveRole === 'workshop_controller' ? stats.receivedToday : effectiveRole === 'parts_interpreter' ? stats.totalRequested : stats.total}
                      </p>
                      <p className="text-xs text-slate-500">
                        {effectiveRole === 'workshop_controller' ? 'Received Today' : effectiveRole === 'service_advisor' ? 'Active Requests' : effectiveRole === 'parts_interpreter' ? 'Total Quotes Requested' : 'Total Requests'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 rounded-xl">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {effectiveRole === 'workshop_controller' ? stats.actionedToday : effectiveRole === 'parts_interpreter' ? (stats.totalRequested - stats.totalActioned) : stats.pending}
                      </p>
                      <p className="text-xs text-slate-500">
                        {effectiveRole === 'workshop_controller' ? 'Actioned Today' : effectiveRole === 'service_advisor' ? 'Needs Your Attention' : effectiveRole === 'parts_interpreter' ? 'Awaiting Quote (This Month)' : 'Pending'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {effectiveRole === 'workshop_controller' ? (
                <>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-xl">
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{stats.approvedToday}</p>
                          <p className="text-xs text-slate-500">Approved Today</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-100 rounded-xl">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{stats.declinedToday}</p>
                          <p className="text-xs text-slate-500">Declined Today</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 rounded-xl">
                          <Clock className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{stats.avgTimeText}</p>
                          <p className="text-xs text-slate-500">Avg Time to Action</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : effectiveRole === 'service_advisor' ? (
                <>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-xl">
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{stats.approved}</p>
                          <p className="text-xs text-slate-500">Approved Today</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-100 rounded-xl">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{stats.denied}</p>
                          <p className="text-xs text-slate-500">Denied Today</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : effectiveRole === 'parts_interpreter' ? (
                <>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-xl">
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{stats.totalActioned}</p>
                          <p className="text-xs text-slate-500">Quotes Actioned</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 rounded-xl">
                          <Clock className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{stats.avgTimeText}</p>
                          <p className="text-xs text-slate-500">Avg Time to Action</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-xl">
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{stats.approved}</p>
                          <p className="text-xs text-slate-500">Approved</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm opacity-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-100 rounded-xl">
                          <FileText className="h-5 w-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-400">—</p>
                          <p className="text-xs text-slate-400">—</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by job card number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="bg-white border">
              <TabsTrigger value="all">All</TabsTrigger>
              {effectiveRole === 'workshop_controller' ? (
                <>
                  <TabsTrigger value="quoted">Needs Review</TabsTrigger>
                  <TabsTrigger value="customer_approved">Decisions</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </>
              ) : (effectiveRole === 'service_manager' || ((staffRole === 'admin' || staffRole === 'super_admin') && !adminViewAs)) ? (
                <>
                  <TabsTrigger value="quoted">Active</TabsTrigger>
                  <TabsTrigger value="wc_completed">WC Completed</TabsTrigger>
                </>
              ) : effectiveRole === 'service_advisor' ? (
                <>
                  <TabsTrigger value="sent_to_parts">Waiting on Quote</TabsTrigger>
                  <TabsTrigger value="awaiting_workshop_approval">Awaiting WC</TabsTrigger>
                  <TabsTrigger value="sent_to_advisor">Awaiting Decision</TabsTrigger>
                  <TabsTrigger value="customer_approved">Approved</TabsTrigger>
                  <TabsTrigger value="customer_denied">Denied</TabsTrigger>
                </>
              ) : effectiveRole === 'parts_interpreter' ? (
                <>
                  <TabsTrigger value="sent_to_parts">Sent to Parts</TabsTrigger>
                  <TabsTrigger value="quote_history">Quote History</TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="sent_to_parts">Sent to Parts</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                </>
              )}
            </TabsList>
          </Tabs>
        </div>

        {/* Two-column layout for advisor/manager/admin, single column for others */}
        {showInspectionQueue ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column: Parts Requests */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Upsells/Recommendations ({filteredRequests.length})
              </h2>
              {requestsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                </div>
              ) : filteredRequests.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto mb-3">
                      <FileText className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-slate-500 text-sm">
                      {statusFilter !== "all" ? "Try adjusting your filters" : "No requests require your attention at this time"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map(request => (
                    <RequestCard key={request.id} request={request} showPdfLink={statusFilter === 'quote_history'} />
                  ))}
                </div>
              )}
            </div>

            {/* Right column: Vehicle Inspections */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Vehicle Inspections ({submittedInspections.length})
              </h2>
              {submittedInspections.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto mb-3">
                      <ClipboardList className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-slate-500 text-sm">No inspections awaiting review</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {submittedInspections.map(inspection => (
                    <InspectionQueueCard key={inspection.id} inspection={inspection} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Single column for technician / parts interpreter / workshop controller */
          <>
            {requestsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                    <FileText className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No requests found</h3>
                  <p className="text-slate-500 mb-4">
                    {statusFilter !== "all"
                      ? "Try adjusting your filters"
                      : staffRole === 'technician'
                        ? "Create your first parts request to get started"
                        : "No requests require your attention at this time"}
                  </p>
                  {staffRole === 'technician' && (
                    <Link to="/PartsRequestForm">
                      <Button>Create Request</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map(request => (
                  <RequestCard key={request.id} request={request} showPdfLink={statusFilter === 'quote_history'} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
