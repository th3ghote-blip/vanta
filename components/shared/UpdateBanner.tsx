/**
 * UpdateBanner (web only) — detects when a newer build has been deployed while
 * the app is open and offers a one-tap reload. Kills the "you're on a stale
 * cached bundle" problem where new deploys don't take effect until a manual
 * hard-refresh.
 *
 * How: at mount we record the current entry-bundle hash from the page's script
 * tags. Every 60s (and on tab refocus) we re-fetch index.html with no-store and
 * compare the entry-bundle hash. If it changed, a deploy happened → show the
 * banner. No-op on native (Expo OTA handles native updates separately).
 */
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

const ENTRY_RE = /_expo\/static\/js\/web\/entry-[a-z0-9]+\.js/i;

export function UpdateBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc: any = (globalThis as any).document;
    const loc: any = (globalThis as any).location;
    if (!doc || !loc) return;

    const current: string | undefined = [...doc.querySelectorAll('script[src]')]
      .map((s: any) => s.src as string)
      .find((src: string) => ENTRY_RE.test(src));
    // No content-hashed bundle (e.g. Metro dev server) → nothing to compare.
    const currentHash = current?.match(ENTRY_RE)?.[0];
    if (!currentHash) return;

    let cancelled = false;
    const check = async () => {
      try {
        const html = await fetch(`/?_=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
        const latest = html.match(ENTRY_RE)?.[0];
        if (!cancelled && latest && latest !== currentHash) setStale(true);
      } catch {
        /* offline / transient — ignore */
      }
    };

    const iv = setInterval(check, 60_000);
    const onVis = () => { if (doc.visibilityState === 'visible') check(); };
    doc.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; clearInterval(iv); doc.removeEventListener('visibilitychange', onVis); };
  }, []);

  if (!stale) return null;

  return (
    <Pressable
      onPress={() => (globalThis as any).location?.reload()}
      style={{
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        bottom: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        zIndex: 9999,
        ...(Platform.OS === 'web' ? { boxShadow: '0 4px 20px rgba(0,0,0,0.4)' } : {}),
      }}
    >
      <RefreshCw color="#fff" size={16} />
      <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 14 }}>
        New version available — tap to reload
      </Text>
    </Pressable>
  );
}
