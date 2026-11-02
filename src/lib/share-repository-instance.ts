import type { ShareRepository } from "@/domain/share-repository";
import { FirestoreShareRepository } from "@/lib/firestore-share-repository";

// The one share repository the app uses. Screens call it, never the
// Firebase SDK directly.
export const shareRepository: ShareRepository = new FirestoreShareRepository();
