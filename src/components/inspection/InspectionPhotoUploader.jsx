import { uploadFile } from '@/api/storage';
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, X, Loader2, Image } from "lucide-react";
import { toast } from "sonner";

export default function InspectionPhotoUploader({ photos = [], onChange, readonly = false }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const file_url = await uploadFile(file, 'inspection-photos');
          return file_url;
        })
      );
      onChange([...photos, ...urls]);
      toast.success(`${urls.length} photo(s) uploaded`);
    } catch (err) {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remove = (idx) => {
    const updated = photos.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="h-5 w-5 text-slate-500" />
          Inspection Photos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {photos.length === 0 && readonly && (
          <p className="text-sm text-slate-400">No photos attached.</p>
        )}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {photos.map((url, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100">
                <img src={url} alt={`Inspection photo ${idx + 1}`} className="w-full h-full object-cover" />
                {!readonly && (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!readonly && (
          <label className="cursor-pointer">
            <div className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-slate-400 transition-colors">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : (
                <Image className="h-5 w-5 text-slate-400" />
              )}
              <span className="text-sm text-slate-500">
                {uploading ? 'Uploading...' : 'Tap to add photos'}
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}