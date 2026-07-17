import { Linking, Platform } from 'react-native';

// Legal + store URLs. Host the policy pages before App Store submission and
// update these — Apple requires reachable Privacy Policy and Terms (EULA) links.
export const LEGAL = {
  privacyUrl: 'https://oddiq.ai/privacy',
  termsUrl: 'https://oddiq.ai/terms',
  supportUrl: 'https://oddiq.ai/support',
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
