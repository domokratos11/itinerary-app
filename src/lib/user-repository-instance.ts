import type { UserRepository } from "@/domain/user-repository";
import { FirestoreUserRepository } from "@/lib/firestore-user-repository";

// The one user repository the app uses.
export const userRepository: UserRepository = new FirestoreUserRepository();
