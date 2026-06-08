import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrendingUp, Zap, DollarSign } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';

const ONBOARDING_KEY = 'vanta_onboarding_done';

interface Step {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
}

const steps: Step[] = [
  {
    icon: <TrendingUp color={colors.primary} size={56} strokeWidth={1.5} />,
    title: 'Welcome to Vanta',
    subtitle: 'Trade smarter. Trade faster.',
    body:
      'Vanta is a next-generation trading platform. Access crypto, forex, stocks, and more — all in one place.',
  },
  {
    icon: <Zap color={colors.warning} size={56} strokeWidth={1.5} />,
    title: 'Two ways to trade',
    subtitle: 'Pro mode or Quick mode — you choose.',
    body:
      'Pro mode gives you full charts, precise order entry, and stop-loss controls — just like MT4.\n\nQuick mode lets you predict up or down in 60 seconds for a fast, fun experience.',
  },
  {
    icon: <DollarSign color={colors.profit} size={56} strokeWidth={1.5} />,
    title: 'Your $10k demo',
    subtitle: 'Zero risk. Real markets.',
    body:
      "Every new account starts with a $10,000 demo balance. Practice with live prices before you ever risk real money.",
  },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (val === 'true') {
        router.replace('/(tabs)/trade');
      } else {
        setReady(true);
      }
    });
  }, []);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finish();
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)/trade');
  };

  if (!ready) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <View style={styles.container}>
      {/* Current page */}
      <View style={styles.page}>
        <View style={styles.iconWrap}>{step.icon}</View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
        <Text style={styles.body}>{step.body}</Text>
      </View>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentStep ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* CTA button */}
      <View style={styles.footer}>
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.btnText}>
            {isLast ? "Let's trade" : 'Next'}
          </Text>
        </Pressable>

        {!isLast && (
          <Pressable onPress={finish} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120,
    width: '100%',
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.heading,
    fontSize: 15,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.border,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 48,
    gap: spacing.sm,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnText: {
    ...typography.heading,
    color: '#fff',
    fontSize: 16,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
  },
});
