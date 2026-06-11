/**
 * TradeShareCard — 18.11
 *
 * The styled brag-card captured to PNG by lib/shareCard.ts. Rendered
 * off-screen (absolute, left: -9999) only while a share is in flight.
 * Fixed 600×315 (Twitter 1.91:1 card ratio).
 */
import { forwardRef } from 'react';
import { View, Text } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';

export interface ShareTrade {
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number | null;
  close_price: number | null;
  profit: number;
  open_time: string;
  close_time: string | null;
}

export const CARD_W = 600;
export const CARD_H = 315;

function fmtPrice(p: number | null): string {
  if (p == null) return '—';
  return p >= 100
    ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : p.toFixed(5);
}

function fmtDuration(openTime: string, closeTime: string | null): string {
  if (!closeTime) return '';
  const ms = new Date(closeTime).getTime() - new Date(openTime).getTime();
  if (ms < 0) return '';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

export const TradeShareCard = forwardRef<View, { trade: ShareTrade }>(
  function TradeShareCard({ trade }, ref) {
    const positive = trade.profit >= 0;
    const pnlColor = positive ? colors.profit : colors.loss;
    const notional = (trade.open_price ?? 0) * trade.volume;
    const pct = notional > 0 ? (trade.profit / notional) * 100 : null;
    const duration = fmtDuration(trade.open_time, trade.close_time);

    return (
      <View
        ref={ref}
        collapsable={false}
        style={{
          width: CARD_W,
          height: CARD_H,
          backgroundColor: colors.bgDeep,
          borderRadius: radius.lg,
          borderWidth: 2,
          borderColor: pnlColor,
          padding: spacing.xl,
          justifyContent: 'space-between',
        }}
      >
        {/* Header: wordmark + side badge */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 22, letterSpacing: 4 }}>
            VANTA
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: pnlColor + '22',
              borderRadius: radius.pill,
              paddingHorizontal: spacing.md,
              paddingVertical: 5,
            }}
          >
            {trade.side === 'buy' ? (
              <TrendingUp color={pnlColor} size={14} />
            ) : (
              <TrendingDown color={pnlColor} size={14} />
            )}
            <Text style={{ ...typography.bodyBold, color: pnlColor, fontSize: 13, letterSpacing: 1 }}>
              {trade.side.toUpperCase()} {trade.volume} {trade.symbol}
            </Text>
          </View>
        </View>

        {/* P&L centerpiece */}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={{ ...typography.monoBold, color: pnlColor, fontSize: 52 }}>
            {positive ? '+' : ''}${Math.abs(trade.profit).toFixed(2)}
          </Text>
          {pct != null && (
            <Text style={{ ...typography.bodyBold, color: pnlColor, fontSize: 18 }}>
              {positive ? '+' : '-'}{Math.abs(pct).toFixed(2)}%
            </Text>
          )}
        </View>

        {/* Footer: prices + duration + tagline */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
            <Text style={{ ...typography.mono, color: colors.textSecondary, fontSize: 14 }}>
              {fmtPrice(trade.open_price)} → {fmtPrice(trade.close_price)}
            </Text>
            {!!duration && (
              <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 14 }}>
                {duration}
              </Text>
            )}
          </View>
          <Text
            style={{
              ...typography.body,
              color: colors.textMuted,
              fontSize: 11,
              textAlign: 'center',
              letterSpacing: 1,
            }}
          >
            Trade smarter. Trade faster. — vanta-jade.vercel.app
          </Text>
        </View>
      </View>
    );
  },
);
