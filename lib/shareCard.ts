/**
 * shareCard — 18.11: capture the TradeShareCard view to PNG and share to X.
 *
 * Native (iOS/Android): captureRef → tmpfile → expo-sharing share sheet
 *   (user picks X; image is attached).
 * Web: X's tweet intent cannot attach images (platform limitation), so we
 *   download the PNG and open the intent pre-filled with text — the user
 *   attaches the just-downloaded card in one drag.
 */
import { Platform, Linking } from 'react-native';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { isCrypto } from '@/lib/contracts';
import type { ShareTrade } from '@/components/pro/TradeShareCard';

export function tweetTextFor(trade: ShareTrade): string {
  const sign = trade.profit >= 0 ? '+' : '-';
  const tag = isCrypto(trade.symbol) ? ' #crypto' : '';
  return `Just closed ${sign}$${Math.abs(trade.profit).toFixed(2)} on ${trade.symbol} 🚀 #VANTA${tag}`;
}

export async function shareTradeCard(
  cardRef: React.RefObject<View | null>,
  trade: ShareTrade,
): Promise<void> {
  if (!cardRef.current) throw new Error('share card not mounted');

  const text = tweetTextFor(trade);

  if (Platform.OS === 'web') {
    // Capture as data-uri, trigger a download, then open the X intent.
    const dataUri = await captureRef(cardRef, {
      format: 'png',
      quality: 1,
      result: 'data-uri',
    });
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = `vanta-${trade.symbol}-${trade.profit >= 0 ? 'win' : 'trade'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intent, '_blank', 'noopener');
    return;
  }

  // Native: tmpfile + share sheet with the image attached.
  const uri = await captureRef(cardRef, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: text,
    });
  } else {
    // Sharing unavailable (rare) — fall back to text-only intent.
    await Linking.openURL(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`);
  }
}
