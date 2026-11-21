import type { SetURLSearchParams } from 'react-router-dom';

// Builds on the live URL, not react-router's `prev`: v6 hands every updater the
// params from the last render, so two writes in one handler keep only the last.
export function updateSearchParams(
  setSearchParams: SetURLSearchParams,
  mutate: (next: URLSearchParams) => void,
) {
  const next = new URLSearchParams(window.location.search);
  mutate(next);
  setSearchParams(next, { replace: true });
}
