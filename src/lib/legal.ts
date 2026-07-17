import { Linking, Platform } from 'react-native';

// Legal + store URLs. Source pages live in /legal, published via GitHub Pages.
// Operator: Gains Academy LLC (Arizona). Swap to a custom oddiq.ai domain later
// by updating these two URLs.
export const LEGAL = {
  privacyUrl: 'https://gbmorris1.github.io/signal/legal/privacy.html',
  termsUrl: 'https://gbmorris1.github.io/signal/legal/terms.html',
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
