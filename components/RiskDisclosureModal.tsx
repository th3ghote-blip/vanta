/**
 * RiskDisclosureModal — shown once before the user's first deposit.
 *
 * Persistence: AsyncStorage key `vanta:risk_ack` — set to '1' on accept.
 * The deposit screen reads this before rendering; if not ack'd, it renders
 * this modal first and only proceeds when the user taps "I Understand & Accept".
 */
import { useState } from 'react';
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

export const RISK_ACK_KEY = 'vanta:risk_ack';

export async function hasAcknowledgedRisk(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(RISK_ACK_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

export async function acknowledgeRisk(): Promise<void> {
  await AsyncStorage.setItem(RISK_ACK_KEY, '1');
}

const RISK_POINTS = [
  'Trading leveraged financial instruments is high risk and may not be suitable for all investors.',
  'You can lose some or all of your invested capital. Never trade with money you cannot afford to lose.',
  'Past performance of any trading instrument or strategy is not a reliable indicator of future results.',
  'Leverage amplifies both profits and losses. A small adverse price movement can result in a loss greater than your deposit.',
  'Prices shown are indicative quotes from Vanta. Slippage may occur during fast markets.',
  'Demo accounts use virtual funds only. Switching to a live account involves real financial risk.',
];

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function RiskDisclosureModal({ visible, onAccept, onDecline }: Props) {
  const [saving, setSaving] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  async function handleAccept() {
    setSaving(true);
    try {
      await acknowledgeRisk();
    } catch {
      // best-effort
    }
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
              Before making a deposit, please read and acknowledge the following risks associated with
              trading leveraged financial instruments on the Vanta platform.
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
