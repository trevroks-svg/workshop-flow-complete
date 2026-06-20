import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Loader2, Archive, Trash2, AlertCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import StatusBadge from "../components/StatusBadge";

export default function CleanupOrders() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [bulkDeleteType, setBulkDeleteType] = useState(null);
  const queryClient = useQueryClient();

  

  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ['cleanupRequests'],
    queryFn: () => entities.PartsRequest.list('-created_at', 500),
    refetchInterval: 30000
  });

  const staffRole = user?.staff_role;
  const isAdmin = staffRole === 'admin';
  const isServiceManager = staffRole === 'service_manager';
  const canManage = isAdmin || isServiceManager;

  // Calculate expiry and filter
  const requests = allRequests.map(r => {
    const created = new Date(r.created_at);
    const expiresAt = new Date(created.getTime() + 5 * 24 * 60 * 60 * 1000);
    const isExpired = new Date() > expiresAt;
    return { ...r, expiresAt, isExpired };
  }).filter(r => 
    r.isExpired || r.is_archived || r.delete_requested || r.status === 'sent_to_parts'
  );

  const filteredRequests = requests.filter(r =>
    !searchQuery || r.job_card_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const archiveMutation = useMutation({
    mutationFn: async (request) => {
      const now = new Date().toISOString();
      await entities.PartsRequest.update(request.id, {
        is_archived: true,
        archived_at: now,
        archived_by: user.email,
        audit_log: [
          ...(request.audit_log || []),
          {
            previous_status: request.status,
            new_status: request.status,
            changed_by_email: user.email,
            changed_by_name: user.full_name,
            changed_at: now,
            notes: 'Request archived from cleanup screen'
          }
        ]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleanupRequests'] });
      toast.success('Request archived successfully');
    },
    onError: () => {
      toast.error('Failed to archive request');
    }
  });

  const requestDeleteMutation = useMutation({
    mutationFn: async (request) => {
      const now = new Date().toISOString();
      await entities.PartsRequest.update(request.id, {
        delete_requested: true,
        delete_requested_at: now,
        delete_requested_by: user.email,
        audit_log: [
          ...(request.audit_log || []),
          {
            previous_status: request.status,
            new_status: request.status,
            changed_by_email: user.email,
            changed_by_name: user.full_name,
            changed_at: now,
            notes: 'Deletion requested from cleanup screen'
          }
        ]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleanupRequests'] });
      toast.success('Deletion requested successfully');
    },
    onError: () => {
      toast.error('Failed to request deletion');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (requestId) => {
      await entities.PartsRequest.delete(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleanupRequests'] });
      setDeleteConfirmId(null);
      toast.success('Request permanently deleted');
    },
    onError: () => {
      toast.error('Failed to delete request');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (type) => {
      let requestsToDelete = [];
      
      if (type === 'expired') {
        requestsToDelete = requests.filter(r => r.isExpired && !r.is_archived);
      } else if (type === 'archived') {
        requestsToDelete = requests.filter(r => r.is_archived);
      } else if (type === 'delete_requested') {
        requestsToDelete = requests.filter(r => r.delete_requested);
      } else if (type === 'all') {
        requestsToDelete = requests;
      }

      for (const request of requestsToDelete) {
        await entities.PartsRequest.delete(request.id);
      }
      
      return requestsToDelete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['cleanupRequests'] });
      setBulkDeleteType(null);
      toast.success(`Successfully deleted ${count} request${count !== 1 ? 's' : ''}`);
    },
    onError: () => {
      toast.error('Failed to complete bulk deletion');
      setBulkDeleteType(null);
    }
  });

  if (!canManage) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-slate-600">Only Service Managers and Administrators can access the cleanup screen.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Cleanup / Expired Orders</h1>
              <p className="text-slate-600">
                Manage expired, archived, and deletion-requested orders. Orders automatically expire after 5 days.
              </p>
            </div>
            {isAdmin && requests.length > 0 && (
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteType('expired')}
                  disabled={requests.filter(r => r.isExpired && !r.is_archived).length === 0}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete All Expired ({requests.filter(r => r.isExpired && !r.is_archived).length})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteType('archived')}
                  disabled={requests.filter(r => r.is_archived).length === 0}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete All Archived ({requests.filter(r => r.is_archived).length})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteType('delete_requested')}
                  disabled={requests.filter(r => r.delete_requested).length === 0}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete All Requested ({requests.filter(r => r.delete_requested).length})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteType('all')}
                  disabled={requests.length === 0}
                  className="bg-red-700 hover:bg-red-800"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete ALL ({requests.length})
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by job card number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requests.filter(r => r.isExpired).length}</p>
                  <p className="text-sm text-slate-600">Expired</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Archive className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requests.filter(r => r.is_archived).length}</p>
                  <p className="text-sm text-slate-600">Archived</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requests.filter(r => r.status === 'sent_to_parts').length}</p>
                  <p className="text-sm text-slate-600">Awaiting Quote</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Trash2 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requests.filter(r => r.delete_requested).length}</p>
                  <p className="text-sm text-slate-600">Delete Requested</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-slate-500">No expired, archived, or deletion-requested orders found</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Card</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.job_card_number}</TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {format(new Date(request.created_at), "dd/MM/yy HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-600">
                              {format(request.expiresAt, "dd/MM/yy HH:mm")}
                            </span>
                            {request.isExpired && (
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 w-fit text-xs">
                                Expired
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {request.technician_name || request.technician_email || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {request.is_archived && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 w-fit text-xs">
                                Archived
                              </Badge>
                            )}
                            {request.delete_requested && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 w-fit text-xs">
                                Delete Requested
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {!request.is_archived && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => archiveMutation.mutate(request)}
                                disabled={archiveMutation.isPending}
                              >
                                <Archive className="h-3 w-3 mr-1" />
                                Archive
                              </Button>
                            )}
                            {!request.delete_requested && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => requestDeleteMutation.mutate(request)}
                                disabled={requestDeleteMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Request Delete
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteConfirmId(request.id)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently Delete Request?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the request and cannot be undone. All data including photos, audit logs, and history will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={!!bulkDeleteType} onOpenChange={() => setBulkDeleteType(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bulk Delete Confirmation</AlertDialogTitle>
              <AlertDialogDescription>
                {bulkDeleteType === 'expired' && (
                  <>You are about to permanently delete <strong>{requests.filter(r => r.isExpired && !r.is_archived).length}</strong> expired requests. This cannot be undone.</>
                )}
                {bulkDeleteType === 'archived' && (
                  <>You are about to permanently delete <strong>{requests.filter(r => r.is_archived).length}</strong> archived requests. This cannot be undone.</>
                )}
                {bulkDeleteType === 'delete_requested' && (
                  <>You are about to permanently delete <strong>{requests.filter(r => r.delete_requested).length}</strong> deletion-requested items. This cannot be undone.</>
                )}
                {bulkDeleteType === 'all' && (
                  <>You are about to permanently delete <strong>ALL {requests.length}</strong> requests shown on this page. This is irreversible and will remove all expired, archived, and deletion-requested items.</>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => bulkDeleteMutation.mutate(bulkDeleteType)}
                className="bg-red-600 hover:bg-red-700"
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
