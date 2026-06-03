import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';
import { useAccountStore } from '@/stores/account';
import { api, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { defaultVolumeFor, notionalUSD, pipValueFor, lotsFromPipValue, pipLabel, contractSize } from '@/lib/contracts';
import { usePrefsStore } from '@/stores/prefs';

interface Props {
  symbol: string;
  onFirstTrade?: () => void;
}

/**
 * Format a USD figure for in-line error copy. Falls back to the raw value if the
 * server sent something non-numeric.
 */
function fmtUsd(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return String(v ?? '?');
  return `$${n.toFixed(2)}`;
}

/**
 * R.5 — Generate a UUID v4-compatible request ID.
 * Works on web (crypto.randomUUID) and React Native (Math.random fallback).
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Map a thrown error from `api.openOrder` to a sentence the user can act on.
 * Server error codes (see `server/src/routes/orders.ts`):
 *   insufficient_margin => details.required, details.available
 *   no_quote            => details.symbol
 *   forbidden           => either the account isn't theirs, or auth lapsed
 *   invalid_input       => details.issues (zod), but we keep the surface short
 *   margin_reserve_failed / insert_failed / close_failed => server bug, generic copy
 *   http_<status>       => fallback when the body wasn't JSON
 * Anything else (including a non-ApiError, e.g. network failure) gets a friendly fallback.
 */
function describeOrderError(err: unknown, symbol: string): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'insufficient_margin': {
        const required = fmtUsd(err.details.required);
        const available = fmtUsd(err.details.available);
        return `Not enough margin (required: ${required}, available: ${available}).`;
      }
      case 'no_quote': {
        const sym = err.details.symbol ?? symbol;
        return `No live price for ${sym} right now. Wait a moment and try again.`;
      }
      case 'forbidden':
        return `You can't trade on this account. Try signing out and back in.`;
      case 'invalid_input':
        return `Order details look off. Check the volume, stop loss, and take profit.`;
      case 'unauthorized':
        return `Session expired. Please sign in again.`;
      case 'margin_reserve_failed':
      case 'insert_failed':
        return `Server couldn't open the trade. Try again in a moment.`;
      case 'invalid_trigger_price':
        return err.details?.message
          ? `Trigger price: ${err.details.message}.`
          : `Trigger price is invalid.`;
      case 'invalid_sl':
        return err.details?.message
          ? `Stop-loss invalid: ${err.details.message}.`
          : `Stop-loss is on the wrong side of the entry price.`;
      case 'invalid_tp':
        return err.details?.message
          ? `Take-profit invalid: ${err.details.message}.`
          : `Take-profit is on the wrong side of the entry price.`;
      case 'not_implemented':
        return `That order type isn't available yet.`;
      default:
        // Unknown code or http_<status> fallback — show the code so support can repro.
        return `Order failed (${err.code}).`;
    }
  }
  // Network errors (TypeError: Failed to fetch) or anything else.
  const msg = err instanceof Error ? err.message : String(err);
  return msg ? `Order failed: ${msg}` : 'Order failed.';
}

type OrderKind = 'market' | 'limit';

export function OrderEntry({ symbol, onFirstTrade }: Props) {
  const [volume, setVolume] = useState(() => defaultVolumeFor(symbol));
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [trailDistance, setTrailDistance] = useState('');
  const [orderKind, setOrderKind] = useState<OrderKind>('market');
  const [triggerPrice, setTriggerPrice] = useState('');
  // T.8 -- OCO (one-cancels-other) pair. When enabled (limit mode only),
  // we submit two pending orders sharing a freshly-minted ocoGroupId:
  //   primary: the limit at `triggerPrice`
  //   sibling: a stop on the same symbol/side/volume at `ocoStopPrice`
  // Either fill cancels the other (handled in ordersTrigger worker).
  const [ocoEnabled, setOcoEnabled] = useState(false);
  const [ocoStopPrice, setOcoStopPrice] = useState('');
  const [busy, setBusy] = useState<'buy' | 'sell' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // T.19 — spread-bet mode: separate display string for the $/pip field so
  // cursor position doesn't jump while the user is typing.
  const spreadBet = usePrefsStore((s) => s.spreadBet);
  const setSpreadBet = usePrefsStore((s) => s.setSpreadBet);
  const [sbRaw, setSbRaw] = useState<string>('');

  // 18.1 — order entry simplification.
  // `showDetails`: the position summary collapses to one short sentence
  //   (notional + margin) by default; tapping "Details" reveals the full
  //   lots × price · leverage · $/pip breakdown.
  // `showAdvanced`: the Trail Distance field (used by <5% of traders) is hidden
  //   behind an "Advanced" toggle so the default form stays uncluttered.
  const [showDetails, setShowDetails] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Track whether the user has manually typed a volume. If they haven't, we
  // auto-update the volume field whenever the symbol changes so the default
  // always matches the asset class (forex=0.10, crypto=0.01, stocks=1, gold=0.10).
  const userEditedVolume = useRef(false);

  useEffect(() => {
    if (!userEditedVolume.current) {
      setVolume(defaultVolumeFor(symbol));
    }
  }, [symbol]);

  // When spread-bet mode is switched on, populate sbRaw from the current lots.
  // When switched off, volume is already correct — no action needed.
  const prevSpreadBetRef = useRef(spreadBet);
  useEffect(() => {
    if (spreadBet && !prevSpreadBetRef.current) {
      const lots = Number(volume);
      const pv = pipValueFor(Number.isFinite(lots) && lots > 0 ? lots : 0, symbol);
      setSbRaw(pv > 0 ? pv.toFixed(2) : '');
    }
    prevSpreadBetRef.current = spreadBet;
  }, [spreadBet]);

  const handleVolumeChange = (s: string) => {
    userEditedVolume.current = true;
    setVolume(s);
  };

  const quote = usePriceStore((s) => s.quotes[symbol]);
  const account = useAccountStore((s) => s.account);
  const fetchAccount = useAccountStore((s) => s.fetch);

  const submit = async (side: 'buy' | 'sell') => {
    setLastError(null);
    if (!account) {
      setLastError('No account found. Try refreshing or signing out and back in.');
      return;
    }
    const vol = Number(volume);
    if (!Number.isFinite(vol) || vol <= 0) {
      setLastError('Volume must be a positive number.');
      return;
    }

    // T.1 — limit-order client-side validation. Server re-validates so this is
    // just an early friendly message.
    let triggerNum: number | undefined;
    if (orderKind === 'limit') {
      triggerNum = Number(triggerPrice);
      if (!Number.isFinite(triggerNum) || triggerNum <= 0) {
        setLastError('Trigger price must be a positive number.');
        return;
      }
      if (quote) {
        if (side === 'buy' && triggerNum >= quote.ask) {
          setLastError(`Buy-limit must be below current ask (${quote.ask}).`);
          return;
        }
        if (side === 'sell' && triggerNum <= quote.bid) {
          setLastError(`Sell-limit must be above current bid (${quote.bid}).`);
          return;
        }
      }
    }

    // T.7 — bracket order: client-side SL/TP direction check for market orders.
    // Server re-validates; this gives instant feedback before the network round-trip.
    if (orderKind === 'market' && quote) {
      const entryPrice = side === 'buy' ? quote.ask : quote.bid;
      if (stopLoss) {
        const slNum = Number(stopLoss);
        if (Number.isFinite(slNum)) {
          if (side === 'buy' && slNum >= entryPrice) {
            setLastError(`Stop-loss must be below the current ask (${entryPrice}).`);
            return;
          }
          if (side === 'sell' && slNum <= entryPrice) {
            setLastError(`Stop-loss must be above the current bid (${entryPrice}).`);
            return;
          }
        }
      }
      if (takeProfit) {
        const tpNum = Number(takeProfit);
        if (Number.isFinite(tpNum)) {
          if (side === 'buy' && tpNum <= entryPrice) {
            setLastError(`Take-profit must be above the current ask (${entryPrice}).`);
            return;
          }
          if (side === 'sell' && tpNum >= entryPrice) {
            setLastError(`Take-profit must be below the current bid (${entryPrice}).`);
            return;
          }
        }
      }
    }

    // T.8 — OCO pair validation (limit + sibling stop, same side).
    let ocoStopNum: number | undefined;
    let ocoGroupId: string | undefined;
    if (ocoEnabled && orderKind === 'limit') {
      ocoStopNum = Number(ocoStopPrice);
      if (!Number.isFinite(ocoStopNum) || ocoStopNum <= 0) {
        setLastError('OCO stop price must be a positive number.');
        return;
      }
      if (quote) {
        // Sibling is a stop entry: buy-stop must be ABOVE current ask,
        // sell-stop must be BELOW current bid. (Same rule the server applies.)
        if (side === 'buy' && ocoStopNum <= quote.ask) {
          setLastError(`OCO buy-stop must be above current ask (${quote.ask}).`);
          return;
        }
        if (side === 'sell' && ocoStopNum >= quote.bid) {
          setLastError(`OCO sell-stop must be below current bid (${quote.bid}).`);
          return;
        }
      }
      ocoGroupId = generateRequestId(); // fresh uuid for the pair
    }

    // R.5 — generate a fresh idempotency key for this tap so double-taps
    // (e.g. lag-induced second press) don't open two positions.
    const clientRequestId = generateRequestId();

    setBusy(side);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      await api.openOrder({
        accountId: account.id,
        symbol,
        side,
        volume: vol,
        stopLoss: stopLoss ? Number(stopLoss) : undefined,
        takeProfit: takeProfit ? Number(takeProfit) : undefined,
        reason: Platform.OS === 'web' ? 'web' : 'mobile',
        clientRequestId,
        orderType: orderKind,
        triggerPrice: triggerNum,
        trailDistance: (orderKind === 'market' && trailDistance) ? Number(trailDistance) : undefined,
        ocoGroupId,
      });
      // T.8 — place the sibling stop order with the same OCO group id.
      // If this throws we still leave the primary in place (the user can
      // cancel it from the Pending tab) but surface the error.
      if (ocoEnabled && orderKind === 'limit' && ocoGroupId && ocoStopNum != null) {
        await api.openOrder({
          accountId: account.id,
          symbol,
          side,
          volume: vol,
          stopLoss: stopLoss ? Number(stopLoss) : undefined,
          takeProfit: takeProfit ? Number(takeProfit) : undefined,
          reason: Platform.OS === 'web' ? 'web' : 'mobile',
          clientRequestId: generateRequestId(), // distinct idempotency key
          orderType: 'stop',
          triggerPrice: ocoStopNum,
          ocoGroupId,
        });
      }
      // Refresh account so balance/margin reflects new position
      fetchAccount();
      // First-trade confetti: count all trades for this account.
      // Fire the callback only when the count is exactly 1 (this was the very
      // first trade). Do it async/non-blocking so it never delays the UI.
      if (onFirstTrade && account) {
        void (async () => {
          try {
            const { count } = await supabase
              .from('trades')
              .select('*', { count: 'exact', head: true })
              .eq('account_id', account.id);
            if (count === 1) onFirstTrade();
          } catch {
            // confetti is best-effort; ignore failures silently
          }
        })();
      }
    } catch (err: any) {
      setLastError(describeOrderError(err, symbol));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...typography.heading, fontSize: 14, color: colors.textSecondary, letterSpacing: 1 }}>
          NEW ORDER · {symbol}
        </Text>
        {quote && (
          <Text style={{ ...typography.mono, fontSize: 11, color: colors.textMuted }}>
            bid {quote.bid} / ask {quote.ask}
          </Text>
        )}
      </View>

      {/* T.1 — Market / Limit selector */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.bgSurface,
          borderRadius: radius.pill,
          padding: 3,
          borderWidth: 1,
          borderColor: colors.border,
          alignSelf: 'flex-start',
        }}
      >
        <KindButton label="Market" testID="order-kind-market" active={orderKind === 'market'} onPress={() => setOrderKind('market')} />
        <KindButton label="Limit" testID="order-kind-limit" active={orderKind === 'limit'} onPress={() => setOrderKind('limit')} />
      </View>

      {/* 18.1 — single "Volume" field with an inline Lots / $ sizing toggle.
          The toggle flips the persisted spread-bet preference so the choice
          sticks across the app (Profile → Display shows the same setting). */}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...typography.body, fontSize: 11, color: colors.textMuted }}>Volume</Text>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.bgSurface,
              borderRadius: radius.pill,
              padding: 2,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <SizeButton label="Lots" active={!spreadBet} onPress={() => setSpreadBet(false)} />
            <SizeButton label={`$/${pipLabel(symbol)}`} active={spreadBet} onPress={() => setSpreadBet(true)} />
          </View>
        </View>
        {spreadBet ? (
          <Field
            label=""
            value={sbRaw}
            onChangeText={(text) => {
              setSbRaw(text);
              userEditedVolume.current = true;
              const pv = Number(text);
              if (Number.isFinite(pv) && pv > 0) {
                setVolume(lotsFromPipValue(pv, symbol).toFixed(6));
              }
            }}
            placeholder={`e.g. ${pipValueFor(Number(defaultVolumeFor(symbol)), symbol).toFixed(2)} per ${pipLabel(symbol)}`}
          />
        ) : (
          <Field label="" value={volume} onChangeText={handleVolumeChange} placeholder="e.g. 0.01" />
        )}
      </View>

      {/* T.11 / 18.1 — position summary.
          Default: one short sentence — notional + margin (+ "risking ~$X" when a
          stop-loss is set). Tap "Details" to reveal lots × price · leverage · $/pip. */}
      {(() => {
        const vol = Number(volume);
        const mid = quote ? (quote.bid + quote.ask) / 2 : 0;
        const refPrice =
          orderKind === 'limit' && Number(triggerPrice) > 0 ? Number(triggerPrice) : mid;
        if (!Number.isFinite(vol) || vol <= 0 || refPrice <= 0 || !account) return null;
        const notional = notionalUSD(vol, refPrice, symbol);
        const lev = account.leverage || 100;
        const margin = notional / lev;
        const fmtPrice = refPrice >= 100
          ? `$${refPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `$${refPrice.toFixed(5)}`;

        // 18.1 — "risking ~$X": estimate the loss if the stop-loss is hit.
        // Side-agnostic (buy/sell isn't chosen until the user taps): the loss
        // magnitude is |refPrice − SL| × volume × contractSize regardless of side.
        const slNum = Number(stopLoss);
        const risk =
          stopLoss && Number.isFinite(slNum) && slNum > 0
            ? Math.abs(refPrice - slNum) * vol * contractSize(symbol)
            : null;

        return (
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ ...typography.mono, color: colors.textSecondary, fontSize: 12, lineHeight: 16, flex: 1 }}>
                {`$${notional.toFixed(2)} notional · $${margin.toFixed(2)} margin`}
                {risk != null ? <Text style={{ color: colors.loss }}>{`  ·  risking ~$${risk.toFixed(2)}`}</Text> : null}
              </Text>
              <Pressable onPress={() => setShowDetails((v) => !v)} hitSlop={8}>
                <Text style={{ ...typography.body, color: colors.primary, fontSize: 11 }}>
                  {showDetails ? 'Hide' : 'Details'}
                </Text>
              </Pressable>
            </View>
            {showDetails && (
              <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>
                {spreadBet
                  ? `$${pipValueFor(vol, symbol).toFixed(2)}/${pipLabel(symbol)} · ${vol.toFixed(4)} lots × ${fmtPrice} · ${lev}× leverage`
                  : `${vol} lots × ${fmtPrice} · $${pipValueFor(vol, symbol).toFixed(2)}/${pipLabel(symbol)} · ${lev}× leverage`}
              </Text>
            )}
          </View>
        );
      })()}

      {orderKind === 'limit' && (
        <Field
          label="Trigger price"
          value={triggerPrice}
          onChangeText={setTriggerPrice}
          placeholder={quote ? String(quote.bid) : '—'}
          testID="limit-trigger-price"
        />
      )}

      {/* T.8 -- OCO pair toggle (limit mode only). Adds a sibling stop. */}
      {orderKind === 'limit' && (
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => setOcoEnabled((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: ocoEnabled ? colors.primary : colors.border,
                backgroundColor: ocoEnabled ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {ocoEnabled && (
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>OK</Text>
              )}
            </View>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
              Pair as OCO (adds a sibling stop; one cancels the other)
            </Text>
          </Pressable>
          {ocoEnabled && (
            <Field
              label="OCO stop trigger price"
              value={ocoStopPrice}
              onChangeText={setOcoStopPrice}
              placeholder={quote ? String(quote.ask) : '—'}
            />
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Stop Loss" value={stopLoss} onChangeText={setStopLoss} placeholder="—" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Take Profit" value={takeProfit} onChangeText={setTakeProfit} placeholder="—" />
        </View>
      </View>

      {/* T.4 / 18.1 -- Trailing stop distance (market orders only), tucked
          behind an "Advanced" toggle so the default form stays simple. */}
      {orderKind === 'market' && (
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => setShowAdvanced((v) => !v)}
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{ ...typography.body, color: colors.primary, fontSize: 12 }}>
              {showAdvanced ? 'Hide advanced' : 'Advanced'}
            </Text>
          </Pressable>
          {showAdvanced && (
            <Field
              label="Trail Distance (price units, optional)"
              value={trailDistance}
              onChangeText={setTrailDistance}
              placeholder="e.g. 500 for $500 trail"
            />
          )}
        </View>
      )}

      {lastError && (
        <Text style={{ ...typography.body, color: colors.loss, fontSize: 12 }}>{lastError}</Text>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <ActionButton
          testID="sell-button"
          label={
            orderKind === 'limit'
              ? `Sell-limit ${triggerPrice || '@'}`
              : `Sell ${quote ? quote.bid : ''}`
          }
          color={colors.loss}
          busy={busy === 'sell'}
          onPress={() => submit('sell')}
        />
        <ActionButton
          testID="buy-button"
          label={
            orderKind === 'limit'
              ? `Buy-limit ${triggerPrice || '@'}`
              : `Buy ${quote ? quote.ask : ''}`
          }
          color={colors.profit}
          busy={busy === 'buy'}
          onPress={() => submit('buy')}
        />
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  return (
    <View>
      {label ? (
        <Text style={{ ...typography.body, fontSize: 11, color: colors.textMuted, marginBottom: spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        style={{
          backgroundColor: colors.bgSurface,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.textPrimary,
          fontSize: 16,
          borderWidth: 1,
          borderColor: colors.border,
          fontFamily: 'JetBrainsMono',
        }}
      />
    </View>
  );
}

function KindButton({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
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

// 18.1 — compact Lots / $ sizing toggle shown inline above the Volume field (T.19-aware).
function SizeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.primary : 'transparent',
      }}
    >
      <Text
        style={{
          ...typography.bodyBold,
          color: active ? '#fff' : colors.textSecondary,
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  color,
  busy,
  onPress,
  testID,
}: {
  label: string;
  color: string;
  busy: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={busy}
      style={{
        flex: 1,
        backgroundColor: color,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: 'center',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ ...typography.heading, color: '#fff', fontSize: 14 }}>{label}</Text>
      )}
    </Pressable>
  );
}
