-- Non-destructive migration for Ambil Barang photo thumbnails.
-- Run once in Supabase SQL Editor. Existing original photos are preserved.

begin;

alter table public.stock_takes
  add column if not exists photo_thumbnail text;

alter table public.stock_takes
  add column if not exists has_photo boolean generated always as (photo is not null) stored;

commit;