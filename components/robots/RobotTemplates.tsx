/**
 * RobotTemplates — Phase 3.6.
 *
 * A modal presenting curated strategy prompts grouped by category.
 * Tapping a template calls onSelect(prompt) so the caller can pre-fill
 * the RobotPromptBuilder input.
 */

import { Modal, View, Text, Pressable, ScrollView, SafeAreaView } from 'react-native';
import { X, TrendingUp, Bell, Clock, Zap, BarChart2 } from 'lucide-react-native';

import { colors, radius, spacing, typography, shadows } from '@/lib/theme';

// ─── Template data ────────────────────────────────────────────────────────────

interface Template {
  name: string;
  description: string;
  prompt: string;
}

interface Category {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  templates: Template[];
}

const CATEGORIES: Category[] = [
  {
    id: 'trade',
    label: 'Auto Trading',
    icon: <TrendingUp size={14} />,
    color: colors.primary,
    templates: [
      {
        name: 'NYSE Open Buyer',
        description: 'Buy a stock at market open and sell at close',
        prompt: 'Buy Amazon at NYSE open every weekday and sell at NYSE close',
      },
      {
        name: 'Crypto DCA',
        description: 'Dollar-cost average into Bitcoin daily',
        prompt: 'Buy $10 worth of Bitcoin every day at 9 AM UTC',
      },
      {
        name: 'RSI Reversal',
        description: 'Trade EUR/USD when RSI signals oversold',
        prompt: 'Buy EURUSD when it drops 0.5% in under 10 minutes then bounces — reversal scalp',
      },
      {
        name: 'BTC Dip Buyer',
        description: 'Enter when Bitcoin pulls back',
        prompt: 'Buy Bitcoin when price drops 2% within the last hour',
      },
      {
        name: 'Asian Session Open',
        description: 'Trade gold at London open',
        prompt: 'Buy gold 0.1 lots at London open every weekday, close at end of day',
      },
    ],
  },
  {
    id: 'tip',
    label: 'Tip & Alert',
    icon: <Bell size={14} />,
    color: colors.warning,
    templates: [
      {
        name: 'Morning 3 Picks',
        description: 'Get 3 stock ideas every morning',
        prompt: 'Send me 3 stock trading ideas every morning at 8 AM based on pre-market movers',
      },
      {
        name: 'BTC Alert',
        description: 'Alert on big Bitcoin moves',
        prompt: 'Send me a push notification when Bitcoin moves more than 3% in any direction',
      },
      {
        name: 'Forex Daily Brief',
        description: 'Daily market summary for EURUSD and GBPUSD',
        prompt: 'Give me a daily market brief for EURUSD and GBPUSD at 7 AM every weekday',
      },
      {
        name: 'Stock Earnings Watcher',
        description: 'Alert before major earnings days',
        prompt: 'Remind me when Apple, Tesla, or Amazon have earnings coming up and suggest a trade',
      },
    ],
  },
  {
    id: 'event',
    label: 'Event Driven',
    icon: <Clock size={14} />,
    color: colors.info,
    templates: [
      {
        name: 'NYSE Open Sniper',
        description: 'Execute at the exact open bell',
        prompt: 'At NYSE open, buy AAPL 1 share if the day is Monday or Tuesday',
      },
      {
        name: 'London Close Sweep',
        description: 'Take profit at London session close',
        prompt: 'Close all my EURUSD positions at London close every weekday',
      },
      {
        name: 'Daily Crypto Window',
        description: 'Trade during peak volatility',
        prompt: 'At Asia open, look for Bitcoin momentum and send me a tip on direction',
      },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: <Zap size={14} />,
    color: colors.profit,
    templates: [
      {
        name: 'Grid Scalper',
        description: 'Profit from small crypto oscillations',
        prompt: 'Buy BTCUSD 0.01 lots every time price drops 0.5%, sell when up 0.5% — grid strategy',
      },
      {
        name: 'Trend Follower',
        description: 'Follow the dominant daily trend',
        prompt: 'At NYSE open, check if S&P 500 is above its 20-day high. If yes, buy NAS100 0.1 lots',
      },
      {
        name: 'Volatility Screener',
        description: 'Alert on unusual market moves',
        prompt: 'Every hour, check crypto markets and alert me if any coin moves more than 5%',
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
}

function CategorySection({
  category,
  onSelect,
}: {
  category: Category;
  onSelect: (prompt: string) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {/* Category header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.xs,
            backgroundColor: category.color + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Re-clone icon with category color */}
          {category.id === 'trade' && <TrendingUp size={13} color={category.color} />}
          {category.id === 'tip' && <Bell size={13} color={category.color} />}
          {category.id === 'event' && <Clock size={13} color={category.color} />}
          {category.id === 'advanced' && <Zap size={13} color={category.color} />}
        </View>
        <Text
          style={{
            ...typography.bodyBold,
            color: category.color,
            fontSize: 11,
            letterSpacing: 1,
          }}
        >
          {category.label.toUpperCase()}
        </Text>
      </View>

      {/* Template cards */}
      {category.templates.map((tpl) => (
        <Pressable
          key={tpl.name}
          onPress={() => onSelect(tpl.prompt)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.bgSurface : colors.bgElevated,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            gap: 4,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
              {tpl.name}
            </Text>
            <BarChart2 size={13} color={colors.textMuted} />
          </View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
            {tpl.description}
          </Text>
          <Text
            style={{
              ...typography.body,
              color: colors.textMuted,
              fontSize: 11,
              marginTop: 2,
              fontStyle: 'italic',
            }}
            numberOfLines={2}
          >
            "{tpl.prompt}"
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function RobotTemplates({ visible, onClose, onSelect }: Props) {
  const handleSelect = (prompt: string) => {
    onSelect(prompt);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View>
            <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18 }}>
              Robot Templates
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
              Tap a template to fill the prompt builder
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.pill,
              backgroundColor: colors.bgSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Template list */}
        <ScrollView
          contentContainerStyle={{
            padding: spacing.md,
            gap: spacing.xl,
            paddingBottom: spacing.xxxl,
          }}
        >
          {CATEGORIES.map((cat) => (
            <CategorySection key={cat.id} category={cat} onSelect={handleSelect} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
