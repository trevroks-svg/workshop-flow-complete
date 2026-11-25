/**
 * storage.js
 *
 * Replaces base44's file upload with Supabase Storage.
 *
 * Before using:
 *   1. In Supabase Dashboard → Storage, create a bucket called "workshop-photos"
 *   2. Set it to public (or configure signed URLs for private access)
 */

import { supabase } from '@/api/supabaseClient';

const BUCKET = 'workshop-photos';

/**
 * Upload a file and return its public URL.
 *
 * @param {File} file - The file object from an <input type="file">
 * @param {string} folder - Subfolder path, e.g. 'request-photos' or 'inspection-photos'
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadFile(file, folder = 'uploads') {
  const ext = file.name.split('.').pop();
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, { upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Delete a file by its public URL.
 */
export async function deleteFile(publicUrl) {
  // Extract path from URL: everything after /storage/v1/object/public/<bucket>/
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) throw new Error('Could not parse storage path from URL');
  const path = publicUrl.slice(idx + marker.length);

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
