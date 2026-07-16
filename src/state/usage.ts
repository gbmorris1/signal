import AsyncStorage from '@react-native-async-storage/async-storage';

// Tracks how many AI analyses the user has generated today, for free-tier limits.
const KEY = 'signal.aiUsage.v1';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface UsageRecord {
  date: string;
  count: number;
}

export async function getAiUsageToday(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return 0;
  const rec = JSON.parse(raw) as UsageRecord;
  return rec.date === today() ? rec.count : 0;
}

export async function incrementAiUsage(): Promise<number> {
  const current = await getAiUsageToday();
  const next = current + 1;
  await AsyncStorage.setItem(KEY, JSON.stringify({ date: today(), count: next } satisfies UsageRecord));
  return next;
}
