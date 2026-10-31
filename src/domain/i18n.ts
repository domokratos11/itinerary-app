import type en from "@/messages/en.json";

type KeysOf<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${KeysOf<T[K]>}`;
}[keyof T & string];

// Every text in the app, as a path into src/messages/en.json. A typo here
// doesn't compile.
export type MessageKey = KeysOf<typeof en>;

export type MessageValues = Record<string, string | number>;

// Domain code takes this as a parameter when it words something, so it stays
// free of any idea of a current language.
export type Translate = (key: MessageKey, values?: MessageValues) => string;
