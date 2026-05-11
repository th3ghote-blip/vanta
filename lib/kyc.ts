/**
 * lib/kyc.ts — Phase 5.1
 *
 * Helpers for KYC document upload and submission management.
 * Uses Supabase Storage (bucket: 'kyc') + kyc_submissions / kyc_documents tables.
 */
import { supabase } from '@/lib/supabase';

export type DocType = 'id_front' | 'id_back' | 'selfie' | 'proof_of_address';
export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected';

export interface KycSubmission {
  id: string;
  status: KycStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
}

export interface KycDocRecord {
  doc_type: DocType;
  storage_path: string;
  uploaded_at: string;
}

/**
 * Load the user's latest KYC submission (any status) or create a new
 * not_started one if none exists.
 */
export async function getOrCreateSubmission(userId: string): Promise<KycSubmission> {
  // Try to fetch an existing submission (most recent first)
  const { data: existing, error: fetchErr } = await supabase
    .from('kyc_submissions')
    .select('id, status, rejection_reason, submitted_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw new Error(`Failed to fetch KYC submission: ${fetchErr.message}`);
  if (existing) return existing as KycSubmission;

  // None exists — create one
  const { data: created, error: insertErr } = await supabase
    .from('kyc_submissions')
    .insert({ user_id: userId, status: 'not_started' })
    .select('id, status, rejection_reason, submitted_at')
    .single();

  if (insertErr) throw new Error(`Failed to create KYC submission: ${insertErr.message}`);
  return created as KycSubmission;
}

/**
 * List documents already uploaded for a given submission.
 */
export async function getSubmissionDocs(submissionId: string): Promise<KycDocRecord[]> {
  const { data, error } = await supabase
    .from('kyc_documents')
    .select('doc_type, storage_path, uploaded_at')
    .eq('submission_id', submissionId);

  if (error) throw new Error(`Failed to fetch KYC documents: ${error.message}`);
  return (data ?? []) as KycDocRecord[];
}

/**
 * Upload a single document image and record it in the DB.
 *
 * @param userId       Supabase user id (used as Storage folder name)
 * @param submissionId Parent kyc_submission row id
 * @param docType      Which document this is
 * @param localUri     Local file URI returned by expo-image-picker
 * @returns            The public storage path stored in the DB
 */
export async function uploadDocument(
  userId: string,
  submissionId: string,
  docType: DocType,
  localUri: string,
): Promise<string> {
  const storagePath = `${userId}/${docType}.jpg`;

  // Fetch the local file as a Blob (works with file:// URIs in Expo/Hermes)
  const response = await fetch(localUri);
  if (!response.ok) throw new Error(`Could not read image file (status ${response.status})`);
  const blob = await response.blob();

  // Upload to Supabase Storage (upsert: true so re-uploads overwrite)
  const { error: storageErr } = await supabase.storage
    .from('kyc')
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

  if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

  // Upsert the kyc_documents row (overwrite if doc_type already exists)
  const { error: dbErr } = await supabase
    .from('kyc_documents')
    .upsert(
      { submission_id: submissionId, doc_type: docType, storage_path: storagePath },
      { onConflict: 'submission_id,doc_type' },
    );

  if (dbErr) throw new Error(`Failed to record document: ${dbErr.message}`);

  return storagePath;
}

/**
 * Mark the submission as 'pending' once all documents are uploaded.
 */
export async function submitKyc(submissionId: string): Promise<void> {
  const { error } = await supabase
    .from('kyc_submissions')
    .update({ status: 'pending', submitted_at: new Date().toISOString() })
    .eq('id', submissionId);

  if (error) throw new Error(`Failed to submit KYC: ${error.message}`);
}

/**
 * Quick status check — returns the latest submission status or 'not_started'.
 */
export async function getKycStatus(userId: string): Promise<KycStatus> {
  const { data } = await supabase
    .from('kyc_submissions')
    .select('status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.status as KycStatus) ?? 'not_started';
}
