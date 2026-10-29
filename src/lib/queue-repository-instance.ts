import type { QueueRepository } from "@/domain/queue-repository";
import { FirestoreQueueRepository } from "@/lib/firestore-queue-repository";

// The one queue repository the app uses.
export const queueRepository: QueueRepository = new FirestoreQueueRepository();
