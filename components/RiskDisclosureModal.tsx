/**
 * RiskDisclosureModal — shown once before the user's first deposit.
 *
 * Persistence: AsyncStorage key `vanta:risk_ack` — set to '1' on accept.
 * The deposit screen reads this before rendering; if not ack'd, it renders
 * this modal first and only proceeds when the user taps "I Understand & Accept".
 */
import { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlertTriangle } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { api } from '@/lib/api';

export const RISK_ACK_KEY = 'vanta:risk_ack';
// Separate key gating the user's first *trade* (20.3). Kept independent from the
// deposit key so acknowledging one does not silently satisfy the other.
export const RISK_ACK_TRADE_KEY = 'vanta:risk_ack_trade';

export async function hasAcknowledgedRisk(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(RISK_ACK_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

export async function hasAcknowledgedTradeRisk(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(RISK_ACK_TRADE_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

export async function acknowledgeRisk(key: string = RISK_ACK_KEY): Promise<void> {
  await AsyncStorage.setItem(key, '1');
}

const RISK_POINTS = [
  'Trading leveraged financial instruments is high risk and may not be suitable for all investors.',
  'You can lose some or all of your invested capital. Never trade with money you cannot afford to lose.',
  'Past performance of any trading instrument or strategy is not a reliable indicator of future results.',
  'Leverage amplifies both profits and losses. A small adverse price movement can result in a loss greater than your deposit.',
  'Prices shown are indicative quotes from Vanta. Slippage may occur during fast markets.',
  'Demo accounts use virtual funds only. Switching to a live account involves real financial risk.',
];

const DEFAULT_INTRO =
  'Before making a deposit, please read and acknowledge the following risks associated with ' +
  'trading leveraged financial instruments on the Vanta platform.';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** Which AsyncStorage key to persist acknowledgement to. Defaults to the deposit key. */
  ackKey?: string;
  /** Intro paragraph shown above the risk points. Defaults to the deposit wording. */
  intro?: string;
}

export function RiskDisclosureModal({
  visible,
  onAccept,
  onDecline,
  ackKey = RISK_ACK_KEY,
  intro = DEFAULT_INTRO,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // On web (and any screen large enough to show all content without scrolling),
  // onScroll never fires because there is nothing to scroll. We detect this by
  // comparing content height to container height; if content fits, unlock immediately.
  const containerH = useRef(0);
  const contentH = useRef(0);

  function checkFits() {
    if (containerH.current > 0 && contentH.current > 0) {
      if (contentH.current <= containerH.current + 20) {
        setScrolledToBottom(true);
      }
    }
  }

  async function handleAccept() {
    setSaving(true);
    try {
      await acknowledgeRisk(ackKey);
    } catch {
      // best-effort
    }
    // 18.10 — also persist acceptance server-side so it survives device changes.
    // Best-effort: never block the UX on the network round-trip.
    void api.acceptRiskServer().catch(() => {});
    setSaving(false);
    onAccept();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderTopLeftRadius: radius.xl ?? 20,
            borderTopRightRadius: radius.xl ?? 20,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: '85%',
          }}
        >
          {/* Title bar */}
          <View
            style={{
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <AlertTriangle color={colors.warning} size={22} />
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 17, flex: 1 }}>
              Risk Disclosure
            </Text>
          </View>

          {/* Scrollable content */}
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg }}
            onLayout={(e) => {
              containerH.current = e.nativeEvent.layout.height;
              checkFits();
            }}
            onContentSizeChange={(_w, h) => {
              contentH.current = h;
              checkFits();
            }}
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const reached = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
              if (reached) setScrolledToBottom(true);
            }}
            scrollEventThrottle={16}
          >
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                fontSize: 13,
                lineHeight: 20,
                marginBottom: spacing.md,
              }}
            >
              {intro}
            </Text>

            {RISK_POINTS.map((point, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  gap: spacing.sm,
                  marginBottom: spacing.sm,
                  alignItems: 'flex-start',
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: colors.bgSurface,
                    borderWidth: 1,
                    borderColor: colors.warning,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
                </View>
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textSecondary,
                    fontSize: 13,
                    lineHeight: 20,
                    flex: 1,
                  }}
                >
                  {point}
                </Text>
              </View>
            ))}

            <View
              style={{
                marginTop: spacing.md,
                padding: spacing.md,
                backgroundColor: colors.bgSurface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.warning,
              }}
            >
              <Text
                style={{
                  ...typography.bodyBold,
                  color: colors.warning,
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                CFDs and forex trading carries significant risk of loss. {'\n'}
                This product may not be suitable for everyone.
              </Text>
            </View>

            {!scrolledToBottom && (
              <Text
                style={{
                  ...typography.body,
                  color: colors.textMuted,
                  fontSize: 11,
                  textAlign: 'center',
                  marginTop: spacing.md,
                }}
              >
                ↓ Scroll down to continue
              </Text>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View
            style={{
              padding: spacing.lg,
              gap: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Pressable
              onPress={handleAccept}
              disabled={saving || !scrolledToBottom}
              style={{
                backgroundColor: scrolledToBottom ? colors.primary : colors.bgSurface,
                borderRadius: radius.md,
                padding: spacing.md,
                alignItems: 'center',
                opacity: scrolledToBottom ? 1 : 0.5,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 15 }}>
                  I Understand & Accept
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={onDecline}
              style={{
                borderRadius: radius.md,
                padding: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 14 }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
