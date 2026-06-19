import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Send, Users, User, CheckCircle2, AlertTriangle } from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

type Audience = 'all' | 'account';

export default function NotifyScreen() {
  const [audience, setAudience] = useState<Audience>('account');
  const [login, setLogin] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ audience: Audience; recipients: number } | null>(null);

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience === 'all' || login.trim().length > 0) &&
    !sending;

  const send = async () => {
    setError(null);
    setResult(null);
    setSending(true);
    try {
      const params: {
        title: string;
        body: string;
        audience: Audience;
        login?: number;
      } = { title: title.trim(), body: body.trim(), audience };
      if (audience === 'account') {
        const n = Number(login.trim());
        if (!Number.isFinite(n) || n <= 0) {
          setError('Enter a valid account login number.');
          setSending(false);
          return;
        }
        params.login = n;
      }
      const res = await api.adminNotify(params);
      setResult({ audience: res.audience, recipients: res.recipients });
      // Clear the message body on success; keep target so the operator can send a follow-up.
      setTitle('');
      setBody('');
    } catch (e: any) {
      const code = e?.code ?? e?.message ?? 'send_failed';
      if (code === 'account_not_found') setError('No account found with that login.');
      else if (code === 'missing_target') setError('Provide an account login or choose All clients.');
      else if (code === 'invalid_input') setError('Title and message are required.');
      else setError(typeof code === 'string' ? code : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={20} color={colors.textSecondary} />
        </Pressable>
        <Send size={18} color={colors.profit} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Broadcast / Notify
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64, gap: spacing.md }}>
        {/* Audience toggle */}
        <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
          Audience
        </Text>
        <View style={{
          flexDirection: 'row', gap: spacing.xs,
          backgroundColor: colors.bgSurface, borderRadius: radius.md, padding: 4,
        }}>
          {([
            { key: 'account' as Audience, label: 'Single account', icon: User },
            { key: 'all' as Audience, label: 'All clients', icon: Users },
          ]).map(({ key, label, icon: Icon }) => {
            const active = audience === key;
            return (
              <Pressable
                key={key}
                onPress={() => { setAudience(key); setResult(null); setError(null); }}
                style={{
                  flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
                  paddingVertical: spacing.sm, borderRadius: radius.sm,
                  backgroundColor: active ? colors.bgElevated : 'transparent',
                }}
              >
                <Icon size={14} color={active ? colors.primary : colors.textSecondary} />
                <Text style={{ ...typography.bodyBold, fontSize: 12, color: active ? colors.primary : colors.textSecondary }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Account login (single mode only) */}
        {audience === 'account' && (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>Account login</Text>
            <TextInput
              value={login}
              onChangeText={setLogin}
              placeholder="e.g. 80000035"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={{
                ...typography.mono, color: colors.textPrimary, fontSize: 14,
                backgroundColor: colors.bgElevated, borderRadius: radius.md,
                borderWidth: 1, borderColor: colors.border,
                paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
              }}
            />
          </View>
        )}

        {audience === 'all' && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: (colors.warning ?? colors.primary) + '22',
            borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning ?? colors.primary,
            padding: spacing.sm,
          }}>
            <AlertTriangle size={16} color={colors.warning ?? colors.primary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, flex: 1 }}>
              This message will be delivered to every client account.
            </Text>
          </View>
        )}

        {/* Title */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Notification title"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
            style={{
              ...typography.body, color: colors.textPrimary, fontSize: 14,
              backgroundColor: colors.bgElevated, borderRadius: radius.md,
              borderWidth: 1, borderColor: colors.border,
              paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
            }}
          />
        </View>

        {/* Body */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>Message</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write your message…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
            style={{
              ...typography.body, color: colors.textPrimary, fontSize: 14,
              backgroundColor: colors.bgElevated, borderRadius: radius.md,
              borderWidth: 1, borderColor: colors.border,
              paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
              minHeight: 120, textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Result / error */}
        {result && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: colors.profit + '22', borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.profit, padding: spacing.sm,
          }}>
            <CheckCircle2 size={16} color={colors.profit} />
            <Text style={{ ...typography.body, color: colors.profit, fontSize: 13, flex: 1 }}>
              Sent to {result.recipients} {result.recipients === 1 ? 'client' : 'clients'}.
            </Text>
          </View>
        )}
        {error && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: colors.loss + '22', borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.loss, padding: spacing.sm,
          }}>
            <AlertTriangle size={16} color={colors.loss} />
            <Text style={{ ...typography.body, color: colors.loss, fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* Send */}
        <Pressable
          onPress={send}
          disabled={!canSend}
          style={{
            flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm,
            backgroundColor: canSend ? colors.primary : colors.bgElevated,
            borderRadius: radius.md, paddingVertical: spacing.md,
            opacity: canSend ? 1 : 0.6, marginTop: spacing.sm,
          }}
        >
          {sending ? (
            <ActivityIndicator color={colors.bgDeep} />
          ) : (
            <>
              <Send size={16} color={canSend ? colors.bgDeep : colors.textSecondary} />
              <Text style={{ ...typography.bodyBold, color: canSend ? colors.bgDeep : colors.textSecondary }}>
                {audience === 'all' ? 'Broadcast to all' : 'Send notification'}
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
