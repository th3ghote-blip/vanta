import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { BinaryCard } from './BinaryCard';
import { CountdownRing } from './CountdownRing';

const ASSETS = [
  { symbol: 'EURUSD', name: 'Euro / Dollar', price: 1.0851, change: 0.12 },
  { symbol: 'BTCUSD', name: 'Bitcoin', price: 71240, change: 2.4 },
  { symbol: 'XAUUSD', name: 'Gold', price: 2348.5, change: -0.4 },
  { symbol: 'AAPL', name: 'Apple', price: 224.8, change: 1.1 },
  { symbol: 'TSLA', name: 'Tesla', price: 252.3, change: -1.8 },
  { symbol: 'AMZN', name: 'Amazon', price: 184.2, change: 0.6 },
];

const DURATIONS = [
  { label: '60s', seconds: 60, multiplier: 1.85 },
  { label: '5min', seconds: 300, multiplier: 1.78 },
  { label: '15min', seconds: 900, multiplier: 1.72 },
];

export function QuickTradeScreen() {
  const [selected, setSelected] = useState(ASSETS[0]);
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [stake, setStake] = useState(10);

  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
      {/* Streak banner */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.bgElevated,
          padding: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Flame color={colors.warning} size={20} />
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>3-day streak</Text>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginLeft: 'auto' }}>
          Win 5 in a row → 2× payout
        </Text>
      </View>

      {/* Asset chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {ASSETS.map((a) => {
          const active = a.symbol === selected.symbol;
          const positive = a.change >= 0;
          return (
            <Pressable
              key={a.symbol}
              onPress={() => setSelected(a)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: active ? colors.primary : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                minWidth: 120,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: active ? '#fff' : colors.textPrimary, fontSize: 13 }}>
                {a.symbol}
              </Text>
              <Text
                style={{
                  ...typography.mono,
                  fontSize: 11,
                  color: active ? '#fff' : positive ? colors.profit : colors.loss,
                  marginTop: 2,
                }}
              >
                {positive ? '+' : ''}
                {a.change.toFixed(2)}%
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Featured card with countdown */}
      <BinaryCard asset={selected} duration={duration} />

      {/* Duration picker */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {DURATIONS.map((d) => {
          const active = d.label === duration.label;
          return (
            <Pressable
              key={d.label}
              onPress={() => setDuration(d)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                alignItems: 'center',
                borderRadius: radius.md,
                backgroundColor: active ? colors.bgElevated : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>{d.label}</Text>
              <Text style={{ ...typography.mono, color: colors.profit, fontSize: 11, marginTop: 2 }}>
                ×{d.multiplier}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Stake selector */}
      <View>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs }}>
          Stake
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[5, 10, 25, 50, 100].map((amt) => {
            const active = amt === stake;
            return (
              <Pressable
                key={amt}
                onPress={() => setStake(amt)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  alignItems: 'center',
                  borderRadius: radius.md,
                  backgroundColor: active ? colors.primary : colors.bgSurface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    ...typography.monoBold,
                    color: active ? '#fff' : colors.textPrimary,
                    fontSize: 14,
                  }}
                >
                  ${amt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Up / Down buttons */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.loss,
            paddingVertical: spacing.lg,
            borderRadius: radius.lg,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          <TrendingDown color="#fff" size={20} />
          <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>Down</Text>
        </Pressable>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.profit,
            paddingVertical: spacing.lg,
            borderRadius: radius.lg,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          <TrendingUp color="#fff" size={20} />
          <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>Up</Text>
        </Pressable>
      </View>

      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, textAlign: 'center' }}>
        Win pays ${(stake * duration.multiplier).toFixed(2)} · Loss costs ${stake.toFixed(2)}
      </Text>
    </View>
  );
}
