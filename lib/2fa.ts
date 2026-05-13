import { supabase } from '@/lib/supabase';

export interface TOTPEnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export interface MFAFactor {
  id: string;
  friendlyName?: string;
  status: 'verified' | 'unverified';
}

export async function enroll2FA(): Promise<{ data?: TOTPEnrollData; error?: string }> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator App',
  });
  if (error) return { error: error.message };
  return {
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  };
}

export async function verifyEnrollment(
  factorId: string,
  code: string
): Promise<{ error?: string }> {
  const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeErr) return { error: challengeErr.message };
  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });
  if (verifyErr) return { error: verifyErr.message };
  return {};
}

export async function unenroll2FA(factorId: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };
  return {};
}

export async function listVerifiedFactors(): Promise<{ factors: MFAFactor[]; error?: string }> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { factors: [], error: error.message };
  return {
    factors: (data.totp as MFAFactor[])
      .filter((f) => f.status === 'verified')
      .map((f) => ({ id: f.id, friendlyName: f.friendlyName, status: f.status })),
  };
}

export async function getAAL(): Promise<{
  current: string;
  next: string | null;
  error?: string;
}> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return { current: 'aal1', next: null, error: error.message };
  return { current: data.currentLevel ?? "aal1", next: data.nextLevel };
}

export async function challengeAndVerify(
  factorId: string,
  code: string
): Promise<{ error?: string }> {
  const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeErr) return { error: challengeErr.message };
  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });
  if (verifyErr) return { error: verifyErr.message };
  return {};
}
