import { doc, getDoc, setDoc } from "firebase/firestore";

import {
  EMPTY_PROFILE,
  UserProfileSchema,
  type UserProfile,
  type UserRepository,
} from "@/domain/user-repository";
import { getDb } from "@/lib/firebase";

// Reads and writes users/{uid}.
export class FirestoreUserRepository implements UserRepository {
  async get(uid: string): Promise<UserProfile> {
    try {
      const snapshot = await getDoc(doc(getDb(), "users", uid));
      const parsed = UserProfileSchema.safeParse(snapshot.data() ?? {});
      return parsed.success ? parsed.data : EMPTY_PROFILE;
    } catch {
      // Offline with nothing cached.
      return EMPTY_PROFILE;
    }
  }

  async update(uid: string, changes: Partial<UserProfile>): Promise<void> {
    await setDoc(
      doc(getDb(), "users", uid),
      { ...changes, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
}
