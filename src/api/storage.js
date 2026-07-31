import { supabase } from '@/api/supabaseClient';

export const STORAGE_BUCKET = 'workshop-photos';
export const SIGNED_URL_EXPIRY_SECONDS = 10 * 60;

let currentBusinessIdPromise;

async function getCurrentBusinessId() {
  if (!currentBusinessIdPromise) {
    currentBusinessIdPromise = (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('You must be signed in to upload files');

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('business_id')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.business_id) throw new Error('Your user is not assigned to a business');
      return profile.business_id;
    })().catch(error => {
      currentBusinessIdPromise = null;
      throw error;
    });
  }
  return currentBusinessIdPromise;
}

function sanitiseExtension(filename) {
  const extension = String(filename || '').split('.').pop()?.toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(extension || '') ? extension : 'bin';
}

/**
 * Convert a stored object path or a legacy Supabase object URL to an object path.
 * Non-Supabase HTTP(S), blob, and data URLs are returned as null so legacy
 * external content can continue to render without being sent to Storage.
 */
export function getStorageObjectPath(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const markers = [
    `/storage/v1/object/public/${STORAGE_BUCKET}/`,
    `/storage/v1/object/sign/${STORAGE_BUCKET}/`,
    `/storage/v1/object/authenticated/${STORAGE_BUCKET}/`,
  ];
  for (const marker of markers) {
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex !== -1) {
      const encodedPath = trimmed.slice(markerIndex + marker.length).split('?')[0];
      return decodeURIComponent(encodedPath);
    }
  }

  if (/^(https?:|blob:|data:)/i.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, '');
}

export function isExternalStorageValue(value) {
  return Boolean(value && /^(https?:|blob:|data:)/i.test(value) && !getStorageObjectPath(value));
}

/**
 * Upload a file and return its private bucket object path for database storage.
 */
export async function uploadFile(file, folder = 'uploads') {
  const businessId = await getCurrentBusinessId();
  const safeFolder = String(folder).replace(/[^a-z0-9_-]/gi, '');
  const objectPath = `${businessId}/${safeFolder}/${crypto.randomUUID()}.${sanitiseExtension(file.name)}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, file, { upsert: false, contentType: file.type || undefined });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return objectPath;
}

/**
 * Resolve a stored object path to a short-lived URL. Legacy external URLs pass
 * through unchanged; legacy Supabase public URLs are converted and signed.
 */
export async function createSignedFileUrl(value, expiresIn = SIGNED_URL_EXPIRY_SECONDS) {
  if (!value) return null;
  const objectPath = getStorageObjectPath(value);
  if (!objectPath) return isExternalStorageValue(value) ? value : null;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(objectPath, expiresIn);
  if (error) throw new Error(`Could not access file: ${error.message}`);
  return data.signedUrl;
}

export async function createSignedFileUrls(values, expiresIn = SIGNED_URL_EXPIRY_SECONDS) {
  return Promise.all((values || []).map(value => createSignedFileUrl(value, expiresIn)));
}

/**
 * Delete a private object using its stored path or legacy Supabase URL.
 */
export async function deleteFile(value) {
  const objectPath = getStorageObjectPath(value);
  if (!objectPath) throw new Error('Could not determine the storage object path');

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
