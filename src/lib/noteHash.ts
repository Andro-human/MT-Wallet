/** SHA-256 of the trimmed note, hex.
 *
 *  Must stay byte-identical to the backend's noteHash in
 *  mtwallet-backend/src/services/enrichmentPending.ts. This hash is what marks
 *  an enrichment row current: if a client write stores a hash the server would
 *  not compute, the nightly agent sees the row as stale and relabels a
 *  transaction the user just resolved by hand.
 */
export async function noteHash(note: string | null | undefined): Promise<string> {
  const bytes = new TextEncoder().encode((note ?? '').trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
