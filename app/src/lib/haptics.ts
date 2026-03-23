import { Capacitor } from '@capacitor/core';

/**
 * Thin wrapper around @capacitor/haptics.
 * No-ops gracefully on web where Haptics API is unavailable.
 */

let Haptics: typeof import('@capacitor/haptics').Haptics | null = null;
let ImpactStyle: typeof import('@capacitor/haptics').ImpactStyle | undefined;

if (Capacitor.isNativePlatform()) {
  void import('@capacitor/haptics').then((mod) => {
    Haptics = mod.Haptics;
    ImpactStyle = mod.ImpactStyle;
  });
}

export async function hapticImpactLight(): Promise<void> {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Light });
  }
}

export async function hapticImpactMedium(): Promise<void> {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Medium });
  }
}
