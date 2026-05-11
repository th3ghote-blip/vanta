-- Phase 5.1 — KYC real upload
-- Adds missing RLS policies for kyc_submissions + kyc_documents,
-- and creates the 'kyc' Storage bucket with per-user upload policies.

-- ── kyc_submissions policies ─────────────────────────────────────────────────

-- Users can insert their own submission row
create policy "Users insert own KYC submission"
  on kyc_submissions for insert
  with check (user_id = auth.uid());

-- Users can update their own submission (e.g. status not_started → pending)
create policy "Users update own KYC submission"
  on kyc_submissions for update
  using (user_id = auth.uid());

-- ── kyc_documents policies ───────────────────────────────────────────────────

-- Users can insert documents on their own submissions
create policy "Users insert own KYC documents"
  on kyc_documents for insert
  with check (
    exists (
      select 1 from kyc_submissions s
      where s.id = kyc_documents.submission_id
        and s.user_id = auth.uid()
    )
  );

-- Users can read documents on their own submissions
create policy "Users see own KYC documents"
  on kyc_documents for select
  using (
    exists (
      select 1 from kyc_submissions s
      where s.id = kyc_documents.submission_id
        and s.user_id = auth.uid()
    )
  );

-- ── Storage bucket ───────────────────────────────────────────────────────────

-- Create private 'kyc' bucket (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc',
  'kyc',
  false,
  10485760,   -- 10 MB max per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Authenticated users may upload to their own folder: kyc/<user_id>/
create policy "Users upload own KYC docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may overwrite (update) files in their own folder
create policy "Users update own KYC docs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may read their own KYC docs
create policy "Users read own KYC docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all KYC docs (for review screen 5.2)
create policy "Admins read all KYC docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc'
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
