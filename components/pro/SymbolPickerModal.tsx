import { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Search, X, ChevronRight, Star } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';
import {
  CATEGORIES,
  allSymbols,
  type SymbolCategory,
} from '@/lib/symbolMeta';
import { useWatchlistStore } from '@/stores/watchlist';

interface Props {
  visible: boolean;
  current: string;
  onSelect: (s: string) => void;
  onClose: () => void;
}

type Tab = 'Watchlist' | 'All' | SymbolCategory;

export function SymbolPickerModal({ visible, current, onSelect, onClose }: Props) {
  const quotes = usePriceStore((s) => s.quotes);
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');

  const { starred, fetch: fetchWatchlist, toggle: toggleStar, isStarred } = useWatchlistStore();

  // Hydrate watchlist whenever the modal opens.
  useEffect(() => {
    if (visible) fetchWatchlist();
  }, [visible]);

  const all = useMemo(() => allSymbols(), []);

  const filtered = useMemo(() => {
    let pool: typeof all;
    if (tab === 'Watchlist') {
      pool = all.filter((s) => starred.has(s.ticker));
    } else if (tab === 'All') {
      pool = all;
    } else {
      pool = all.filter((s) => s.category === tab);
    }
    const q = search.trim().toUpperCase();
    if (q) {
      pool = pool.filter(
        (s) =>
          s.ticker.includes(q) || s.name.toUpperCase().includes(q),
      );
    }
    return pool;
  }, [all, tab, search, starred]);

  const tabs: Tab[] = ['Watchlist', 'All', ...CATEGORIES];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[typography.heading, { color: colors.textPrimary, fontSize: 18 }]}>
              Select Symbol
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X color={colors.textSecondary} size={22} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.search}>
            <Search color={colors.textMuted} size={16} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by ticker or name…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <X color={colors.textMuted} size={14} />
              </Pressable>
            )}
          </View>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
          >
            {tabs.map((t) => {
              const active = t === tab;
              const count =
                t === 'Watchlist'
                  ? starred.size
                  : t === 'All'
                  ? all.length
                  : all.filter((s) => s.category === t).length;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: active ? colors.primary : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={{ ...typography.bodyBold, color: active ? '#fff' : colors.textSecondary, fontSize: 12 }}>
                    {t}
                  </Text>
                  <Text style={{ ...typography.mono, color: active ? '#fff' : colors.textMuted, fontSize: 11 }}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Results list */}
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.xl }}>
            {filtered.length === 0 ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                {tab === 'Watchlist' && !search ? (
                  <>
                    <Star size={32} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
                    <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                      {"No starred symbols yet. Tap the star next to any symbol to add it here."}
                    </Text>
                  </>
                ) : (
                  <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13 }}>
                    No symbols match "{search}".
                  </Text>
                )}
              </View>
            ) : (
              filtered.map((s) => {
                const q = quotes[s.ticker];
                const mid = q ? (q.bid + q.ask) / 2 : null;
                const isActive = s.ticker === current;
                return (
                  <Pressable
                    key={s.ticker}
                    onPress={() => {
                      onSelect(s.ticker);
                      onClose();
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: isActive ? colors.bgSurface : 'transparent',
                    }}
                  >
                    {/* Star toggle — does NOT propagate to the row's onPress */}
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); toggleStar(s.ticker); }}
                      hitSlop={8}
                      style={{ marginRight: spacing.sm }}
                    >
                      <Star
                        size={16}
                        color={isStarred(s.ticker) ? '#F59E0B' : colors.textMuted}
                        fill={isStarred(s.ticker) ? '#F59E0B' : 'none'}
                      />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
                          {s.ticker}
                        </Text>
                        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
                          · {s.category}
                        </Text>
                      </View>
                      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                        {s.name}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', minWidth: 92 }}>
                      <Text
                        style={{
                          ...typography.mono,
                          fontSize: 13,
                          color: mid != null ? colors.textPrimary : colors.textMuted,
                        }}
                      >
                        {mid != null ? formatPrice(mid) : '—'}
                      </Text>
                      {q && (
                        <Text style={{ ...typography.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                          {formatPrice(q.bid)} / {formatPrice(q.ask)}
                        </Text>
                      )}
                    </View>
                    <ChevronRight color={colors.textMuted} size={16} style={{ marginLeft: spacing.sm }} />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(7);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgSurface,
    margin: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
});
