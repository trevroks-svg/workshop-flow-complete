import { uploadFile } from '@/api/storage';
import React, { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Upload, Loader2 } from "lucide-react";

export default function PhotoUploader({ requestId, user, onPhotoAdded }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ photoUrl, caption }) => {
      await entities.QuoteRequestPhoto.create({
        quote_request_id: requestId,
        photo_url: photoUrl,
        caption: caption || "",
        taken_by_email: user.email,
        taken_by_name: user.full_name,
        taken_by_role: user.staff_role,
        visibility: "internal"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quoteRequestPhotos', requestId]);
      toast.success("Photo added successfully");
      if (onPhotoAdded) onPhotoAdded();
      setShowDialog(false);
      setSelectedFile(null);
      setCaption("");
    }
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a photo");
      return;
    }

    setIsUploading(true);
    try {
      const file_url = await uploadFile(selectedFile, 'request-photos');
      await uploadPhotoMutation.mutateAsync({
        photoUrl: file_url,
        caption: caption.trim()
      });
    } catch (error) {
      toast.error("Failed to upload photo");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
      >
        <Camera className="h-4 w-4" />
        Add Photo
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Photo</Label>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="mt-1.5"
              />
              {selectedFile && (
                <p className="text-sm text-slate-500 mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
            <div>
              <Label>Caption <span className="text-slate-500 text-xs">(optional but recommended)</span></Label>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Air filter condition, Brake pad wear, Leak location"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || !selectedFile}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}