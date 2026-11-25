import { uploadFile } from '@/api/storage';
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Manages a list of pre-uploaded photos with optional captions.
 * Each photo is uploaded to storage immediately on selection.
 * photos state shape: [{ url, caption, uploading }]
 */
export default function RequestPhotoUploader({ photos, onChange }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    // Add placeholders with uploading=true
    const placeholders = files.map(() => ({ url: null, caption: '', uploading: true }));
    const baseIndex = photos.length;
    onChange([...photos, ...placeholders]);

    // Upload each file
    const uploaded = await Promise.all(
      files.map(async (file, i) => {
        try {
          const file_url = await uploadFile(file, 'request-photos');
          return { url: file_url, caption: '', uploading: false };
        } catch {
          toast.error(`Failed to upload ${file.name}`);
          return null;
        }
      })
    );

    onChange(prev => {
      const next = [...prev];
      files.forEach((_, i) => {
        const result = uploaded[i];
        if (result) {
          next[baseIndex + i] = result;
        } else {
          next.splice(baseIndex + i, 1);
        }
      });
      // Remove any remaining nulls from failed uploads
      return next.filter(Boolean);
    });
  };

  const updateCaption = (index, caption) => {
    onChange(photos.map((p, i) => i === index ? { ...p, caption } : p));
  };

  const removePhoto = (index) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {photos.map((photo, index) => (
        <div key={index} className="flex gap-3 items-start bg-slate-50 rounded-lg p-3">
          {photo.uploading ? (
            <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <img
              src={photo.url}
              alt={`Photo ${index + 1}`}
              className="w-16 h-16 object-cover rounded-lg shrink-0 border border-slate-200"
            />
          )}
          <div className="flex-1 min-w-0">
            <Input
              value={photo.caption}
              onChange={e => updateCaption(index, e.target.value)}
              placeholder="Add a caption (optional)"
              className="h-8 text-sm"
              disabled={photo.uploading}
            />
          </div>
          <button
            type="button"
            onClick={() => removePhoto(index)}
            className="text-slate-400 hover:text-red-500 transition-colors mt-1 shrink-0"
            disabled={photo.uploading}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        className="w-full gap-2 border-dashed"
      >
        <ImagePlus className="h-4 w-4" />
        Add Photos
      </Button>
    </div>
  );
}