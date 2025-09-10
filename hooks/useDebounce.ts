import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that debounces a value
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook that returns a debounced callback function
 * @param callback - The callback to debounce
 * @param delay - The delay in milliseconds
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  callbackRef.current = callback;

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Hook for smooth slider updates with immediate UI feedback but debounced state updates
 * Perfect for crossfaders, volume sliders, etc.
 * @param initialValue - Initial slider value
 * @param onChangeDebounced - Callback for debounced value changes
 * @param delay - Debounce delay in milliseconds (default: 50ms for smooth feel)
 * @returns [immediateValue, setImmediateValue, debouncedValue]
 */
export function useSliderDebounce(
  initialValue: number,
  onChangeDebounced: (value: number) => void,
  delay: number = 50
): [number, (value: number) => void, number] {
  const [immediateValue, setImmediateValue] = useState<number>(initialValue);
  const debouncedUpdate = useDebouncedCallback(onChangeDebounced, delay);

  // Update immediate value and trigger debounced callback
  const handleChange = useCallback((newValue: number) => {
    setImmediateValue(newValue);
    debouncedUpdate(newValue);
  }, [debouncedUpdate]);

  // Sync with external changes
  useEffect(() => {
    setImmediateValue(initialValue);
  }, [initialValue]);

  return [immediateValue, handleChange, immediateValue];
} 