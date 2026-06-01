import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { X, ArrowUpRight, ArrowDownRight, Pencil, Check, Scissors, NotebookPen } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { TradeBookSkeleton } from '@/components/shared/SkeletonShimmer';
import { supabase } from '@/lib/supabase';
import { useAccountStore } from '@/stores/account';
import { usePriceStore } from '@/stores/prices';
import { api, saveTradeNote } from '@/lib/api';
import { calculatePnL, notionalUSD } from '@/lib/contracts';

interface Trade {
  id: number;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number | null;
  current_price: number | null;
  close_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
  status: 'open' | 'closed' | 'cancelled' | 'pending';
  reason: string;
  open_time: string;
  close_time: string | null;
  // T.1 — pending limit orders
  order_type?: 'market' | 'limit' | 'stop' | 'stop_limit';
  trigger_price?: number | null;
  // T.8 — OCO (one-cancels-other) group id; shown as a badge on pending rows.
  oco_group_id?: string | null;
  // T.14 — trade journal note
  notes?: string | null;
}

type Tab = 'open' | 'pending' | 'closed' | 'all';

export function TradeBook({ onWinClose }: { onWinClose?: (profit: number) => void } = {}) {
  const account = useAccountStore((s) => s.account);
  const fetchAccount = useAccountStore((s) => s.fetch);
  const quotes = usePriceStore((s) => s.quotes);
  const [tab, setTab] = useState<Tab>('open');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<number | null>(null);

  // T.5 — edit state for SL/TP modification
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSL, setEditSL] = useState('');
  const [editTP, setEditTP] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // T.6 — partial close state
  const [partialCloseId, setPartialCloseId] = useState<number | null>(null);
  const [partialVolumeStr, setPartialVolumeStr] = useState('');
  const [partialClosing, setPartialClosing] = useState(false);
  const [partialError, setPartialError] = useState<string | null>(null);

  // T.14 — trade journal note state
  const [noteId, setNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!account) {
      setLoading(false);
      return;
    }
    let q = supabase
      .from('trades')
      .select('*')
      .eq('account_id', account.id)
      .order('open_time', { ascending: false })
      .limit(200);

    if (tab === 'open') q = q.eq('status', 'open');
    else if (tab === 'pending') q = q.eq('status', 'pending');
    else if (tab === 'closed') q = q.eq('status', 'closed');

    const { data, error } = await q;
    if (!error && data) setTrades(data as Trade[]);
    setLoading(false);
  }, [account, tab]);

  useEffect(() => {
    setLoading(true);
    refresh();
    if (!account) return;

    const channel = supabase
      .channel(`trades:${account.id}:${tab}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades', filter: `account_id=eq.${account.id}` },
        () => refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account, tab, refresh]);

  const close = async (tradeId: number) => {
    setClosing(tradeId);
    // Snapshot the profit before the close so we can celebrate wins
    const trade = trades.find((t) => t.id === tradeId);
    let snapshotProfit = 0;
    if (trade && trade.open_price != null) {
      const q = quotes[trade.symbol];
      const livePrice = q
        ? trade.side === 'buy' ? q.bid : q.ask
        : trade.open_price;
      snapshotProfit = calculatePnL(trade.side, trade.volume, trade.open_price, livePrice, trade.symbol);
    }
    try {
      if (trade?.status === 'pending') {
        await api.cancelPendingOrder(tradeId);
      } else {
        await api.closeOrder(tradeId);
      }
      fetchAccount();
      if (snapshotProfit > 0 && onWinClose) {
        onWinClose(snapshotProfit);
      }
    } catch {}
    finally { setClosing(null); }
  };

  // T.5 — open the SL/TP edit form for a trade
  const startEdit = (trade: Trade) => {
    setEditingId(trade.id);
    setEditSL(trade.stop_loss != null ? String(trade.stop_loss) : '');
    setEditTP(trade.take_profit != null ? String(trade.take_profit) : '');
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSL('');
    setEditTP('');
    setEditError(null);
  };

  const saveEdit = async (tradeId: number) => {
    setSaving(true);
    setEditError(null);
    const sl = editSL.trim() === '' ? null : parseFloat(editSL);
    const tp = editTP.trim() === '' ? null : parseFloat(editTP);
    if ((editSL.trim() !== '' && isNaN(sl as number)) || (editTP.trim() !== '' && isNaN(tp as number))) {
      setEditError('Enter a valid number or leave blank to clear');
      setSaving(false);
      return;
    }
    try {
      await api.modifyOrder(tradeId, { stopLoss: sl, takeProfit: tp });
      await refresh();
      cancelEdit();
    } catch (err: any) {
      const code: string = err?.code ?? 'update_failed';
      if (code === 'invalid_sl') setEditError('Stop loss level is invalid for this position direction');
      else if (code === 'invalid_tp') setEditError('Take profit level is invalid for this position direction');
      else setEditError('Could not save — check that the levels make sense');
    } finally {
      setSaving(false);
    }
  };

  // T.6 — open the partial-close panel for a trade
  const startPartialClose = (trade: Trade) => {
    if (editingId === trade.id) cancelEdit();
    setPartialCloseId(trade.id);
    setPartialVolumeStr(String(trade.volume));
    setPartialError(null);
  };

  const cancelPartialClose = () => {
    setPartialCloseId(null);
    setPartialVolumeStr('');
    setPartialError(null);
  };

  const submitPartialClose = async (trade: Trade) => {
    const vol = parseFloat(partialVolumeStr);
    if (isNaN(vol) || vol <= 0) {
      setPartialError('Enter a positive volume');
      return;
    }
    if (vol > Number(trade.volume)) {
      setPartialError(`Max closable: ${trade.volume} lots`);
      return;
    }
    setPartialClosing(true);
    setPartialError(null);
    const isFullClose = vol >= Number(trade.volume);
    try {
      const result = await api.closeOrder(trade.id, isFullClose ? undefined : vol) as any;
      fetchAccount();
      cancelPartialClose();
      if (isFullClose && result?.profit > 0 && onWinClose) {
        onWinClose(result.profit);
      }
    } catch (err: any) {
      setPartialError(err?.message ?? 'Close failed — try again');
    } finally {
      setPartialClosing(false);
      await refresh();
    }
  };

  // T.14 — open/close note panel
  const startNote = (trade: Trade) => {
    setNoteId(trade.id);
    setNoteText(trade.notes ?? '');
  };

  const cancelNote = () => {
    setNoteId(null);
    setNoteText('');
  };

  const saveNote = async (tradeId: number) => {
    setNoteSaving(true);
    try {
      await saveTradeNote(tradeId, noteText);
      setTrades((prev) =>
        prev.map((t) => (t.id === tradeId ? { ...t, notes: noteText } : t)),
      );
      cancelNote();
    } catch {
      // non-fatal
    } finally {
      setNoteSaving(false);
    }
  };

  const stats = useMemo(() => {
    const wins = trades.filter((t) => t.status === 'closed' && t.profit > 0).length;
    const closed = trades.filter((t) => t.status === 'closed').length;
    const totalPnL = trades.reduce((sum, t) => {
      if (t.status === 'closed') return sum + Number(t.profit);
      // Pending orders have no fill price yet — no P&L to count.
      if (t.status === 'pending' || t.open_price == null) return sum;
      const q = quotes[t.symbol];
      const live = q ? (t.side === 'buy' ? q.bid : q.ask) : t.open_price;
      return sum + calculatePnL(t.side, t.volume, t.open_price, live, t.symbol);
    }, 0);
    return {
      total: trades.length,
      winRate: closed > 0 ? Math.round((wins / closed) * 100) : 0,
      totalPnL,
    };
  }, [trades, quotes]);

  if (!account) {
    return <TradeBookSkeleton />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {/* Tabs + Stats */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.bgSurface,
            borderRadius: radius.pill,
            padding: 3,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <TabButton label="Open" testID="tab-open" active={tab === 'open'} onPress={() => setTab('open')} />
          <TabButton label="Pending" testID="tab-pending" active={tab === 'pending'} onPress={() => setTab('pending')} />
          <TabButton label="Closed" testID="tab-closed" active={tab === 'closed'} onPress={() => setTab('closed')} />
          <TabButton label="All" testID="tab-all" active={tab === 'all'} onPress={() => setTab('all')} />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <Stat label="Trades" value={String(stats.total)} />
          {tab !== 'open' && <Stat label="Win" value={`${stats.winRate}%`} />}
          <Stat
            label={tab === 'open' ? 'Live P&L' : 'P&L'}
            value={`${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`}
            color={stats.totalPnL >= 0 ? colors.profit : colors.loss}
          />
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <TradeBookSkeleton />
      ) : trades.length === 0 ? (
        <View style={emptyContainerStyle}>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
            {tab === 'open'
              ? 'No open positions. Use Buy or Sell above to open one.'
              : tab === 'pending'
                ? 'No pending orders. Switch the New Order to Limit to queue one.'
                : tab === 'closed'
                  ? "You haven't closed any trades yet."
                  : 'No trades yet. Place your first trade above.'}
          </Text>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              padding: spacing.sm,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.bgSurface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <HeaderCell flex={1.4}>Symbol / Side</HeaderCell>
            <HeaderCell flex={1} align="right">Open → Now</HeaderCell>
            <HeaderCell flex={0.9} align="right">P&L</HeaderCell>
            <View style={{ width: 64 }} />
          </View>

          <ScrollView style={{ maxHeight: 480 }}>
            {trades.map((t) => (
              <TradeRow
                key={t.id}
                trade={t}
                quote={quotes[t.symbol]}
                onClose={t.status === 'open' || t.status === 'pending' ? close : undefined}
                closing={closing === t.id}
                leverage={account?.leverage}
                onEdit={t.status === 'open' ? () => startEdit(t) : undefined}
                isEditing={editingId === t.id}
                editSL={editSL}
                editTP={editTP}
                onEditSLChange={setEditSL}
                onEditTPChange={setEditTP}
                onSaveEdit={() => saveEdit(t.id)}
                onCancelEdit={cancelEdit}
                editSaving={saving && editingId === t.id}
                editError={editingId === t.id ? editError : null}
                onPartialClose={t.status === 'open' ? () => startPartialClose(t) : undefined}
                isPartialClosing={partialCloseId === t.id}
                partialVolumeStr={partialCloseId === t.id ? partialVolumeStr : ''}
                onPartialVolumeChange={setPartialVolumeStr}
                onSubmitPartialClose={() => submitPartialClose(t)}
                onCancelPartialClose={cancelPartialClose}
                partialClosingInFlight={partialClosing && partialCloseId === t.id}
                partialError={partialCloseId === t.id ? partialError : null}
                onNote={() => startNote(t)}
                isNoting={noteId === t.id}
                noteText={noteId === t.id ? noteText : ''}
                onNoteTextChange={setNoteText}
                onSaveNote={() => saveNote(t.id)}
                onCancelNote={cancelNote}
                noteSaving={noteSaving && noteId === t.id}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function TradeRow({
  trade,
  quote,
  onClose,
  closing,
  leverage,
  onEdit,
  isEditing,
  editSL,
  editTP,
  onEditSLChange,
  onEditTPChange,
  onSaveEdit,
  onCancelEdit,
  editSaving,
  editError,
  onPartialClose,
  isPartialClosing,
  partialVolumeStr,
  onPartialVolumeChange,
  onSubmitPartialClose,
  onCancelPartialClose,
  partialClosingInFlight,
  partialError,
  onNote,
  isNoting,
  noteText,
  onNoteTextChange,
  onSaveNote,
  onCancelNote,
  noteSaving,
}: {
  trade: Trade;
  quote?: { bid: number; ask: number };
  onClose?: (id: number) => void;
  closing: boolean;
  leverage?: number;
  onEdit?: () => void;
  isEditing: boolean;
  editSL: string;
  editTP: string;
  onEditSLChange: (v: string) => void;
  onEditTPChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  editSaving: boolean;
  editError: string | null;
  onPartialClose?: () => void;
  isPartialClosing: boolean;
  partialVolumeStr: string;
  onPartialVolumeChange: (v: string) => void;
  onSubmitPartialClose: () => void;
  onCancelPartialClose: () => void;
  partialClosingInFlight: boolean;
  partialError: string | null;
  onNote: () => void;
  isNoting: boolean;
  noteText: string;
  onNoteTextChange: (v: string) => void;
  onSaveNote: () => void;
  onCancelNote: () => void;
  noteSaving: boolean;
}) {
  const isOpen = trade.status === 'open';
  const isPending = trade.status === 'pending';
  const openPrice = trade.open_price ?? trade.trigger_price ?? 0;
  const livePrice = isOpen
    ? quote
      ? trade.side === 'buy' ? quote.bid : quote.ask
      : openPrice
    : trade.close_price ?? openPrice;

  // For pending orders show the gap to current price instead of P&L.
  const liveMid = quote ? (quote.bid + quote.ask) / 2 : null;
  const triggerGap =
    isPending && trade.trigger_price != null && liveMid != null
      ? trade.trigger_price - liveMid
      : null;

  const profit = isOpen
    ? calculatePnL(trade.side, trade.volume, openPrice, livePrice, trade.symbol)
    : Number(trade.profit);
  const positive = profit >= 0;
  const SideIcon = trade.side === 'buy' ? ArrowUpRight : ArrowDownRight;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {/* Main row */}
      <View
        style={{
          flexDirection: 'row',
          padding: spacing.md,
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.sm,
              backgroundColor: trade.side === 'buy' ? colors.profit + '22' : colors.loss + '22',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SideIcon color={trade.side === 'buy' ? colors.profit : colors.loss} size={14} />
          </View>
          <View>
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
              {trade.symbol}
            </Text>
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
              {trade.side.toUpperCase()}
              {isPending && trade.order_type ? ` ${trade.order_type.toUpperCase()}` : ''}
              {isPending && trade.oco_group_id ? ' · OCO' : ''}
              {' · '}{trade.volume} · {timeAgo(trade.open_time)}
            </Text>
            {/* T.11 — notional + leverage for open positions */}
            {isOpen && leverage && openPrice > 0 && (() => {
              const notional = notionalUSD(trade.volume, openPrice, trade.symbol);
              const margin = notional / leverage;
              return (
                <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 10 }}>
                  ${notional >= 1000
                    ? notional.toLocaleString('en-US', { maximumFractionDigits: 0 })
                    : notional.toFixed(2)
                  } notional · {leverage}× · ${margin.toFixed(2)} margin
                </Text>
              );
            })()}
            {/* T.14 — note preview */}
            {trade.notes && !isNoting && (
              <Text
                numberOfLines={1}
                style={{ ...typography.body, color: colors.primary, fontSize: 10, maxWidth: 160 }}
              >
                Note: {trade.notes.slice(0, 60)}{trade.notes.length > 60 ? '...' : ''}
              </Text>
            )}
            {/* T.5 — show current SL/TP when set and not in edit mode */}
            {isOpen && !isEditing && (trade.stop_loss != null || trade.take_profit != null) && (
              <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 10 }}>
                {trade.stop_loss != null ? `SL ${trade.stop_loss}` : ''}
                {trade.stop_loss != null && trade.take_profit != null ? '  ' : ''}
                {trade.take_profit != null ? `TP ${trade.take_profit}` : ''}
              </Text>
            )}
          </View>
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ ...typography.mono, color: colors.textPrimary, fontSize: 12 }}>
            {isPending ? trade.trigger_price ?? '—' : trade.open_price ?? '—'}
          </Text>
          <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 11 }}>
            → {isPending ? (liveMid != null ? liveMid.toFixed(5) : '—') : livePrice}
          </Text>
        </View>

        <View style={{ flex: 0.9, alignItems: 'flex-end' }}>
          {isPending ? (
            <>
              <Text style={{ ...typography.monoBold, color: colors.textSecondary, fontSize: 12 }}>
                {triggerGap != null
                  ? `${triggerGap > 0 ? '+' : ''}${triggerGap.toFixed(5)}`
                  : '—'}
              </Text>
              <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10 }}>
                AWAY
              </Text>
            </>
          ) : (
            <>
              <Text
                style={{
                  ...typography.monoBold,
                  color: positive ? colors.profit : colors.loss,
                  fontSize: 14,
                }}
              >
                {positive ? '+' : ''}{profit.toFixed(2)}
              </Text>
              {!isOpen && (
                <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10 }}>
                  {trade.status === 'cancelled' ? 'CANCELLED' : 'CLOSED'}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Action buttons: note + edit (open only) + scissors (partial close) + close/cancel */}
        <View style={{ width: onPartialClose ? 124 : 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          {/* T.14 — note button */}
          {!isEditing && !isPartialClosing && !isNoting && (
            <Pressable
              onPress={onNote}
              accessibilityLabel={trade.notes ? 'Edit note' : 'Add note'}
              // @ts-expect-error web-only title tooltip
              title={trade.notes ? 'Edit note' : 'Add note'}
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                backgroundColor: trade.notes ? colors.primary + '22' : colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: trade.notes ? colors.primary + '66' : colors.border,
              }}
            >
              <NotebookPen color={trade.notes ? colors.primary : colors.textSecondary} size={13} />
            </Pressable>
          )}
          {isNoting && (
            <Pressable
              onPress={onCancelNote}
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                backgroundColor: colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <X color={colors.textSecondary} size={13} />
            </Pressable>
          )}
          {onEdit && !isEditing && !isPartialClosing && (
            <Pressable
              onPress={onEdit}
              accessibilityLabel="Edit SL / TP"
              // @ts-expect-error web-only title tooltip
              title="Edit SL / TP"
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                backgroundColor: colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Pencil color={colors.textSecondary} size={13} />
            </Pressable>
          )}
          {isEditing && (
            <Pressable
              onPress={onCancelEdit}
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                backgroundColor: colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <X color={colors.textSecondary} size={13} />
            </Pressable>
          )}
          {/* T.6 — partial close button (scissors) for open positions */}
          {onPartialClose && !isEditing && !isPartialClosing && (
            <Pressable
              onPress={onPartialClose}
              accessibilityLabel="Partial close"
              // @ts-expect-error web-only title tooltip
              title="Partial close"
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                backgroundColor: colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Scissors color={colors.textSecondary} size={13} />
            </Pressable>
          )}
          {isPartialClosing && (
            <Pressable
              onPress={onCancelPartialClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                backgroundColor: colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <X color={colors.textSecondary} size={13} />
            </Pressable>
          )}
          {onClose ? (
            <Pressable
              onPress={() => onClose(trade.id)}
              disabled={closing}
              testID="close-trade-button"
              accessibilityLabel="Close trade"
              // @ts-expect-error web-only title tooltip
              title="Close trade"
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                backgroundColor: colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {closing ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <X color={colors.textSecondary} size={14} />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* T.6 — inline partial close form */}
      {isPartialClosing && (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.sm,
            backgroundColor: colors.bgSurface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginTop: spacing.sm }}>
            PARTIAL CLOSE · {trade.volume} LOTS OPEN
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>
                Volume to close
              </Text>
              <TextInput
                value={partialVolumeStr}
                onChangeText={onPartialVolumeChange}
                placeholder={String(trade.volume)}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.bgElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontFamily: 'JetBrainsMono',
                }}
              />
            </View>
          </View>
          {partialError && (
            <Text style={{ ...typography.body, color: colors.loss, fontSize: 11 }}>
              {partialError}
            </Text>
          )}
          <Pressable
            onPress={onSubmitPartialClose}
            disabled={partialClosingInFlight}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: colors.loss,
            }}
          >
            {partialClosingInFlight ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Scissors color="#fff" size={13} />
                <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 13 }}>
                  Close {partialVolumeStr || '?'} lots
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* T.5 — inline SL/TP edit form, shown below the main row when editing */}
      {isEditing && (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.sm,
            backgroundColor: colors.bgSurface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginTop: spacing.sm }}>
            EDIT SL / TP
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>
                Stop Loss
              </Text>
              <TextInput
                value={editSL}
                onChangeText={onEditSLChange}
                placeholder="e.g. 1.0850"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.bgElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontFamily: 'JetBrainsMono',
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>
                Take Profit
              </Text>
              <TextInput
                value={editTP}
                onChangeText={onEditTPChange}
                placeholder="e.g. 1.1200"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.bgElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontFamily: 'JetBrainsMono',
                }}
              />
            </View>
          </View>
          {editError && (
            <Text style={{ ...typography.body, color: colors.loss, fontSize: 11 }}>
              {editError}
            </Text>
          )}
          <Pressable
            onPress={onSaveEdit}
            disabled={editSaving}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: colors.primary,
            }}
          >
            {editSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Check color="#fff" size={14} />
                <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 13 }}>
                  Save SL / TP
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* T.14 — inline note panel */}
      {isNoting && (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.sm,
            backgroundColor: colors.bgSurface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginTop: spacing.sm }}>
            TRADE NOTE
          </Text>
          <TextInput
            value={noteText}
            onChangeText={onNoteTextChange}
            placeholder="e.g. RSI oversold reversal, strong support level..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: colors.bgElevated,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 8,
              color: colors.textPrimary,
              fontSize: 13,
              minHeight: 72,
              textAlignVertical: 'top',
            }}
          />
          <Pressable
            onPress={onSaveNote}
            disabled={noteSaving}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: colors.primary,
            }}
          >
            {noteSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Check color="#fff" size={14} />
                <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 13 }}>
                  Save Note
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function TabButton({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.primary : 'transparent',
      }}
    >
      <Text
        style={{
          ...typography.bodyBold,
          color: active ? '#fff' : colors.textSecondary,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 9, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ ...typography.monoBold, color: color ?? colors.textPrimary, fontSize: 13, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function HeaderCell({
  children,
  flex,
  align = 'left',
}: {
  children: React.ReactNode;
  flex: number;
  align?: 'left' | 'right';
}) {
  return (
    <View style={{ flex }}>
      <Text
        style={{
          ...typography.body,
          fontSize: 9,
          color: colors.textMuted,
          letterSpacing: 0.5,
          textAlign: align,
        }}
      >
        {String(children).toUpperCase()}
      </Text>
    </View>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const emptyContainerStyle = {
  padding: spacing.xl,
  backgroundColor: colors.bgElevated,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  alignItems: 'center' as const,
};
