-- Keep generated media private and restrict stored asset types to formats that
-- the starter validates before upload and safely previews/downloads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-media',
  'generated-media',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;