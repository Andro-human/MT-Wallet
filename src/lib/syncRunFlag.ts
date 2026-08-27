export interface SyncRunFlag {
  color: string;
  label: string;
}

/** Success is the normal case and gets no flag: colouring every row means the
 *  runs that actually went wrong stop standing out. Unknown statuses are
 *  treated as failures so a new status can never render as silently fine. */
export function syncRunFlag(status: string | null | undefined): SyncRunFlag | null {
  switch (status) {
    case 'success':
    case 'no_messages':
      return null;
    case 'partial':
      return { color: 'text-warning', label: 'partial' };
    case 'failed':
      return { color: 'text-primary', label: 'failed' };
    default:
      return { color: 'text-primary', label: 'failed' };
  }
}
