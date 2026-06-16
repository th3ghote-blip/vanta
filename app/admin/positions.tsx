import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  RefreshCw,
  X,
  Edit3,
} from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 2): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(decimals);
}

function fmtVol(n: number): string {
  if (Math.abs(n) < 0.001) return n.toFixed(4);
  if (Math.abs(n) < 1) return n.toFixed(3);
  return n.toFixed(2);
}

function pnlColor(v: number) {
  return v >= 0 ? colors.profit : colors.loss;
}

function ageOf(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  return Math.floor(hrs / 24) + 'd';
}

// ── types ─────────────────────────────────────────────────────────────────────

type PositionsData = Awaited<ReturnType<typeof api.adminGetPositions>>;
type Position = PositionsData['positions'][0];
type SortKey = 'pnl' | 'symbol' | 'age';

// ── sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: PositionsData['summary'] }) {
  const net = summary.net_notional;
  return (
    <View style={{
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Open trades</Text>
          <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: 16 }}>{summary.total_open}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Total notional</Text>
          <Text style={{ ...typography.monoBold, color: colors.info, fontSize: 16 }}>{fmt$(summary.total_notional, 0)}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Buy / Sell</Text>
          <Text style={{ ...typography.mono, color: colors.textPrimary, fontSize: 13 }}>
            <Text style={{ color: colors.profit }}>{fmt$(summary.buy_notional, 0)}</Text>
            {'  '}
            <Text style={{ color: colors.loss }}>{fmt$(summary.sell_notional, 0)}</Text>
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 90 }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Net exposure</Text>
          <Text style={{ ...typography.monoBold, color: net >= 0 ? colors.profit : colors.loss, fontSize: 16 }}>
            {net >= 0 ? 'LONG ' : 'SHORT '}{fmt$(Math.abs(net), 0)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PositionRow({
  pos,
  busy,
  onClose,
  onModify,
}: {
  pos: Position;
  busy: boolean;
  onClose: (pos: Position) => void;
  onModify: (pos: Position) => void;
}) {
  return (
    <View style={{
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
            {pos.symbol}{' '}
            <Text style={{ color: pos.side === 'buy' ? colors.profit : colors.loss }}>
              {pos.side.toUpperCase()}
            </Text>
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
            {pos.login != null ? '#' + pos.login : 'acct ' + pos.account_id.slice(0, 6)} · {fmtVol(pos.volume)} lots
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
            {fmt$(pos.open_price, 4)} → {fmt$(pos.current_price, 4)} · margin {fmt$(pos.margin)} · {ageOf(pos.open_time)}
          </Text>
        </View>
        <Text style={{ ...typography.monoBold, color: pnlColor(pos.pnl), fontSize: 15 }}>
          {pos.pnl >= 0 ? '+' : ''}{fmt$(pos.pnl)}
        </Text>
      </View>

      {/* 21.4 — per-row manager actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs }}>
        {busy ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <>
            <Pressable
              onPress={() => onModify(pos)}
              hitSlop={8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingVertical: 4, paddingHorizontal: spacing.sm,
                borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
              }}
            >
              <Edit3 size={13} color={colors.textSecondary} />
              <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 12 }}>SL/TP</Text>
            </Pressable>
            <Pressable
              onPress={() => onClose(pos)}
              hitSlop={8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingVertical: 4, paddingHorizontal: spacing.sm,
                borderRadius: radius.sm, borderWidth: 1, borderColor: colors.loss,
              }}
            >
              <X size={13} color={colors.loss} />
              <Text style={{ ...typography.bodyBold, color: colors.loss, fontSize: 12 }}>Force close</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function PositionsScreen() {
  const [data, setData] = useState<PositionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('pnl');
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [modifyPos, setModifyPos] = useState<Position | null>(null);
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [modifyErr, setModifyErr] = useState<string | null>(null);
  const [savingModify, setSavingModify] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const result = await api.adminGetPositions();
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load positions');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefresh(true);
    load(true);
  }, [load]);

  // 21.4 — force-close a client's position. Confirm first (irreversible).
  const confirmClose = useCallback((pos: Position) => {
    const who = pos.login != null ? '#' + pos.login : pos.account_id.slice(0, 6);
    const doClose = async () => {
      setActioningId(pos.id);
      try {
        await api.adminClosePosition(pos.id);
        await load(true);
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to close position';
        if (typeof window !== 'undefined' && (window as any).alert) (window as any).alert(msg);
        else Alert.alert('Force close failed', msg);
      } finally {
        setActioningId(null);
      }
    };
    // web has no native Alert buttons — fall back to window.confirm
    if (typeof window !== 'undefined' && (window as any).confirm) {
      if ((window as any).confirm(`Force-close ${pos.symbol} ${pos.side.toUpperCase()} ${fmtVol(pos.volume)} lots on ${who} at the live mid? This settles P&L and releases margin.`)) {
        void doClose();
      }
      return;
    }
    Alert.alert(
      'Force close position',
      `Close ${pos.symbol} ${pos.side.toUpperCase()} ${fmtVol(pos.volume)} lots on ${who} at the live mid? This settles P&L and releases margin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Force close', style: 'destructive', onPress: () => { void doClose(); } },
      ],
    );
  }, [load]);

  const openModify = useCallback((pos: Position) => {
    setModifyErr(null);
    setSlInput(pos.stop_loss != null ? String(pos.stop_loss) : '');
    setTpInput(pos.take_profit != null ? String(pos.take_profit) : '');
    setModifyPos(pos);
  }, []);

  const submitModify = useCallback(async () => {
    if (!modifyPos) return;
    const sl = slInput.trim();
    const tp = tpInput.trim();
    const fields: { stopLoss?: number | null; takeProfit?: number | null } = {};
    // empty string clears the level (null); a value sets it; invalid number aborts.
    if (sl === '') fields.stopLoss = null;
    else {
      const n = Number(sl);
      if (!isFinite(n)) { setModifyErr('Stop loss must be a number'); return; }
      fields.stopLoss = n;
    }
    if (tp === '') fields.takeProfit = null;
    else {
      const n = Number(tp);
      if (!isFinite(n)) { setModifyErr('Take profit must be a number'); return; }
      fields.takeProfit = n;
    }
    setSavingModify(true);
    setModifyErr(null);
    try {
      await api.adminModifyPosition(modifyPos.id, fields);
      setModifyPos(null);
      await load(true);
    } catch (e: any) {
      setModifyErr(e?.message ?? 'Failed to modify position');
    } finally {
      setSavingModify(false);
    }
  }, [modifyPos, slInput, tpInput, load]);

  const sorted = useMemo(() => {
    const rows = [...(data?.positions ?? [])];
    if (sortKey === 'symbol') {
      rows.sort((a, b) => a.symbol.localeCompare(b.symbol) || Math.abs(b.pnl) - Math.abs(a.pnl));
    } else if (sortKey === 'age') {
      rows.sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());
    } else {
      rows.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
    }
    return rows;
  }, [data, sortKey]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: 56,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={20} color={colors.textSecondary} />
        </Pressable>
        <Activity size={18} color={colors.primary} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Live Positions
        </Text>
        <Pressable onPress={onRefresh} hitSlop={12}>
          <RefreshCw size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Body */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <AlertTriangle size={32} color={colors.loss} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
            {error}
          </Text>
          <Pressable
            onPress={() => load()}
            style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.bgElevated, borderRadius: radius.md }}
          >
            <Text style={{ ...typography.bodyBold, color: colors.primary }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {data?.generated_at && (
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginBottom: spacing.md, textAlign: 'right' }}>
              Snapshot: {new Date(data.generated_at).toLocaleTimeString()}
            </Text>
          )}

          {data && <SummaryCard summary={data.summary} />}

          {/* Sort switcher */}
          <View style={{
            flexDirection: 'row', gap: spacing.xs,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.md,
            padding: 4,
            marginBottom: spacing.md,
          }}>
            {(['pnl', 'symbol', 'age'] as SortKey[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setSortKey(key)}
                style={{
                  flex: 1, paddingVertical: spacing.xs,
                  alignItems: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: sortKey === key ? colors.bgElevated : 'transparent',
                }}
              >
                <Text style={{
                  ...typography.bodyBold,
                  fontSize: 13,
                  color: sortKey === key ? colors.primary : colors.textSecondary,
                }}>
                  {key === 'pnl' ? 'P&L' : key === 'symbol' ? 'Symbol' : 'Age'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
          }}>
            {sorted.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.textMuted, padding: spacing.md, textAlign: 'center' }}>
                No open positions across any account.
              </Text>
            ) : (
              sorted.map((pos) => (
                <PositionRow
                  key={pos.id}
                  pos={pos}
                  busy={actioningId === pos.id}
                  onClose={confirmClose}
                  onModify={openModify}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* 21.4 — Modify SL/TP modal */}
      <Modal
        visible={modifyPos !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModifyPos(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 16, flex: 1 }}>
                Modify SL / TP
              </Text>
              <Pressable onPress={() => setModifyPos(null)} hitSlop={10}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {modifyPos && (
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md }}>
                {modifyPos.symbol} {modifyPos.side.toUpperCase()} ·{' '}
                {modifyPos.login != null ? '#' + modifyPos.login : modifyPos.account_id.slice(0, 6)} ·
                {' '}current {fmt$(modifyPos.current_price, 4)}
              </Text>
            )}

            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
              Stop loss (blank to clear)
            </Text>
            <TextInput
              value={slInput}
              onChangeText={setSlInput}
              placeholder="—"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{
                ...typography.mono,
                color: colors.textPrimary,
                backgroundColor: colors.bgSurface,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                marginBottom: spacing.md,
              }}
            />

            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
              Take profit (blank to clear)
            </Text>
            <TextInput
              value={tpInput}
              onChangeText={setTpInput}
              placeholder="—"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{
                ...typography.mono,
                color: colors.textPrimary,
                backgroundColor: colors.bgSurface,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                marginBottom: spacing.md,
              }}
            />

            {modifyErr && (
              <Text style={{ ...typography.body, color: colors.loss, fontSize: 12, marginBottom: spacing.md }}>
                {modifyErr}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => setModifyPos(null)}
                style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ ...typography.bodyBold, color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => { void submitModify(); }}
                disabled={savingModify}
                style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.primary, opacity: savingModify ? 0.6 : 1 }}
              >
                {savingModify
                  ? <ActivityIndicator color={colors.bgDeep} size="small" />
                  : <Text style={{ ...typography.bodyBold, color: colors.bgDeep }}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
