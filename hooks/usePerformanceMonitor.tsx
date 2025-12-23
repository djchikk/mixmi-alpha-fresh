import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  componentName: string;
  renderTime?: number;
  mountTime?: number;
  dataFetchTime?: number;
}

export function usePerformanceMonitor(componentName: string) {
  const mountTimeRef = useRef<number>(Date.now());
  const renderCountRef = useRef<number>(0);

  useEffect(() => {
    const mountTime = Date.now() - mountTimeRef.current;
    console.log(`⚡ ${componentName} mounted in ${mountTime}ms`);

    return () => {
      console.log(`⚡ ${componentName} rendered ${renderCountRef.current} times`);
    };
  }, [componentName]);

  useEffect(() => {
    renderCountRef.current += 1;
  });

  const measureDataFetch = async <T,>(
    fetchFn: () => Promise<T>,
    label: string
  ): Promise<T> => {
    const startTime = Date.now();
    try {
      const result = await fetchFn();
      const fetchTime = Date.now() - startTime;
      console.log(`⚡ ${componentName} - ${label} took ${fetchTime}ms`);
      return result;
    } catch (error) {
      const fetchTime = Date.now() - startTime;
      console.error(`⚡ ${componentName} - ${label} failed after ${fetchTime}ms`, error);
      throw error;
    }
  };

  return { measureDataFetch };
}