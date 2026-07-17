import { Linking, Platform } from 'react-native';

// Legal + store URLs. The source pages live in /legal (privacy.html, terms.html).
// Host them anywhere public (GitHub Pages, Netlify, your domain) and set the
// live URLs here — Apple requires reachable Privacy Policy and Terms links.
// Placeholders below assume you publish at oddiq.ai; change to your real host.
export const LEGAL = {
  privacyUrl: 'https://oddiq.ai/privacy',
  termsUrl: 'https://oddiq.ai/terms',
  supportUrl: 'mailto:support@oddiq.ai',
};

/** Standard auto-renewable subscription disclosure Apple expects near the CTA. */
export const SUBSCRIPTION_DISCLOSURE =
  'Payment is charged to your Apple ID at confirmation of purchase. Subscriptions renew automatically unless canceled at least 24 hours before the period ends. Manage or cancel anytime in your App Store account settings.';

/** Opens the iOS system subscription-management screen (Apple requirement). */
export function openManageSubscriptions(): void {
  const url =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  void Linking.openURL(url);
}

export function openUrl(url: string): void {
  void Linking.openURL(url);
}
