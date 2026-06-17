import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { CountdownRing } from './CountdownRing';
import type { BinaryRound } from './ActiveRounds';

interface Props {
  asset: { symbol: string; name: string; price: number; change: number };
  duration: { label: string; seconds: number; multiplier: number };
  /** The pending round on this asset, if any — turns the card into a live position view. */
  activeRound?: BinaryRound | null;
  /** Current live mid price (for the active-round up/down calc). Falls back to asset.price. */
  livePrice?: number;
}

function fmtPrice(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

// How far price must move (in %) for the progress bar to fill its half. Binary
// rounds win on ANY move in the right direction, so this is just visual scaling —
// small moves still show a sliver, and the exact delta is printed as text.
const BAR_FULL_SCALE_PCT = 0.4;

export function BinaryCard({ asset, duration, activeRound, livePrice }: Props) {
  if (activeRound) {
    return <PositionView asset={asset} round={activeRound} livePrice={livePrice ?? asset.price} />;
  }

  // ── Default: price + today's change + selected-duration ring ──
  const positive = asset.change >= 0;
  return (
    <LinearGradient
      colors={[colors.bgElevated, colors.bgSurface]}
      style={{ borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>{asset.name}</Text>
          <Text style={{ ...typography.display, color: colors.textPrimary, fontSize: 28, marginTop: 4 }}>
            {asset.symbol}
          </Text>
          <Text style={{ ...typography.monoBold, color: positive ? colors.profit : colors.loss, fontSize: 24, marginTop: spacing.sm }}>
            {fmtPrice(asset.price)}
          </Text>
          <Text style={{ ...typography.mono, color: positive ? colors.profit : colors.loss, fontSize: 13, marginTop: 2 }}>
            {positive ? '+' : ''}{asset.change.toFixed(2)}% today
          </Text>
        </View>
        <CountdownRing seconds={duration.seconds} label={duration.label} />
      </View>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// PositionView — shown while a round is live on the selected asset
// ---------------------------------------------------------------------------

function PositionView({
  asset,
  round,
  livePrice,
}: {
  asset: Props['asset'];
  round: BinaryRound;
  livePrice: number;
}) {
  const entry = round.entry_price;
  const isUp = round.direction === 'buy';
  const deltaAbs = livePrice - entry;
  const deltaPct = entry !== 0 ? (deltaAbs / entry) * 100 : 0;

  // Winning = price moved the way you bet. Exact-equal is a tie (stake refunds).
  const status: 'winning' | 'losing' | 'even' =
    deltaAbs === 0 ? 'even' : (isUp ? deltaAbs > 0 : deltaAbs < 0) ? 'winning' : 'losing';
  const statusColor =
    status === 'winning' ? colors.profit : status === 'losing' ? colors.loss : colors.textMuted;

  // Projected P&L if it settled right now.
  const projPnl =
    status === 'winning' ? round.stake * (round.payout_multiplier - 1)
    : status === 'losing' ? -round.stake
    : 0;

  // Progress bar: center = entry. Fill grows from center toward the side price
  // moved, width scaled by |deltaPct|, clamped to the half-width.
  const frac = Math.min(Math.abs(deltaPct) / BAR_FULL_SCALE_PCT, 1);
  const fillHalfPct = frac * 50; // 0..50 (% of full bar)
  const movedRight = deltaAbs > 0;

  return (
    <LinearGradient
      colors={[colors.bgElevated, colors.bgSurface]}
      style={{ borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: statusColor }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
        <View style={{ flex: 1 }}>
          {/* Symbol + WIN/LOSE pill */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>{asset.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: isUp ? '#0d2e1e' : '#2e0d12' }}>
              <Text style={{ ...typography.bodyBold, color: isUp ? colors.profit : colors.loss, fontSize: 11 }}>
                {isUp ? '▲ UP' : '▼ DOWN'}
              </Text>
            </View>
          </View>

          <Text style={{ ...typography.display, color: colors.textPrimary, fontSize: 24, marginTop: 4 }}>
            {asset.symbol}
          </Text>

          {/* Big live price, color-coded by position */}
          <Text style={{ ...typography.monoBold, color: statusColor, fontSize: 40, marginTop: spacing.xs, lineHeight: 44 }}>
            {fmtPrice(livePrice)}
          </Text>

          {/* Delta vs entry */}
          <Text style={{ ...typography.mono, color: statusColor, fontSize: 13, marginTop: 2 }}>
            {deltaAbs >= 0 ? '+' : ''}{fmtPrice(deltaAbs)} ({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(3)}%) vs entry {fmtPrice(entry)}
          </Text>
        </View>

        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <CountdownRing seconds={round.duration_seconds} closesAt={round.closes_at} label="" size={64} />
          <Text style={{ ...typography.bodyBold, color: statusColor, fontSize: 12 }}>
            {status === 'winning' ? 'WINNING' : status === 'losing' ? 'LOSING' : 'EVEN'}
          </Text>
        </View>
      </View>

      {/* Centered progress bar: entry at the middle, fill toward where price moved */}
      <View style={{ marginTop: spacing.md }}>
        <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', position: 'relative' }}>
          {/* moving fill */}
          {frac > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                backgroundColor: statusColor,
                left: movedRight ? '50%' : `${50 - fillHalfPct}%`,
                width: `${fillHalfPct}%`,
              }}
            />
          )}
          {/* entry center line */}
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, backgroundColor: colors.textSecondary }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 10 }}>↓ DOWN wins</Text>
          <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 10 }}>entry</Text>
          <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 10 }}>UP wins ↑</Text>
        </View>
      </View>

      {/* Projected P&L if it closed now */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
          ${round.stake.toFixed(2)} stake · ×{round.payout_multiplier}
        </Text>
        <Text style={{ ...typography.monoBold, color: statusColor, fontSize: 15 }}>
          {status === 'even' ? 'refund' : `${projPnl >= 0 ? '+' : ''}$${projPnl.toFixed(2)}`}
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}> if closed now</Text>
        </Text>
      </View>
    </LinearGradient>
  );
}
