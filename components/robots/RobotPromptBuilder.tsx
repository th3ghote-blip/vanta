/**
 * RobotPromptBuilder — Phase 3.1.
 *
 * Flow:
 *  1. User types a plain-English strategy.
 *  2. "Generate Robot" -> POST /api/robots/compile -> show config preview.
 *  3. "Save Robot" -> POST /api/robots/save -> prepend to robots store -> reset.
 */

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Sparkles, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { api, ApiError } from '@/lib/api';
import { useAccountStore } from '@/stores/account';
import { useRobotsStore, type Robot } from '@/stores/robots';

const EXAMPLES = [
  'Buy Amazon every NYSE open and sell at close',
  'Give me 3 stock picks every morning',
  'Buy EURUSD when it dips 0.5% in 5 minutes',
  'Send me an alert when Bitcoin moves 3%',
];

type Stage = 'idle' | 'compiling' | 'preview' | 'saving' | 'saved';

function describeCompileError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'unauthorized') return 'Please sign in again.';
    if (err.code === 'invalid_input') return 'Prompt is too short or too long.';
    if (err.code === 'compile_failed') return 'AI returned an unexpected response — try rephrasing.';
    if (err.code === 'ai_error') return 'AI service is unavailable. Try again in a moment.';
    return `Error: ${err.code}`;
  }
  return 'Network error — check your connection.';
}

function ScheduleLabel({ schedule }: { schedule: any }) {
  if (!schedule) return null;
  const { type, value } = schedule;
  if (type === 'event') return <>{String(value).replace(/_/g, ' ')}</>;
  if (type === 'interval') {
    const ms = Number(value);
    if (!isNaN(ms)) {
      if (ms >= 3_600_000) return <>every {Math.round(ms / 3_600_000)}h</>;
      if (ms >= 60_000) return <>every {Math.round(ms / 60_000)}m</>;
      return <>every {ms}ms</>;
    }
  }
  if (type === 'cron') return <>{String(value)}</>;
  return <>{String(value)}</>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13, marginTop: 1 }}>
        {children}
      </Text>
    </View>
  );
}

function ConfigPreview({ config }: { config: any }) {
  const [showRaw, setShowRaw] = useState(false);

  const kindBg = config.kind === 'tip' ? colors.warning + '22' : colors.primary + '22';
  const kindFg = config.kind === 'tip' ? colors.warning : colors.primary;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 16, flex: 1 }}>
          {config.name ?? 'Unnamed Robot'}
        </Text>
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: kindBg,
          }}
        >
          <Text style={{ ...typography.bodyBold, color: kindFg, fontSize: 10, letterSpacing: 1 }}>
            {String(config.kind ?? 'trade').toUpperCase()}
          </Text>
        </View>
      </View>

      {!!config.description && (
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
          {config.description}
        </Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 2 }}>
        {config.schedule && (
          <Field label="SCHEDULE">
            <ScheduleLabel schedule={config.schedule} />
          </Field>
        )}
        {Array.isArray(config.symbols) && config.symbols.length > 0 && (
          <Field label="SYMBOLS">{config.symbols.join(', ')}</Field>
        )}
        {config.side && config.kind !== 'tip' && (
          <Field label="SIDE">{config.side}</Field>
        )}
        {config.volume != null && config.kind !== 'tip' && (
          <Field label="VOLUME">{String(config.volume)}</Field>
        )}
      </View>

      <Pressable
        onPress={() => setShowRaw((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
      >
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12 }}>
          {showRaw ? 'Hide' : 'Show'} raw config
        </Text>
        {showRaw
          ? <ChevronUp color={colors.textMuted} size={12} />
          : <ChevronDown color={colors.textMuted} size={12} />}
      </Pressable>

      {showRaw && (
        <ScrollView
          style={{
            backgroundColor: colors.bgDeep,
            borderRadius: radius.sm,
            padding: spacing.sm,
            maxHeight: 160,
          }}
          nestedScrollEnabled
        >
          <Text style={{ ...typography.mono, color: colors.textSecondary, fontSize: 11 }}>
            {JSON.stringify(config, null, 2)}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

export function RobotPromptBuilder() {
  const { account } = useAccountStore();
  const { add: addRobot } = useRobotsStore();

  const [prompt, setPrompt] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const compile = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setStage('compiling');
    try {
      const res = await api.compileRobot(prompt.trim());
      setConfig(res.config);
      setStage('preview');
    } catch (err) {
      setError(describeCompileError(err));
      setStage('idle');
    }
  };

  const save = async () => {
    if (!config || !account) return;
    setError(null);
    setStage('saving');
    try {
      const res = await api.saveRobot({ accountId: account.id, prompt: prompt.trim(), config });
      const row = res.robot;
      addRobot({
        id: row.id,
        name: config.name ?? 'Unnamed Robot',
        description: config.description ?? '',
        status: 'draft',
        totalTrades: 0,
        winningTrades: 0,
        totalProfit: 0,
        prompt: prompt.trim(),
        config,
      } satisfies Robot);
      setStage('saved');
      setTimeout(() => {
        setStage('idle');
        setPrompt('');
        setConfig(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof ApiError ? `Save failed: ${err.code}` : 'Save failed — try again.');
      setStage('preview');
    }
  };

  const reset = () => {
    setStage('idle');
    setConfig(null);
    setError(null);
  };

  const isBusy = stage === 'compiling' || stage === 'saving';

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor:
          stage === 'preview' || stage === 'saving' || stage === 'saved'
            ? colors.profit
            : colors.primary,
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Sparkles color={colors.primary} size={16} />
        <Text style={{ ...typography.bodyBold, color: colors.primary, fontSize: 12, letterSpacing: 1 }}>
          BUILD A ROBOT
        </Text>
      </View>

      {stage === 'saved' ? (
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
          <CheckCircle2 color={colors.profit} size={32} />
          <Text style={{ ...typography.bodyBold, color: colors.profit, fontSize: 15 }}>Robot saved!</Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
            Find it in Your Robots below.
          </Text>
        </View>
      ) : (
        <>
          <TextInput
            value={prompt}
            onChangeText={(v) => {
              setPrompt(v);
              if (stage === 'preview') reset();
            }}
            placeholder="Describe what you want your robot to do..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            editable={!isBusy}
            style={{
              backgroundColor: colors.bgSurface,
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.textPrimary,
              fontSize: 15,
              minHeight: 80,
              textAlignVertical: 'top',
              borderWidth: 1,
              borderColor: colors.border,
              opacity: isBusy ? 0.6 : 1,
            }}
          />

          {stage === 'idle' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {EXAMPLES.map((ex) => (
                <Pressable
                  key={ex}
                  onPress={() => setPrompt(ex)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: colors.bgSurface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {(stage === 'preview' || stage === 'saving') && config != null && (
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.profit + '44',
                padding: spacing.md,
              }}
            >
              <ConfigPreview config={config} />
            </View>
          )}

          {!!error && (
            <Text style={{ ...typography.body, color: colors.loss, fontSize: 13 }}>{error}</Text>
          )}

          {stage === 'idle' || stage === 'compiling' ? (
            <Pressable
              onPress={compile}
              disabled={isBusy || !prompt.trim()}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                alignItems: 'center',
                opacity: isBusy || !prompt.trim() ? 0.5 : 1,
              }}
            >
              {stage === 'compiling' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ ...typography.heading, color: '#fff', fontSize: 15 }}>Generate Robot</Text>
              )}
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={reset}
                disabled={stage === 'saving'}
                style={{
                  flex: 1,
                  backgroundColor: colors.bgSurface,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: stage === 'saving' ? 0.5 : 1,
                }}
              >
                <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 14 }}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={stage === 'saving' || !account}
                style={{
                  flex: 2,
                  backgroundColor: colors.profit,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  opacity: stage === 'saving' || !account ? 0.5 : 1,
                }}
              >
                {stage === 'saving' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ ...typography.heading, color: '#fff', fontSize: 15 }}>Save Robot</Text>
                )}
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}
