import { useEffect, useMemo, useState } from 'react';

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams) => void] {
  const [params, setParams] = useState(
    () => new URLSearchParams(window.location.search),
  );

  useEffect(() => {
    function onPop() {
      setParams(new URLSearchParams(window.location.search));
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return [params, setParams];
}

export function useIsDevMode(): boolean {
  const [params] = useSearchParams();
  return useMemo(() => params.get('dev') === '1', [params]);
}
