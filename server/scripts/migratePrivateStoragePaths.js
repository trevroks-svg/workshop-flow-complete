/**
 * Move legacy workshop-photos objects into tenant-prefixed paths and replace
 * permanent public URLs in database records with private object paths.
 *
 * Dry run: node server/scripts/migratePrivateStoragePaths.js
 * Apply:   node server/scripts/migratePrivateStoragePaths.js --apply
 *
 * Run this before applying 202607310001_private_workshop_storage.sql.
 */
import '../env.js';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'workshop-photos';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const apply = process.argv.includes('--apply');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function toObjectPath(value) {
  if (!value || typeof value !== 'string') return null;
  const markerIndex = value.indexOf(PUBLIC_MARKER);
  if (markerIndex !== -1) {
    return decodeURIComponent(value.slice(markerIndex + PUBLIC_MARKER.length).split('?')[0]);
  }
  if (/^https?:/i.test(value)) return null;
  return value.replace(/^\/+/, '');
}

function tenantPath(businessId, oldPath) {
  if (oldPath.startsWith(`${businessId}/`)) return oldPath;
  return `${businessId}/${oldPath}`;
}

const { data: requests, error: requestError } = await supabase
  .from('parts_requests')
  .select('id,business_id,quote_pdf_url')
  .not('quote_pdf_url', 'is', null);
if (requestError) throw requestError;

const { data: requestPhotos, error: photoError } = await supabase
  .from('quote_request_photos')
  .select('id,business_id,photo_url')
  .not('photo_url', 'is', null);
if (photoError) throw photoError;

const { data: inspections, error: inspectionError } = await supabase
  .from('vehicle_inspections')
  .select('id,business_id,photo_urls')
  .not('photo_urls', 'is', null);
if (inspectionError) throw inspectionError;

const references = [];
for (const row of requests) {
  const oldPath = toObjectPath(row.quote_pdf_url);
  if (oldPath) references.push({
    table: 'parts_requests',
    id: row.id,
    column: 'quote_pdf_url',
    businessId: row.business_id,
    oldPath,
    newPath: tenantPath(row.business_id, oldPath),
  });
}
for (const row of requestPhotos) {
  const oldPath = toObjectPath(row.photo_url);
  if (oldPath) references.push({
    table: 'quote_request_photos',
    id: row.id,
    column: 'photo_url',
    businessId: row.business_id,
    oldPath,
    newPath: tenantPath(row.business_id, oldPath),
  });
}

const inspectionUpdates = [];
for (const row of inspections) {
  const oldValues = Array.isArray(row.photo_urls) ? row.photo_urls : [];
  const newValues = oldValues.map(value => {
    const oldPath = toObjectPath(value);
    return oldPath ? tenantPath(row.business_id, oldPath) : value;
  });
  oldValues.forEach((value, index) => {
    const oldPath = toObjectPath(value);
    if (oldPath) references.push({
      table: 'vehicle_inspections',
      id: row.id,
      column: `photo_urls[${index}]`,
      businessId: row.business_id,
      oldPath,
      newPath: newValues[index],
    });
  });
  if (JSON.stringify(oldValues) !== JSON.stringify(newValues)) {
    inspectionUpdates.push({ id: row.id, photo_urls: newValues });
  }
}

const moves = [...new Map(
  references
    .filter(item => item.oldPath !== item.newPath)
    .map(item => [`${item.oldPath}\n${item.newPath}`, { oldPath: item.oldPath, newPath: item.newPath }]),
).values()];

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  databaseReferences: references.length,
  objectsToCopy: moves.length,
  partRequestsToUpdate: references.filter(item => item.table === 'parts_requests').length,
  requestPhotosToUpdate: references.filter(item => item.table === 'quote_request_photos').length,
  inspectionsToUpdate: inspectionUpdates.length,
}, null, 2));

if (!apply) process.exit(0);

const copied = [];
let databaseUpdatesStarted = false;
try {
  for (const move of moves) {
    const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(move.oldPath);
    if (downloadError) throw new Error(`Download failed for ${move.oldPath}: ${downloadError.message}`);
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(move.newPath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (uploadError && !/already exists/i.test(uploadError.message)) {
      throw new Error(`Upload failed for ${move.newPath}: ${uploadError.message}`);
    }
    if (!uploadError) copied.push(move.newPath);
  }

  for (const item of references.filter(row => row.table !== 'vehicle_inspections')) {
    databaseUpdatesStarted = true;
    const { error } = await supabase
      .from(item.table)
      .update({ [item.column]: item.newPath })
      .eq('id', item.id);
    if (error) throw error;
  }
  for (const inspection of inspectionUpdates) {
    const { error } = await supabase
      .from('vehicle_inspections')
      .update({ photo_urls: inspection.photo_urls })
      .eq('id', inspection.id);
    if (error) throw error;
  }

  const oldPaths = [...new Set(moves.map(item => item.oldPath))];
  if (oldPaths.length) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(oldPaths);
    if (removeError) {
      console.warn(`Migration completed, but legacy object cleanup failed: ${removeError.message}`);
    }
  }
  console.log(`Migrated ${references.length} database references and ${moves.length} storage objects.`);
} catch (error) {
  // Copies are safe to remove only before any record can point at them.
  if (!databaseUpdatesStarted && copied.length) {
    await supabase.storage.from(BUCKET).remove(copied);
  }
  throw error;
}
