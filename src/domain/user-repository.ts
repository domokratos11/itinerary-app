import { z } from "zod";

export const LANGUAGES = ["en", "es"] as const;
export type Language = (typeof LANGUAGES)[number];

// One person's preferences, kept under users/{uid} so they follow the person
// to any device. Only that person can read or write it.
export const UserProfileSchema = z.object({
  language: z.enum(LANGUAGES).nullable().default(null),
  lastTripId: z.string().max(128).nullable().default(null),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const EMPTY_PROFILE: UserProfile = { language: null, lastTripId: null };

export interface UserRepository {
  // The empty profile when there is none yet or it can't be read.
  get(uid: string): Promise<UserProfile>;
  update(uid: string, changes: Partial<UserProfile>): Promise<void>;
}
