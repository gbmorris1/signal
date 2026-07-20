// Test environment shims. Keep this minimal: the goal is to exercise real
// component logic, not to stub so much that the tests stop meaning anything.

// expo-router: capture navigation instead of performing it.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

// Haptics are fire-and-forget side effects with no assertable output.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Icons pull in expo-font -> expo-asset, which isn't installed (icons render
// as glyphs in the app, and carry no assertable text in tests).
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));
