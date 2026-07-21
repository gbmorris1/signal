import { useEffect, useState } from 'react';

/**
 * Trails `value` by `delayMs`, settling only once input stops.
 *
 * Used to keep remote search off the keystroke path: typing "bitcoin" should
 * cost one request, not seven, and the local filter already gives instant
 * feedback while this settles.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
