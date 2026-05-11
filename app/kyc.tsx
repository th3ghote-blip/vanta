/**
 * app/kyc.tsx — Phase 5.1
 *
 * Camera-based KYC document upload.
 * Four steps: ID front, ID back, selfie, proof of address.
 * Each tap opens the camera (or photo library on denial).
 * After all four docs are uploaded the user can submit for review.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ShieldCheck,
  Camera,
  FileImage,
  CheckCircle,
  Clock,
  XCircle,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import {
  getOrCreateSubmission,
  getSubmissionDocs,
  uploadDocument,
  submitKyc,
  type DocType,
  type KycSubmission,
  type KycDocRecord,
} from '@/lib/kyc';
import { colors, radius, spacing, typography } from '@/lib/theme';

// ─── Step definitions ────────────────────────────────────────────────────────

interface Step {
  key: DocType;
  label: string;
  hint: string;
  useSelfieCamera: boolean;
}

const STEPS: Step[] = [
  { key: 'id_front',         label: 'Government ID — Front', hint: 'Passport, national ID, or driver\'s licence', useSelfieCamera: false },
  { key: 'id_back',          label: 'Government ID — Back',  hint: 'Required for ID cards and licences',          useSelfieCamera: false },
  { key: 'selfie',           label: 'Selfie with ID',        hint: 'Hold your ID next to your face',             useSelfieCamera: true  },
  { key: 'proof_of_address', label: 'Proof of Address',      hint: 'Bank statement or utility bill (< 3 months)', useSelfieCamera: false },
];

// ─── Component ───────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'upload' | 'submitted' | 'approved' | 'rejected';

export default function KycScreen() {
  const router = useRouter();

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [submission, setSubmission] = useState<KycSubmission | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Set<DocType>>(new Set());
  const [uploadingStep, setUploadingStep] = useState<DocType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // ── Initialise ─────────────────────────────────────────────────────────────

  const init = useCallback(async () => {
    setInitError(null);
    setScreenState('loading');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }

      const sub = await getOrCreateSubmission(user.id);
      setSubmission(sub);

      if (sub.status === 'approved') { setScreenState('approved'); return; }
      if (sub.status === 'pending')  { setScreenState('submitted'); return; }
      if (sub.status === 'rejected') {
        // Let the user re-upload — keep upload screen but show rejection banner
        const docs = await getSubmissionDocs(sub.id);
        setUploadedDocs(new Set(docs.map((d) => d.doc_type as DocType)));
        setScreenState('rejected');
        return;
      }

      // not_started or pending — load already-uploaded docs
      const docs = await getSubmissionDocs(sub.id);
      setUploadedDocs(new Set(docs.map((d) => d.doc_type as DocType)));
      setScreenState('upload');
    } catch (e: any) {
      setInitError(e.message ?? 'Something went wrong. Please try again.');
      setScreenState('upload');
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  // ── Camera / library picker ─────────────────────────────────────────────────

  const pickImage = async (step: Step): Promise<string | null> => {
    // Try camera first
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (camPerm.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.82,
        allowsEditing: false,
        cameraType: step.useSelfieCamera
          ? ImagePicker.CameraType.front
          : ImagePicker.CameraType.back,
      });
      if (!result.canceled && result.assets.length > 0) {
        return result.assets[0].uri;
      }
      return null; // user cancelled
    }

    // Camera denied — fall back to photo library
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libPerm.granted) {
      Alert.alert(
        'Permission required',
        'Please grant camera or photo library access in Settings to upload documents.',
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.82,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  };

  // ── Upload handler ──────────────────────────────────────────────────────────

  const handleStepPress = async (step: Step) => {
    if (!submission) return;
    if (uploadingStep) return; // another upload in flight

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const uri = await pickImage(step);
    if (!uri) return;

    setUploadingStep(step.key);
    try {
      await uploadDocument(user.id, submission.id, step.key, uri);
      setUploadedDocs((prev) => new Set([...prev, step.key]));
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Please check your connection and try again.');
    } finally {
      setUploadingStep(null);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!submission) return;
    setSubmitting(true);
    try {
      await submitKyc(submission.id);
      setScreenState('submitted');
    } catch (e: any) {
      Alert.alert('Submission failed', e.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const allUploaded = STEPS.every((s) => uploadedDocs.has(s.key));

  // ── Render helpers ──────────────────────────────────────────────────────────

  if (screenState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (screenState === 'approved') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <CheckCircle color={colors.profit} size={56} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }}>
          Identity Verified
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
          Your account is fully verified. You can deposit and withdraw without restrictions.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.xl, padding: spacing.md }}>
          <Text style={{ ...typography.bodyBold, color: colors.primary }}>Back to Profile</Text>
        </Pressable>
      </View>
    );
  }

  if (screenState === 'submitted') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <Clock color={colors.primary} size={56} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }}>
          Under Review
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
          We're reviewing your documents. This usually takes 1–2 business days. We'll notify you when it's done.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.xl, padding: spacing.md }}>
          <Text style={{ ...typography.bodyBold, color: colors.primary }}>Back to Profile</Text>
        </Pressable>
      </View>
    );
  }

  // ── Upload screen (also used for 'rejected' with banner) ───────────────────

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgDeep }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
    >
      {/* Back button */}
      <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md }}>
        <ChevronLeft color={colors.primary} size={20} />
        <Text style={{ ...typography.body, color: colors.primary }}>Back</Text>
      </Pressable>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <ShieldCheck color={colors.primary} size={24} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 22 }}>
          Verify Your Identity
        </Text>
      </View>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
        Required by regulation before withdrawals. Takes about 2 minutes.
      </Text>

      {/* Rejection banner */}
      {screenState === 'rejected' && submission?.rejection_reason && (
        <View style={{
          backgroundColor: `${colors.loss}22`,
          borderWidth: 1,
          borderColor: colors.loss,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          flexDirection: 'row',
          gap: spacing.sm,
        }}>
          <XCircle color={colors.loss} size={18} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyBold, color: colors.loss, fontSize: 13 }}>
              Verification rejected
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {submission.rejection_reason}
            </Text>
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              Please re-upload the flagged documents and resubmit.
            </Text>
          </View>
        </View>
      )}

      {/* Init error */}
      {initError && (
        <Pressable onPress={init} style={{
          backgroundColor: `${colors.loss}22`,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}>
          <RefreshCw color={colors.loss} size={16} />
          <Text style={{ ...typography.body, color: colors.loss, fontSize: 13 }}>
            {initError} — Tap to retry.
          </Text>
        </Pressable>
      )}

      {/* Progress indicator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{
          flex: 1, height: 4, borderRadius: 2,
          backgroundColor: colors.border, overflow: 'hidden',
        }}>
          <View style={{
            height: '100%',
            width: `${(uploadedDocs.size / STEPS.length) * 100}%`,
            backgroundColor: colors.primary,
            borderRadius: 2,
          }} />
        </View>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12 }}>
          {uploadedDocs.size}/{STEPS.length}
        </Text>
      </View>

      {/* Step cards */}
      <View style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginBottom: spacing.xl,
      }}>
        {STEPS.map((step, i) => {
          const done = uploadedDocs.has(step.key);
          const uploading = uploadingStep === step.key;
          return (
            <Pressable
              key={step.key}
              onPress={() => handleStepPress(step)}
              disabled={uploading || submitting}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
                opacity: (uploading || (uploadingStep && !uploading)) ? 0.6 : pressed ? 0.7 : 1,
              })}
            >
              {/* Icon / spinner */}
              <View style={{
                width: 44,
                height: 44,
                borderRadius: radius.sm,
                backgroundColor: done ? `${colors.profit}22` : colors.bgSurface,
                borderWidth: 1,
                borderColor: done ? colors.profit : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {uploading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : done ? (
                  <CheckCircle color={colors.profit} size={22} />
                ) : step.useSelfieCamera ? (
                  <Camera color={colors.textSecondary} size={20} />
                ) : (
                  <FileImage color={colors.textSecondary} size={20} />
                )}
              </View>

              {/* Labels */}
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
                  {step.label}
                </Text>
                <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
                  {uploading ? 'Uploading…' : done ? 'Uploaded — tap to replace' : step.hint}
                </Text>
              </View>

              {/* Status badge */}
              {done && !uploading && (
                <View style={{
                  backgroundColor: `${colors.profit}22`,
                  borderRadius: radius.xs ?? 4,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}>
                  <Text style={{ ...typography.body, color: colors.profit, fontSize: 11, fontWeight: '600' }}>
                    Done
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Submit button */}
      <Pressable
        onPress={handleSubmit}
        disabled={!allUploaded || submitting}
        style={({ pressed }) => ({
          backgroundColor: allUploaded ? colors.primary : colors.bgSurface,
          borderRadius: radius.md,
          padding: spacing.md,
          alignItems: 'center',
          opacity: submitting ? 0.7 : pressed ? 0.85 : 1,
        })}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={{
            ...typography.bodyBold,
            color: allUploaded ? '#fff' : colors.textMuted,
            fontSize: 15,
          }}>
            {allUploaded ? 'Submit for Review' : `Upload all ${STEPS.length} documents to continue`}
          </Text>
        )}
      </Pressable>

      <Text style={{
        ...typography.body,
        color: colors.textMuted,
        fontSize: 11,
        marginTop: spacing.lg,
        textAlign: 'center',
      }}>
        Documents are encrypted and used only for compliance verification.
      </Text>
    </ScrollView>
  );
}
