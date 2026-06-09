import { useRef, useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useModeStore } from '@/stores/mode';
import { useAuthStore } from '@/stores/auth';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { ModeSwitcher } from '@/components/shared/ModeSwitcher';
import { EnvBanner } from '@/components/shared/EnvBanner';
import { ProTradeScreen } from '@/components/pro/ProTradeScreen';
import { QuickTradeScreen } from '@/components/fun/QuickTradeScreen';
import { Confetti, type ConfettiRef } from '@/components/shared/Confetti';
import { WinFlash, type WinFlashRef } from '@/components/shared/WinFlash';
import {
  RiskDisclosureModal,
  hasAcknowledgedTradeRisk,
  RISK_ACK_TRADE_KEY,
} from '@/components/RiskDisclosureModal';

const TRADE_RISK_INTRO =
  'Before placing your first trade, please read and acknowledge the following risks ' +
  'associated with trading leveraged financial instruments on the Vanta platform.';

export default function Trade() {
  const router = useRouter();
  const mode = useModeStore((s) => s.mode);
  const loginStreak = useAuthStore((s) => s.loginStreak);
  const confettiRef = useRef<ConfettiRef>(null);
  const winFlashRef = useRef<WinFlashRef>(null);

  // 20.3 -- gate trading behind the risk disclosure. Independent of the deposit
  // gate (separate `vanta:risk_ack_trade` key). `null` = still checking storage.
  const [riskAcked, setRiskAcked] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    hasAcknowledgedTradeRisk().then((acked) => {
      if (mounted) setRiskAcked(acked);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // While the check is pending, render nothing trade-specific to avoid a flash
  // of the trade UI before the gate resolves.
  if (riskAcked === null) {
    return <View style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  if (!riskAcked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
        <RiskDisclosureModal
          visible
          ackKey={RISK_ACK_TRADE_KEY}
          intro={TRADE_RISK_INTRO}
          onAccept={() => setRiskAcked(true)}
          onDecline={() => router.replace('/(tabs)/portfolio')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <EnvBanner />
      {loginStreak >= 2 && (
        <View style={{
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.warning,
          paddingVertical: 6,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
          <Text style={{ fontSize: 16 }}>{'🔥'}</Text>
          <Text style={{ ...typography.body, color: colors.warning, fontSize: 13 }}>
            {loginStreak}-day streak{' '}
            <Text style={{ color: colors.textSecondary }}>
              — log in tomorrow to keep it going!
            </Text>
          </Text>
        </View>
      )}
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <ModeSwitcher />
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md }}>
        {mode === 'pro'
          ? <ProTradeScreen
              onFirstTrade={() => confettiRef.current?.fire()}
              onWinClose={(profit) => winFlashRef.current?.flash(profit)}
            />
          : <QuickTradeScreen />}
      </ScrollView>
      <Confetti ref={confettiRef} />
      <WinFlash ref={winFlashRef} />
    </View>
  );
}
