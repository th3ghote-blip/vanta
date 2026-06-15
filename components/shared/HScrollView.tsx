/**
 * HScrollView — a horizontal ScrollView that also scrolls with a vertical mouse
 * wheel on web.
 *
 * RN's horizontal ScrollView only scrolls via drag / trackpad, so desktop mouse
 * users can't reach items past the fold (e.g. the Quick-mode symbol row showing
 * only ~12 of 80 cryptos). On web we attach a non-passive wheel listener that
 * converts vertical wheel delta into horizontal scroll. No-op on native.
 */
import { useEffect, useRef } from 'react';
import { ScrollView, Platform, type ScrollViewProps } from 'react-native';

export function HScrollView(props: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const inst = ref.current as unknown as { getScrollableNode?: () => HTMLElement } | null;
    const node: HTMLElement | null =
      (inst?.getScrollableNode?.() as HTMLElement) ?? (inst as unknown as HTMLElement) ?? null;
    if (!node || typeof node.addEventListener !== 'function') return;

    const onWheel = (e: WheelEvent) => {
      // Let genuine horizontal gestures pass through untouched.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // Nothing to scroll horizontally → leave the vertical page scroll alone.
      if (node.scrollWidth <= node.clientWidth) return;
      node.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      {...props}
    />
  );
}
