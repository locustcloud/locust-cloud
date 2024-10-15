import { useEffect, useRef } from 'react';

export default function useAwaitInterval(
  callback: () => void,
  delay: number,
  { shouldRunInterval, immediate }: { shouldRunInterval?: boolean; immediate?: boolean } = {
    shouldRunInterval: true,
    immediate: false,
  },
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!shouldRunInterval) {
      return;
    }

    if (immediate) {
      savedCallback.current();
    }

    let isCancelled = false;
    const startInterval = async () => {
      if (isCancelled) {
        return;
      }

      await savedCallback.current();
      setTimeout(startInterval, delay);
    };

    startInterval();

    return () => {
      isCancelled = true;
    };
  }, [delay, shouldRunInterval]);
}
