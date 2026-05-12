/**
 * PriceAlertModal -- Phase 6.4
 *
 * Sheet-style modal for setting a price alert on a symbol.
 * Shows current active alert for this symbol (if any) with a cancel option.
 * Creates / replaces the alert via POST /api/alerts.
 */

import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { api, type PriceAlert } from '@/lib/api';

interface Props {
  visible: boolean;
  symbol: string;
  currentPrice: number | null;
  onClose: () => void;
}

export function PriceAlertModal({ visible, symbol, currentPrice, onClose }: Props) {
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [thresholdText, setThresholdText] = useState('');
  const [existing, setExisting] = useState<PriceAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pre-fill threshold from current price when modal opens
  useEffect(() => {
    if (visible) {
      setError(null);
      setSuccess(false);
      if (currentPrice != null) {
        setThresholdText(String(currentPrice.toFixed(currentPrice >= 1000 ? 2 : 4)));
      }
      loadExisting();
    }
  }, [visible, symbol]);

  async function loadExisting() {
    setLoading(true);
    try {
      const res = await api.getAlerts(true);
      const match = res.alerts.find((a) => a.symbol === symbol) ?? null;
      setExisting(match);
      if (match) {
        setDirection(match.direction);
        setThresholdText(String(match.threshold));
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const threshold = parseFloat(thresholdText);
    if (isNaN(threshold) || threshold <= 0) {
      setError('Enter a valid price');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createAlert(symbol, threshold, direction);
      setSuccess(true);
      setTimeout(onClose, 900);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save alert');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!existing) return;
    setSaving(true);
    try {
      await api.deleteAlert(existing.id);
      setExisting(null);
      setSuccess(false);
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Price Alert -- {symbol}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Text style={styles.closeBtn}>X</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>Alert saved!</Text>
            </View>
          ) : (
            <>
              {/* Existing alert banner */}
              {existing && (
                <View style={styles.existingBanner}>
                  <Text style={styles.existingText}>
                    Active: {existing.direction} {Number(existing.threshold).toLocaleString()}
                  </Text>
                  <TouchableOpacity onPress={handleCancel} disabled={saving}>
                    <Text style={styles.cancelAlertBtn}>Cancel alert</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Direction toggle */}
              <Text style={styles.label}>Alert me when price goes</Text>
              <View style={styles.toggle}>
                {(['above', 'below'] as const).map((dir) => (
                  <TouchableOpacity
                    key={dir}
                    style={[styles.toggleBtn, direction === dir && styles.toggleBtnActive]}
                    onPress={() => setDirection(dir)}
                  >
                    <Text style={[styles.toggleText, direction === dir && styles.toggleTextActive]}>
                      {dir === 'above' ? 'Above' : 'Below'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Threshold input */}
              <Text style={styles.label}>Target price</Text>
              <TextInput
                style={styles.input}
                value={thresholdText}
                onChangeText={setThresholdText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
              />

              {currentPrice != null && (
                <Text style={styles.hint}>
                  {currentPrice >= 1000
                    ? 'Current: ' + currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })
                    : 'Current: ' + currentPrice.toFixed(4)}
                </Text>
              )}

              {error != null && <Text style={styles.errorText}>{error}</Text>}

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Set Alert</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const BLUE_BG = colors.primary + '22';
const WARN_BG = colors.warning + '18';
const WARN_BORDER = colors.warning + '44';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
  },
  closeBtn: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: -spacing.xs,
  },
  toggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
  },
  toggleBtnActive: {
    borderColor: colors.primary,
    backgroundColor: BLUE_BG,
  },
  toggleText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: colors.primary,
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 18,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: -spacing.xs,
  },
  errorText: {
    color: colors.loss,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  existingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: WARN_BG,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: WARN_BORDER,
  },
  existingText: {
    color: colors.warning,
    fontSize: 13,
    flex: 1,
  },
  cancelAlertBtn: {
    color: colors.loss,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  successText: {
    color: colors.profit,
    fontSize: 18,
    fontWeight: '700',
  },
});
