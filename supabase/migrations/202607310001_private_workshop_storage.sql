-- Apply only after running:
--   node server/scripts/migratePrivateStoragePaths.js --apply
--
-- Database URL columns retain their existing names for compatibility, but now
-- contain private object paths in the form <business_id>/<folder>/<filename>.

do $$
begin
  if exists (
    select 1
    from public.parts_requests
    where quote_pdf_url is not null
      and quote_pdf_url <> ''
      and quote_pdf_url not like business_id::text || '/%'
  ) then
    raise exception 'Legacy quote_pdf_url values remain; run migratePrivateStoragePaths.js first';
  end if;

  if exists (
    select 1
    from public.quote_request_photos
    where photo_url is not null
      and photo_url <> ''
      and photo_url not like business_id::text || '/%'
  ) then
    raise exception 'Legacy quote request photo URLs remain; run migratePrivateStoragePaths.js first';
  end if;

  if exists (
    select 1
    from public.vehicle_inspections inspection,
      lateral jsonb_array_elements_text(coalesce(inspection.photo_urls, '[]'::jsonb)) value
    where value not like inspection.business_id::text || '/%'
  ) then
    raise exception 'Legacy inspection photo URLs remain; run migratePrivateStoragePaths.js first';
  end if;
end
$$;

update storage.buckets
set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]
where id = 'workshop-photos';

create or replace function public.current_workshop_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.users
  where id = auth.uid()
    and staff_role is not null
  limit 1
$$;

create or replace function public.current_workshop_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select staff_role
  from public.users
  where id = auth.uid()
  limit 1
$$;

revoke all on function public.current_workshop_business_id() from public;
revoke all on function public.current_workshop_staff_role() from public;
grant execute on function public.current_workshop_business_id() to authenticated;
grant execute on function public.current_workshop_staff_role() to authenticated;

-- workshop-photos is currently the project's only storage bucket. Remove the
-- prior broad policies before installing tenant- and role-scoped replacements.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end
$$;

create policy "Workshop users view own business files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'workshop-photos'
  and (storage.foldername(name))[1] = public.current_workshop_business_id()::text
);

create policy "Workshop roles upload own business files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workshop-photos'
  and (storage.foldername(name))[1] = public.current_workshop_business_id()::text
  and case (storage.foldername(name))[2]
    when 'quote-pdfs' then public.current_workshop_staff_role() in
      ('parts_interpreter', 'service_manager', 'admin', 'super_admin')
    when 'request-photos' then public.current_workshop_staff_role() in
      ('technician', 'service_manager', 'admin', 'super_admin')
    when 'inspection-photos' then public.current_workshop_staff_role() in
      ('technician', 'workshop_controller', 'service_advisor', 'service_manager', 'admin', 'super_admin')
    else public.current_workshop_staff_role() in ('admin', 'super_admin')
  end
);

create policy "Workshop roles update own business files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'workshop-photos'
  and (storage.foldername(name))[1] = public.current_workshop_business_id()::text
)
with check (
  bucket_id = 'workshop-photos'
  and (storage.foldername(name))[1] = public.current_workshop_business_id()::text
  and case (storage.foldername(name))[2]
    when 'quote-pdfs' then public.current_workshop_staff_role() in
      ('parts_interpreter', 'service_manager', 'admin', 'super_admin')
    when 'request-photos' then public.current_workshop_staff_role() in
      ('technician', 'service_manager', 'admin', 'super_admin')
    when 'inspection-photos' then public.current_workshop_staff_role() in
      ('technician', 'workshop_controller', 'service_advisor', 'service_manager', 'admin', 'super_admin')
    else public.current_workshop_staff_role() in ('admin', 'super_admin')
  end
);

create policy "Owners and managers delete own business files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'workshop-photos'
  and (storage.foldername(name))[1] = public.current_workshop_business_id()::text
  and (
    owner_id = auth.uid()::text
    or public.current_workshop_staff_role() in ('service_manager', 'admin', 'super_admin')
  )
);
