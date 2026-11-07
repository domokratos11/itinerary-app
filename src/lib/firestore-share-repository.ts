import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  query,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { z } from "zod";

import {
  CityRecordSchema,
  FlightRecordSchema,
  HolidayRecordSchema,
  PlaceRecordSchema,
  PlanItemSchema,
  ReservationRecordSchema,
  StayRecordSchema,
} from "@/domain/schemas";
import {
  newShareId,
  SHARED_COLLECTIONS,
  ShareSchema,
  type Share,
  type SharedCollection,
  type SharedTrip,
} from "@/domain/share";
import type {
  NewShare,
  OpenedShare,
  ShareRepository,
} from "@/domain/share-repository";
import { getDb, getViewerDb } from "@/lib/firebase";
import { setDoc, updateDoc, writeBatch } from "@/lib/tracked-firestore";

const SCHEMAS: { [C in SharedCollection]: z.ZodType<SharedTrip[C][number]> } = {
  cities: CityRecordSchema,
  stays: StayRecordSchema,
  reservations: ReservationRecordSchema,
  places: PlaceRecordSchema,
  holidays: HolidayRecordSchema,
  flights: FlightRecordSchema,
  items: PlanItemSchema,
};

// A write batch holds at most 500 writes, so larger lists go in chunks.
const CHUNK = 450;

function toShare(id: string, data: DocumentData): Share | null {
  const expiresAt =
    data.expiresAt instanceof Timestamp
      ? data.expiresAt.toDate().toISOString()
      : null;
  const parsed = ShareSchema.safeParse({ ...data, id, expiresAt });
  return parsed.success ? parsed.data : null;
}

// Links live in shares/{shareId}, each copied collection in
// shares/{shareId}/{cities,stays,...,items}/{id}. The rules check every
// copied record has no amount, so a bug here can't leak one either.
export class FirestoreShareRepository implements ShareRepository {
  watchShares(
    tripId: string,
    onShares: (shares: Share[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      query(collection(getDb(), "shares"), where("tripId", "==", tripId)),
      (snapshot) =>
        onShares(snapshot.docs.flatMap((d) => toShare(d.id, d.data()) ?? [])),
      (error) => onError?.(error),
    );
  }

  async create(input: NewShare, trip: SharedTrip): Promise<Share> {
    const now = new Date().toISOString();
    const share: Share = {
      id: newShareId(),
      tripId: input.tripId,
      tripName: input.tripName,
      label: input.label,
      createdAt: now,
      expiresAt: input.expiresAt,
      revoked: false,
      publishedAt: now,
    };
    const { id, ...fields } = share;
    // The link first: the rules for its copy look it up.
    await setDoc(doc(getDb(), "shares", id), {
      ...fields,
      expiresAt: Timestamp.fromDate(new Date(share.expiresAt)),
    });
    await this.writeCopy(id, trip);
    return share;
  }

  async publish(share: Share, trip: SharedTrip): Promise<void> {
    await this.writeCopy(share.id, trip);
    await updateDoc(doc(getDb(), "shares", share.id), {
      publishedAt: new Date().toISOString(),
    });
  }

  async setExpiry(share: Share, expiresAt: string): Promise<void> {
    await updateDoc(doc(getDb(), "shares", share.id), {
      expiresAt: Timestamp.fromDate(new Date(expiresAt)),
    });
  }

  async revoke(share: Share): Promise<void> {
    await updateDoc(doc(getDb(), "shares", share.id), { revoked: true });
  }

  async load(shareId: string): Promise<OpenedShare | null> {
    const db = getViewerDb();
    try {
      const found = await getDocFromServer(doc(db, "shares", shareId));
      const share = found.exists() ? toShare(found.id, found.data()) : null;
      if (!share) return null;
      const parts = await Promise.all(
        SHARED_COLLECTIONS.map((name) => readCopy(db, shareId, name)),
      );
      const trip = Object.fromEntries(
        SHARED_COLLECTIONS.map((name, i) => [name, parts[i]]),
      ) as SharedTrip;
      return { share, trip };
    } catch (error) {
      if ((error as { code?: string }).code === "permission-denied")
        return null;
      throw error;
    }
  }

  // Writes every record, then deletes what's no longer in the trip.
  private async writeCopy(shareId: string, trip: SharedTrip): Promise<void> {
    const db = getDb();
    const writes: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
    for (const name of SHARED_COLLECTIONS) {
      const records = trip[name] as { id: string }[];
      const keep = new Set(records.map((r) => r.id));
      const existing = await getDocsFromServer(
        collection(db, "shares", shareId, name),
      );
      for (const record of records)
        writes.push((b) =>
          b.set(doc(db, "shares", shareId, name, record.id), record),
        );
      for (const old of existing.docs)
        if (!keep.has(old.id)) writes.push((b) => b.delete(old.ref));
    }
    for (let i = 0; i < writes.length; i += CHUNK) {
      const batch = writeBatch(db);
      writes.slice(i, i + CHUNK).forEach((write) => write(batch));
      await batch.commit();
    }
  }
}

async function readCopy<C extends SharedCollection>(
  db: Firestore,
  shareId: string,
  name: C,
): Promise<SharedTrip[C]> {
  const rows = await getDocsFromServer(collection(db, "shares", shareId, name));
  const schema = SCHEMAS[name];
  return rows.docs.flatMap((d) => {
    const parsed = schema.safeParse(d.data());
    return parsed.success ? [parsed.data] : [];
  }) as SharedTrip[C];
}
