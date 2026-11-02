import {
  newShareId,
  shareStatus,
  type Share,
  type SharedTrip,
} from "@/domain/share";
import type {
  NewShare,
  OpenedShare,
  ShareRepository,
} from "@/domain/share-repository";

// In-memory links for tests. Like the rules, `load` finds nothing once a
// link has expired or been revoked.
export class LocalShareRepository implements ShareRepository {
  private shares = new Map<string, Share>();
  private copies = new Map<string, SharedTrip>();
  private listeners = new Set<() => void>();

  constructor(private now: () => Date = () => new Date()) {}

  watchShares(tripId: string, onShares: (shares: Share[]) => void): () => void {
    const notify = () =>
      onShares([...this.shares.values()].filter((s) => s.tripId === tripId));
    this.listeners.add(notify);
    notify();
    return () => {
      this.listeners.delete(notify);
    };
  }

  async create(input: NewShare, trip: SharedTrip): Promise<Share> {
    const at = this.now().toISOString();
    const share: Share = {
      ...input,
      id: newShareId(),
      createdAt: at,
      revoked: false,
      publishedAt: at,
    };
    this.shares.set(share.id, share);
    this.copies.set(share.id, structuredClone(trip));
    this.notify();
    return share;
  }

  async publish(share: Share, trip: SharedTrip): Promise<void> {
    this.copies.set(share.id, structuredClone(trip));
    this.change(share.id, { publishedAt: this.now().toISOString() });
  }

  async setExpiry(share: Share, expiresAt: string): Promise<void> {
    this.change(share.id, { expiresAt });
  }

  async revoke(share: Share): Promise<void> {
    this.change(share.id, { revoked: true });
  }

  async load(shareId: string): Promise<OpenedShare | null> {
    const share = this.shares.get(shareId);
    const trip = this.copies.get(shareId);
    if (!share || !trip || shareStatus(share, this.now()) !== "active")
      return null;
    return { share, trip: structuredClone(trip) };
  }

  private change(id: string, changes: Partial<Share>): void {
    const share = this.shares.get(id);
    if (share) this.shares.set(id, { ...share, ...changes });
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((notify) => notify());
  }
}
