import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Image as ImageIcon, Download, Trash2, Copy, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import PhotoUploader from "./PhotoUploader";
import { createSignedFileUrl, deleteFile } from '@/api/storage';
import { useSignedStorageUrls } from '@/hooks/useSignedStorageUrls';

export default function PhotoGallery({ request, user }) {
  const queryClient = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['quoteRequestPhotos', request.id],
    queryFn: async () => {
      const results = await entities.QuoteRequestPhoto.filter({
        quote_request_id: request.id
      }, '-created_at');
      return results;
    }
  });

  const staffRole = user?.staff_role || 'technician';
  const { data: signedPhotoUrls = [] } = useSignedStorageUrls(photos.map(photo => photo.photo_url));

  // Determine permissions
  const canUpload = ['technician', 'service_manager', 'admin'].includes(staffRole) &&
  ['draft', 'sent_to_parts'].includes(request.status);

  const canDelete = (photo) => {
    if (['service_manager', 'admin'].includes(staffRole)) return true;
    if (staffRole === 'technician' &&
    photo.taken_by_email === user.email &&
    ['draft', 'sent_to_parts'].includes(request.status)) {
      return true;
    }
    return false;
  };

  const isServiceAdvisor = ['service_advisor', 'service_manager'].includes(staffRole);

  const deleteMutation = useMutation({
    mutationFn: async ({ photoId, reason }) => {
      if (photoToDelete?.photo_url) {
        await deleteFile(photoToDelete.photo_url);
      }
      await entities.QuoteRequestPhoto.delete(photoId);

      // Log to audit
      const auditEntry = {
        previous_status: request.status,
        new_status: request.status,
        changed_by_email: user.email,
        changed_by_name: user.full_name,
        changed_at: new Date().toISOString(),
        notes: `Photo deleted: ${photoToDelete?.caption || 'Untitled'}${reason ? ` - Reason: ${reason}` : ''}`
      };

      await entities.PartsRequest.update(request.id, {
        audit_log: [...(request.audit_log || []), auditEntry]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quoteRequestPhotos', request.id]);
      queryClient.invalidateQueries(['partsRequest', request.id]);
      toast.success("Photo deleted");
      setDeleteDialog(false);
      setPhotoToDelete(null);
      setDeleteReason("");
    }
  });

  const handleDelete = (photo) => {
    setPhotoToDelete(photo);
    setDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (['service_manager', 'admin'].includes(staffRole) && !deleteReason.trim()) {
      toast.error("Please provide a reason for deletion");
      return;
    }
    deleteMutation.mutate({
      photoId: photoToDelete.id,
      reason: deleteReason.trim()
    });
  };

  const handleDownload = async (photo) => {
    try {
      const signedUrl = await createSignedFileUrl(photo.photo_url);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.message || 'Could not open photo');
    }
  };

  const handleCopyPhotoList = () => {
    const photoList = photos.map((p, i) =>
    `${i + 1}. ${p.caption || 'Photo'}`
    ).join('\n');
    const summary = `${photos.length} photo${photos.length !== 1 ? 's' : ''} attached:\n${photoList}`;
    navigator.clipboard.writeText(summary);
    toast.success("Photo list copied to clipboard");
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" />
        </CardContent>
      </Card>);

  }

  return (
    <>
      <Card className="bg-violet-200 text-card-foreground mb-6 rounded-xl border-0 shadow-sm border-l-4 border-l-indigo-400">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-indigo-600" />
              {isServiceAdvisor ? 'Customer Evidence Photos' : 'Photos (For Customer Quote Evidence)'}
              {photos.length > 0 &&
              <span className="text-sm font-normal text-slate-500">({photos.length})</span>
              }
            </CardTitle>
            {canUpload &&
            <PhotoUploader
              requestId={request.id}
              user={user}
              onPhotoAdded={() => queryClient.invalidateQueries(['quoteRequestPhotos', request.id])} />

            }
          </div>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ?
          <div className="text-center py-8">
              <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto mb-3">
                <ImageIcon className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">No photos attached</p>
              {canUpload &&
            <p className="text-slate-400 text-xs mt-1">Add photos to help with customer communication</p>
            }
            </div> :

          <>
              {isServiceAdvisor &&
            <div className="mb-4 p-3 bg-cyan-50 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-cyan-600 mt-0.5" />
                    <p className="text-sm text-cyan-800">
                      Use these photos to attach to your customer email / DMS message.
                    </p>
                  </div>
                  <Button
                onClick={handleCopyPhotoList}
                variant="outline"
                size="sm"
                className="gap-2 mt-2">

                    <Copy className="h-3 w-3" />
                    Copy Photo List Summary
                  </Button>
                </div>
            }
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {photos.map((photo, index) =>
              <div key={photo.id} className="bg-slate-50 rounded-lg p-3 space-y-2">
                    <div className="aspect-video bg-slate-200 rounded overflow-hidden">
                      {signedPhotoUrls[index] ? (
                        <img
                          src={signedPhotoUrls[index]}
                          alt={photo.caption || 'Quote photo'}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => handleDownload(photo)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                      )}

                    </div>
                    {photo.caption &&
                <p className="text-sm font-medium text-slate-700">{photo.caption}</p>
                }
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {photo.taken_by_name?.split(' ')[0] || 'Unknown'} • {' '}
                        {format(new Date(photo.created_at), 'dd MMM, HH:mm')}
                      </span>
                      <div className="flex gap-1">
                        <Button
                      onClick={() => handleDownload(photo)}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Download">

                          <Download className="h-3 w-3" />
                        </Button>
                        {canDelete(photo) &&
                    <Button
                      onClick={() => handleDelete(photo)}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Delete">

                            <Trash2 className="h-3 w-3" />
                          </Button>
                    }
                      </div>
                    </div>
                  </div>
              )}
              </div>
            </>
          }
        </CardContent>
      </Card>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Photo</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this photo?
              {photoToDelete?.caption &&
              <span className="block font-medium mt-1">"{photoToDelete.caption}"</span>
              }
            </p>
            {['service_manager', 'admin'].includes(staffRole) &&
            <div>
                <Label>Reason for deletion <span className="text-red-500">*</span></Label>
                <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Explain why this photo is being deleted..."
                className="mt-1.5" />

              </div>
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700">

              {deleteMutation.isPending ?
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
              null}
              Delete Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);

}
