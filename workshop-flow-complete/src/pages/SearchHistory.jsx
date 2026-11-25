import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Link } from 'react-router-dom';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Package, ClipboardList, Clock, User, ChevronRight } from "lucide-react";
import { createPageUrl } from "@/utils";
import StatusBadge from "../components/StatusBadge";
import InspectionStatusBadge from "../components/inspection/InspectionStatusBadge";

function formatDT(isoString) {
  if (!isoString) return '';
  const s = String(isoString);
  const hasZone = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasZone ? s : `${s}Z`);
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Adelaide',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export default function SearchHistory() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['allPartsRequestsHistory'],
    queryFn: () => entities.PartsRequest.list('-created_at', 500),
  });

  const { data: allInspections = [], isLoading: inspectionsLoading } = useQuery({
    queryKey: ['allInspectionsHistory'],
    queryFn: () => entities.VehicleInspection.list('-created_at', 500),
  });

  const isLoading = requestsLoading || inspectionsLoading;
  const trimmed = searchQuery.trim().toLowerCase();

  const matchedRequests = trimmed.length >= 2
    ? allRequests.filter(r => r.job_card_number?.toLowerCase().includes(trimmed))
    : [];

  const matchedInspections = trimmed.length >= 2
    ? allInspections.filter(i => i.job_card_number?.toLowerCase().includes(trimmed))
    : [];

  const totalResults = matchedRequests.length + matchedInspections.length;
  const hasSearch = trimmed.length >= 2;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Job History Search</h1>
          <p className="text-slate-500 mt-1">Search all past parts requests and vehicle inspections by job number</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            placeholder="Enter job card number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white h-12 text-base"
            autoFocus
          />
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading records...</div>
        ) : !hasSearch ? (
          <div className="text-center py-16">
            <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-500">Enter at least 2 characters to search</p>
          </div>
        ) : totalResults === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium">No results found</p>
            <p className="text-slate-500 text-sm mt-1">No records match job number "{searchQuery}"</p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">{totalResults} result{totalResults !== 1 ? 's' : ''} found</p>

            {/* Parts Requests */}
            {matchedRequests.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-orange-500" />
                  Parts Requests ({matchedRequests.length})
                </h2>
                <div className="space-y-3">
                  {matchedRequests.map(request => (
                    <Link key={request.id} to={createPageUrl(`RequestDetail?id=${request.id}`)}>
                      <Card className="p-4 hover:shadow-md transition-all duration-200 hover:border-orange-300 border-orange-100 cursor-pointer group bg-orange-50/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-orange-100 rounded-lg shrink-0">
                              <Package className="h-4 w-4 text-orange-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-900">Job #{request.job_card_number}</p>
                                {request.is_archived && (
                                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Archived</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <StatusBadge status={request.status} />
                                {request.customer_name && (
                                  <span className="text-sm text-slate-500">{request.customer_name}</span>
                                )}
                                {request.vehicle_type && (
                                  <span className="text-sm text-slate-400">· {request.vehicle_type}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDT(request.created_at)}</span>
                                {request.technician_name && (
                                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{request.technician_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-orange-400 transition-colors shrink-0" />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Vehicle Inspections */}
            {matchedInspections.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  Vehicle Inspections ({matchedInspections.length})
                </h2>
                <div className="space-y-3">
                  {matchedInspections.map(inspection => (
                    <Link
                      key={inspection.id}
                      to={`${createPageUrl('VehicleInspection')}?id=${inspection.id}${inspection.request_id ? `&request_id=${inspection.request_id}` : ''}`}
                    >
                      <Card className="p-4 hover:shadow-md transition-all duration-200 hover:border-blue-300 border-blue-100 cursor-pointer group bg-blue-50/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                              <ClipboardList className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-900">Job #{inspection.job_card_number}</p>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Vehicle Inspection</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <InspectionStatusBadge status={inspection.status} />
                                {inspection.customer_name && (
                                  <span className="text-sm text-slate-500">{inspection.customer_name}</span>
                                )}
                                {inspection.vehicle_make_model && (
                                  <span className="text-sm text-slate-400">· {inspection.vehicle_make_model}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDT(inspection.created_at)}</span>
                                {inspection.technician_name && (
                                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{inspection.technician_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-400 transition-colors shrink-0" />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}