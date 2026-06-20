import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Send, CheckCircle, XCircle, TrendingUp, Calendar, Clock, Package, ClipboardList, Headphones } from "lucide-react";

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

export default function AdminStats() {
  const { user, isLoadingAuth: userLoading } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentDay = String(new Date().getDate()).padStart(2, '0');

  const [filterType, setFilterType] = useState('month'); // 'day', 'month', 'year', 'all'
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDay, setSelectedDay] = useState(currentDay);

  

  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ['allPartsRequests'],
    queryFn: () => entities.PartsRequest.list('-created_at', 1000),
    enabled: !!user
  });

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  // Filter requests based on date selection
  const filteredRequests = allRequests.filter(r => {
    const createdDate = new Date(r.created_at);
    const year = createdDate.getFullYear();
    const month = String(createdDate.getMonth() + 1).padStart(2, '0');
    const day = String(createdDate.getDate()).padStart(2, '0');

    if (filterType === 'all') return true;
    if (filterType === 'year') return String(year) === selectedYear;
    if (filterType === 'month') return String(year) === selectedYear && month === selectedMonth;
    if (filterType === 'day') return String(year) === selectedYear && month === selectedMonth && day === selectedDay;
    
    return true;
  });

  const stats = {
    total: filteredRequests.length,
    sentToCustomer: filteredRequests.filter(r => ['sent_to_customer', 'customer_approved', 'customer_denied'].includes(r.status)).length,
    approved: filteredRequests.filter(r => r.status === 'customer_approved').length,
    rejected: filteredRequests.filter(r => r.status === 'customer_denied').length
  };

  // Compute average response times from audit_log
  // Returns average minutes for a given transition (from_status -> to_status)
  function getAvgMinutes(requests, fromStatus, toStatuses) {
    const durations = [];
    for (const r of requests) {
      const log = r.audit_log;
      if (!Array.isArray(log)) continue;
      const fromEntry = log.find(e => e.new_status === fromStatus);
      const toEntry = log.find(e => toStatuses.includes(e.new_status) && (!fromEntry || new Date(e.changed_at) > new Date(fromEntry.changed_at)));
      if (fromEntry && toEntry) {
        const mins = (new Date(toEntry.changed_at) - new Date(fromEntry.changed_at)) / 60000;
        if (mins > 0) durations.push(mins);
      }
    }
    if (durations.length === 0) return null;
    return { avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length), count: durations.length };
  }

  function formatDuration(mins) {
    if (mins === null) return 'No data';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const piResponse = getAvgMinutes(filteredRequests, 'sent_to_parts', ['quoted']);
  const wcResponse = getAvgMinutes(filteredRequests, 'quoted', ['sent_to_advisor', 'awaiting_workshop_approval']);
  const saResponse = getAvgMinutes(filteredRequests, 'sent_to_advisor', ['sent_to_customer']);

  const getFilterLabel = () => {
    if (filterType === 'all') return 'All Time';
    if (filterType === 'year') return selectedYear;
    if (filterType === 'month') {
      const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
      return `${monthLabel} ${selectedYear}`;
    }
    if (filterType === 'day') {
      const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
      return `${selectedDay} ${monthLabel} ${selectedYear}`;
    }
    return '';
  };

  if (!user || (user.staff_role !== 'admin' && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-slate-600">Administrator access required</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Statistics Dashboard</h1>
          <p className="text-slate-500 mt-1">Historical data and performance metrics</p>
        </div>

        {/* Date Filter Controls */}
        <Card className="border-0 shadow-sm mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Period</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterType !== 'all' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Year</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(filterType === 'month' || filterType === 'day') && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Month</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(month => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filterType === 'day' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Day</label>
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 bg-slate-100 rounded-lg">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Viewing:</span> {getFilterLabel()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-slate-100 rounded-xl">
                    <FileText className="h-6 w-6 text-slate-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Total Requests</p>
                </div>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-blue-100 rounded-xl">
                    <Send className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Sent to Customer</p>
                </div>
                <p className="text-3xl font-bold text-slate-900">{stats.sentToCustomer}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-emerald-100 rounded-xl">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Total Approved</p>
                </div>
                <p className="text-3xl font-bold text-slate-900">{stats.approved}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-red-100 rounded-xl">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Total Rejected</p>
                </div>
                <p className="text-3xl font-bold text-slate-900">{stats.rejected}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Response Time Stats */}
        <Card className="border-0 shadow-sm mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Average Response Times
            </CardTitle>
            <p className="text-sm text-slate-500">How long each role takes to action a request (based on audit log timestamps)</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  <p className="text-sm font-semibold text-purple-800">Parts Interpreter</p>
                </div>
                <p className="text-xs text-purple-600 mb-3">Sent to Parts &rarr; Quoted</p>
                <p className="text-3xl font-bold text-purple-900">{formatDuration(piResponse?.avg ?? null)}</p>
                {piResponse && <p className="text-xs text-purple-500 mt-1">from {piResponse.count} request{piResponse.count !== 1 ? 's' : ''}</p>}
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">Workshop Controller</p>
                </div>
                <p className="text-xs text-amber-600 mb-3">Quoted &rarr; Decision Made</p>
                <p className="text-3xl font-bold text-amber-900">{formatDuration(wcResponse?.avg ?? null)}</p>
                {wcResponse && <p className="text-xs text-amber-500 mt-1">from {wcResponse.count} request{wcResponse.count !== 1 ? 's' : ''}</p>}
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Headphones className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800">Service Advisor</p>
                </div>
                <p className="text-xs text-blue-600 mb-3">Sent to Advisor &rarr; Sent to Customer</p>
                <p className="text-3xl font-bold text-blue-900">{formatDuration(saResponse?.avg ?? null)}</p>
                {saResponse && <p className="text-xs text-blue-500 mt-1">from {saResponse.count} request{saResponse.count !== 1 ? 's' : ''}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Metrics */}
        <Card className="border-0 shadow-sm mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-600 mb-1">Approval Rate</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {stats.sentToCustomer > 0 
                    ? Math.round((stats.approved / stats.sentToCustomer) * 100) 
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Rejection Rate</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.sentToCustomer > 0 
                    ? Math.round((stats.rejected / stats.sentToCustomer) * 100) 
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Conversion Rate</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.total > 0 
                    ? Math.round((stats.approved / stats.total) * 100) 
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}