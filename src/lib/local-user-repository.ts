import {
  EMPTY_PROFILE,
  type UserProfile,
  type UserRepository,
} from "@/domain/user-repository";

// In-memory preferences for tests.
export class LocalUserRepository implements UserRepository {
  private profiles = new Map<string, UserProfile>();

  async get(uid: string): Promise<UserProfile> {
    return this.profiles.get(uid) ?? EMPTY_PROFILE;
  }

  async update(uid: string, changes: Partial<UserProfile>): Promise<void> {
    this.profiles.set(uid, { ...(await this.get(uid)), ...changes });
  }
}
