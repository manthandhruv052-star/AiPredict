/**
 * Presentation helpers shared across pages.
 *
 * Deliberately small: formatting decisions that affect how trustworthy the
 * product reads (how we phrase confidence, how we age timestamps) belong in
 * one place so they stay consistent everywhere.
 */

import type {
  ConfidenceBand, SignalStatus, SignalType, FeedEntry,
} from '../../../pipeline/schema.ts';

export { SIGNAL_TYPE_LABELS, SIGNAL_TYPES } from '../../../pipeline/schema.ts';

/** Maps a confidence band to its CSS custom property. */
export function bandColor(band: ConfidenceBand): string {
  switch (band) {
    case 'verified': return 'var(--ember)';
    case 'high': return 'var(--rust)';
    case 'moderate': return 'var(--amber)';
    case 'low': return 'var(--grey)';
  }
}

export function statusColor(status: SignalStatus): string {
  switch (status) {
    case 'confirmed': return 'var(--ember)';
    case 'developing': return 'var(--amber)';
    case 'debunked': return 'var(--red)';
    case 'unverified': return 'var(--grey)';
    case 'stale': return 'var(--text-faint)';
  }
}

/** Plain-language status. Users should never have to learn our vocabulary. */
export const STATUS_LABELS: Record<SignalStatus, string> = {
  confirmed: 'Confirmed',
  developing: 'Developing',
  unverified: 'Unverified',
  debunked: 'Debunked',
  stale: 'Went quiet',
};

/** What the reader should take from the number, in one phrase. */
export function bandPhrase(band: ConfidenceBand): string {
  switch (band) {
    case 'verified': return 'Confirmed by the source itself';
    case 'high': return 'Well corroborated';
    case 'moderate': return 'Partially corroborated';
    case 'low': return 'Thinly sourced';
  }
}

export function relativeTime(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function tierLabel(tier: number): string {
  switch (tier) {
    case 1: return 'Primary source';
    case 2: return 'Established outlet';
    case 3: return 'Aggregator';
    default: return 'Low trust';
  }
}

/** Groups feed entries by calendar day for the ledger's date rules. */
export function groupByDay(
  entries: FeedEntry[],
): Array<{ label: string; entries: FeedEntry[] }> {
  const today = new Date('2026-09-15T12:00:00Z').toDateString();
  const yesterday = new Date('2026-09-14T12:00:00Z').toDateString();
  const buckets = new Map<string, FeedEntry[]>();

  for (const e of entries) {
    const key = new Date(e.updated_at).toDateString();
    const arr = buckets.get(key);
    if (arr) arr.push(e);
    else buckets.set(key, [e]);
  }

  return [...buckets.entries()].map(([key, list]) => ({
    label:
      key === today ? 'Today'
      : key === yesterday ? 'Yesterday'
      : new Date(key).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        }),
    entries: list,
  }));
}

export type { FeedEntry, SignalType, SignalStatus, ConfidenceBand };
