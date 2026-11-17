// How numbers, prices, times and counted things are read in Japanese, for
// the number helper on the phrasebook screen. Every result comes as the
// written form (kanji, or the digits Japan writes), the kana reading and
// Hepburn romaji in the phrasebook's style: long vowels written out (kyuu,
// juu), one word per place (sen kyuuhyaku hachijuu), and a counter joined to
// the number before it (sanbon). Pure and free of the current language: the
// screen words the modes, counters and errors itself.

export type JapaneseReading = {
  written: string;
  kana: string;
  romaji: string;
};

// One romaji word and its kana; the last word takes the counter.
type Word = { kana: string; ro: string };

// Readings for one digit (index 0 is never read inside a number).
type DigitWords = Partial<Record<number, Word>>;

// The largest number the helper reads: 9999億9999万9999, just under 1兆.
export const NUMBER_MAX = 999_999_999_999;

const DIGITS: readonly Word[] = [
  { kana: "ゼロ", ro: "zero" },
  { kana: "いち", ro: "ichi" },
  { kana: "に", ro: "ni" },
  { kana: "さん", ro: "san" },
  { kana: "よん", ro: "yon" },
  { kana: "ご", ro: "go" },
  { kana: "ろく", ro: "roku" },
  { kana: "なな", ro: "nana" },
  { kana: "はち", ro: "hachi" },
  { kana: "きゅう", ro: "kyuu" },
];

const KANJI = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

// 300 sanbyaku, 600 roppyaku and 800 happyaku change their sound.
const HUNDREDS: readonly Word[] = [
  { kana: "", ro: "" },
  { kana: "ひゃく", ro: "hyaku" },
  { kana: "にひゃく", ro: "nihyaku" },
  { kana: "さんびゃく", ro: "sanbyaku" },
  { kana: "よんひゃく", ro: "yonhyaku" },
  { kana: "ごひゃく", ro: "gohyaku" },
  { kana: "ろっぴゃく", ro: "roppyaku" },
  { kana: "ななひゃく", ro: "nanahyaku" },
  { kana: "はっぴゃく", ro: "happyaku" },
  { kana: "きゅうひゃく", ro: "kyuuhyaku" },
];

// 3000 sanzen and 8000 hassen change; 1000 is plain sen.
const THOUSANDS: readonly Word[] = [
  { kana: "", ro: "" },
  { kana: "せん", ro: "sen" },
  { kana: "にせん", ro: "nisen" },
  { kana: "さんぜん", ro: "sanzen" },
  { kana: "よんせん", ro: "yonsen" },
  { kana: "ごせん", ro: "gosen" },
  { kana: "ろくせん", ro: "rokusen" },
  { kana: "ななせん", ro: "nanasen" },
  { kana: "はっせん", ro: "hassen" },
  { kana: "きゅうせん", ro: "kyuusen" },
];

// Groups of four digits: units, then 万 (man, 10^4), then 億 (oku, 10^8).
const LARGE = [
  { kanji: "", kana: "", ro: "" },
  { kanji: "万", kana: "まん", ro: "man" },
  { kanji: "億", kana: "おく", ro: "oku" },
] as const;

function join(words: readonly Word[]): { kana: string; romaji: string } {
  return {
    kana: words.map((w) => w.kana).join(""),
    romaji: words.map((w) => w.ro).join(" "),
  };
}

// Hepburn marks n before a vowel inside a word: san'oku, not sanoku.
function append(word: Word, tail: Word): Word {
  const apostrophe = /n$/.test(word.ro) && /^[aiueoy]/.test(tail.ro) ? "'" : "";
  return { kana: word.kana + tail.kana, ro: word.ro + apostrophe + tail.ro };
}

// One group of up to four digits. `ones` replaces the reading of the last
// digit (4 yo in yoen, 9 ku in kuji); it only applies to the units group.
function groupWords(g: number, units: boolean, ones?: DigitWords): Word[] {
  const th = Math.floor(g / 1000);
  const hu = Math.floor(g / 100) % 10;
  const te = Math.floor(g / 10) % 10;
  const on = g % 10;
  const words: Word[] = [];
  // 1000 alone is sen, but 1000万 is issenman.
  if (th)
    words.push(
      th === 1 && !units ? { kana: "いっせん", ro: "issen" } : THOUSANDS[th],
    );
  if (hu) words.push(HUNDREDS[hu]);
  const one = on ? (units && ones?.[on]) || DIGITS[on] : null;
  if (te) {
    const tens: Word = {
      kana: (te > 1 ? DIGITS[te].kana : "") + "じゅう",
      ro: (te > 1 ? DIGITS[te].ro : "") + "juu",
    };
    words.push(one ? append(tens, one) : tens);
  } else if (one) words.push(one);
  return words;
}

function groupKanji(g: number, units: boolean): string {
  const th = Math.floor(g / 1000);
  const hu = Math.floor(g / 100) % 10;
  const te = Math.floor(g / 10) % 10;
  const on = g % 10;
  return (
    (th ? (th === 1 ? (units ? "千" : "一千") : KANJI[th] + "千") : "") +
    (hu ? (hu === 1 ? "" : KANJI[hu]) + "百" : "") +
    (te ? (te === 1 ? "" : KANJI[te]) + "十" : "") +
    (on ? KANJI[on] : "")
  );
}

function groups(n: number): number[] {
  return [
    n % 10_000,
    Math.floor(n / 10_000) % 10_000,
    Math.floor(n / 100_000_000),
  ];
}

function numberWords(n: number, ones?: DigitWords, zero?: Word): Word[] {
  if (n === 0) return [zero ?? DIGITS[0]];
  const words: Word[] = [];
  const parts = groups(n);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!parts[i]) continue;
    const group = groupWords(parts[i], i === 0, ones);
    if (i > 0)
      group[group.length - 1] = append(group[group.length - 1], LARGE[i]);
    words.push(...group);
  }
  return words;
}

// 千九百八十 for 1980; 零 for 0.
export function kanjiNumber(n: number): string {
  if (n === 0) return "零";
  const parts = groups(n);
  let out = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) out += groupKanji(parts[i], i === 0) + LARGE[i].kanji;
  }
  return out;
}

// 1,980 for 1980: Japan groups digits in threes with commas, like English.
export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function readNumber(n: number): JapaneseReading {
  return { written: kanjiNumber(n), ...join(numberWords(n)) };
}

// Yen: 4円 is yoen, 9円 kyuuen (never kuen).
const PRICE_ONES: DigitWords = { 4: { kana: "よ", ro: "yo" } };

export function readPrice(n: number): JapaneseReading {
  const { kana, romaji } = join([
    ...numberWords(n, PRICE_ONES),
    { kana: "えん", ro: "en" },
  ]);
  return { written: `${kanjiNumber(n)}円`, kana, romaji };
}

// --- Counters ---------------------------------------------------------------

export const COUNTER_IDS = [
  "tsu",
  "ko",
  "nin",
  "mai",
  "hon",
  "hai",
  "haku",
  "kai",
] as const;
export type CounterId = (typeof COUNTER_IDS)[number];

type CounterRule = {
  symbol: string;
  base: Word;
  max: number;
  // After a number ending in ichi, roku, hachi, juu or hyaku, which shrink to
  // a small っ: ippon, roppon, happon, juppon, hyappon.
  geminate?: Word;
  // After a number ending in ん (san, sen, man): sanbon, senbon.
  afterN?: Word;
  // Whether afterN also applies after yon (yonpaku) or not (yonhon).
  afterYon?: boolean;
  // After san only: sangai.
  afterSan?: Word;
  // Replaces the last digit's reading: 4人 yonin.
  ones?: DigitWords;
  // Whole readings for small numbers, the usual one first, then others
  // also heard.
  irregular?: Partial<Record<number, readonly Word[]>>;
  // Written with kanji numerals (一つ) rather than digits (3枚).
  kanji?: boolean;
};

const w = (kana: string, ro: string): Word => ({ kana, ro });

const COUNTER_RULES: Record<CounterId, CounterRule> = {
  // Native Japanese numbers; they stop at 10 (too), beyond which 個 is used.
  tsu: {
    symbol: "つ",
    base: w("つ", "tsu"),
    max: 10,
    kanji: true,
    irregular: {
      1: [w("ひとつ", "hitotsu")],
      2: [w("ふたつ", "futatsu")],
      3: [w("みっつ", "mittsu")],
      4: [w("よっつ", "yottsu")],
      5: [w("いつつ", "itsutsu")],
      6: [w("むっつ", "muttsu")],
      7: [w("ななつ", "nanatsu")],
      8: [w("やっつ", "yattsu")],
      9: [w("ここのつ", "kokonotsu")],
      10: [w("とお", "too")],
    },
  },
  ko: {
    symbol: "個",
    base: w("こ", "ko"),
    max: NUMBER_MAX,
    geminate: w("こ", "ko"),
    irregular: {
      8: [w("はっこ", "hakko"), w("はちこ", "hachiko")],
      10: [w("じゅっこ", "jukko"), w("じっこ", "jikko")],
    },
  },
  // 1 and 2 are native words; 4 is yo-.
  nin: {
    symbol: "人",
    base: w("にん", "nin"),
    max: NUMBER_MAX,
    ones: { 4: w("よ", "yo") },
    irregular: {
      1: [w("ひとり", "hitori")],
      2: [w("ふたり", "futari")],
      7: [w("ななにん", "nananin"), w("しちにん", "shichinin")],
      9: [w("きゅうにん", "kyuunin"), w("くにん", "kunin")],
    },
  },
  mai: { symbol: "枚", base: w("まい", "mai"), max: NUMBER_MAX },
  hon: {
    symbol: "本",
    base: w("ほん", "hon"),
    max: NUMBER_MAX,
    geminate: w("ぽん", "pon"),
    afterN: w("ぼん", "bon"),
    afterYon: false,
    irregular: { 10: [w("じゅっぽん", "juppon"), w("じっぽん", "jippon")] },
  },
  hai: {
    symbol: "杯",
    base: w("はい", "hai"),
    max: NUMBER_MAX,
    geminate: w("ぱい", "pai"),
    afterN: w("ばい", "bai"),
    afterYon: false,
    irregular: {
      8: [w("はっぱい", "happai"), w("はちはい", "hachihai")],
      10: [w("じゅっぱい", "juppai"), w("じっぱい", "jippai")],
    },
  },
  haku: {
    symbol: "泊",
    base: w("はく", "haku"),
    max: NUMBER_MAX,
    geminate: w("ぱく", "paku"),
    afterN: w("ぱく", "paku"),
    afterYon: true,
    irregular: {
      4: [w("よんぱく", "yonpaku"), w("よんはく", "yonhaku")],
      8: [w("はっぱく", "happaku"), w("はちはく", "hachihaku")],
      10: [w("じゅっぱく", "juppaku"), w("じっぱく", "jippaku")],
    },
  },
  kai: {
    symbol: "階",
    base: w("かい", "kai"),
    max: NUMBER_MAX,
    geminate: w("かい", "kai"),
    afterSan: w("がい", "gai"),
    irregular: {
      3: [w("さんがい", "sangai"), w("さんかい", "sankai")],
      8: [w("はっかい", "hakkai"), w("はちかい", "hachikai")],
      10: [w("じゅっかい", "jukkai"), w("じっかい", "jikkai")],
    },
  },
};

// Endings that shrink to a small っ before a geminating counter.
const SHRINK: readonly [string, string, string, string][] = [
  ["いち", "い", "ichi", "i"],
  ["ろく", "ろ", "roku", "ro"],
  ["はち", "は", "hachi", "ha"],
  ["じゅう", "じゅ", "juu", "ju"],
  ["ゃく", "ゃ", "yaku", "ya"], // hyaku, byaku, pyaku
];

// The number's last word with the counter joined on, sound changes applied.
function attach(
  last: Word,
  rule: Pick<
    CounterRule,
    "base" | "geminate" | "afterN" | "afterYon" | "afterSan"
  >,
): Word {
  if (rule.geminate) {
    for (const [kana, kanaStem, ro, roStem] of SHRINK) {
      if (last.kana.endsWith(kana) && last.ro.endsWith(ro)) {
        const g = rule.geminate;
        return {
          kana: last.kana.slice(0, -kana.length) + kanaStem + "っ" + g.kana,
          ro: last.ro.slice(0, -ro.length) + roStem + g.ro[0] + g.ro,
        };
      }
    }
  }
  if (rule.afterSan && last.kana.endsWith("さん"))
    return append(last, rule.afterSan);
  if (
    rule.afterN &&
    last.kana.endsWith("ん") &&
    (rule.afterYon || !last.kana.endsWith("よん"))
  ) {
    return append(last, rule.afterN);
  }
  return append(last, rule.base);
}

function counted(
  words: readonly Word[],
  rule: Parameters<typeof attach>[1],
): { kana: string; romaji: string } {
  return join([...words.slice(0, -1), attach(words[words.length - 1], rule)]);
}

export function counterSymbol(id: CounterId): string {
  return COUNTER_RULES[id].symbol;
}

export function counterMax(id: CounterId): number {
  return COUNTER_RULES[id].max;
}

export type CountedReading = {
  reading: JapaneseReading;
  // Other readings also heard, when there are any.
  alternatives: JapaneseReading[];
};

export function readCounter(id: CounterId, n: number): CountedReading {
  const rule = COUNTER_RULES[id];
  const written = rule.kanji
    ? n === 10
      ? "十"
      : `${kanjiNumber(n)}${rule.symbol}`
    : `${groupDigits(n)}${rule.symbol}`;
  const whole = rule.irregular?.[n];
  if (whole) {
    const [first, ...rest] = whole.map((x) => ({
      written,
      kana: x.kana,
      romaji: x.ro,
    }));
    return { reading: first, alternatives: rest };
  }
  return {
    reading: { written, ...counted(numberWords(n, rule.ones), rule) },
    alternatives: [],
  };
}

// --- Times ------------------------------------------------------------------

// 4時 yoji, 7時 shichiji, 9時 kuji; 0時 reiji.
const HOUR_ONES: DigitWords = {
  4: w("よ", "yo"),
  7: w("しち", "shichi"),
  9: w("く", "ku"),
};
const HOUR = { base: w("じ", "ji") };
// 1分 ippun, 3分 sanpun, 4分 yonpun, 6分 roppun, 8分 happun, 10分 juppun.
const MINUTE = {
  base: w("ふん", "fun"),
  geminate: w("ぷん", "pun"),
  afterN: w("ぷん", "pun"),
  afterYon: true,
};

function hourWords(h: number): { kana: string; romaji: string } {
  return counted(numberWords(h, HOUR_ONES, w("れい", "rei")), HOUR);
}

function minuteWords(m: number): { kana: string; romaji: string } {
  return counted(numberWords(m), MINUTE);
}

type Prefix = Word & { kanji: string };

function clock(
  prefix: Prefix | null,
  h: number,
  m: number,
  half: boolean,
): JapaneseReading {
  const hour = hourWords(h);
  const parts = [
    prefix ? { kana: prefix.kana, romaji: prefix.ro } : null,
    hour,
  ];
  let written = `${prefix?.kanji ?? ""}${h}時`;
  if (half) {
    parts.push({ kana: "はん", romaji: "han" });
    written += "半";
  } else if (m) {
    parts.push(minuteWords(m));
    written += `${m}分`;
  }
  const present = parts.filter(
    (p): p is { kana: string; romaji: string } => p !== null,
  );
  return {
    written,
    kana: present.map((p) => p.kana).join(""),
    romaji: present.map((p) => p.romaji).join(" "),
  };
}

export type TimeReadings = {
  // The 24-hour form, as on timetables and station boards: 15時30分.
  clock: JapaneseReading;
  // The 12-hour form people say: 午後3時30分 (gogo, afternoon; gozen,
  // morning). Noon on the dot is 正午 (shougo).
  twelveHour: JapaneseReading;
  // Half past, when it is: 午後3時半.
  half: JapaneseReading | null;
};

export function readTime(h: number, m: number): TimeReadings {
  const prefix: Prefix =
    h < 12
      ? { kanji: "午前", ...w("ごぜん", "gozen") }
      : { kanji: "午後", ...w("ごご", "gogo") };
  // Japan's own convention for the 12-hour clock runs 0 to 11: 午前0時 is
  // midnight and 午後0時 just after noon.
  const h12 = h % 12;
  const twelveHour =
    h === 12 && m === 0
      ? { written: "正午", kana: "しょうご", romaji: "shougo" }
      : clock(prefix, h12, m, false);
  return {
    clock: clock(null, h, m, false),
    twelveHour,
    half: m === 30 ? clock(prefix, h12, m, true) : null,
  };
}

// --- Reading what was typed -------------------------------------------------

export type ParseError =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "range"; min: number; max: number }
  | { status: "timeRange" };

// Full-width digits and punctuation (as a Japanese keyboard types them) to
// plain ones.
function normalize(input: string): string {
  return input
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .trim();
}

// A whole number as typed: 1,980, 1.980, 1 980, １９８０, ¥1,980 or 1980円.
export function parseWholeNumber(
  input: string,
  min = 0,
  max = NUMBER_MAX,
): { status: "ok"; value: number } | ParseError {
  const text = normalize(input)
    .replace(/^[¥￥\\]\s*/, "")
    .replace(/\s*(円|yen|jpy)$/i, "")
    .replace(/[\s,、'_]/g, "")
    // 1.980, as Spanish groups thousands: never a decimal, as only whole
    // numbers are read.
    .replace(/^\d{1,3}(?:\.\d{3})+$/, (n) => n.replace(/\./g, ""));
  if (!text) return { status: "empty" };
  if (!/^\d+$/.test(text)) return { status: "invalid" };
  const value = text.length > 15 ? Infinity : Number(text);
  if (value < min || value > max) return { status: "range", min, max };
  return { status: "ok", value };
}

// A 24-hour time as typed: 15:30, 15.30, 15時30分, 1530 (the phone's number
// pad has no colon) or just 15.
export function parseTime(
  input: string,
): { status: "ok"; hour: number; minute: number } | ParseError {
  const text = normalize(input).replace(/\s+/g, "");
  if (!text) return { status: "empty" };
  const match =
    text.match(/^(\d{1,2})(?:[:.時hH](\d{1,2})?分?)?$/) ??
    text.match(/^(\d{1,2})(\d{2})$/);
  if (!match) return { status: "invalid" };
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour > 23 || minute > 59) return { status: "timeRange" };
  return { status: "ok", hour, minute };
}

// What the helper shows for one mode and input.
export type HelperMode = "price" | "number" | "time" | "counter";
export type ReadingKind = "main" | "twelveHour" | "half";

export type HelperResult =
  | {
      status: "ok";
      readings: { kind: ReadingKind; reading: JapaneseReading }[];
      alternatives: JapaneseReading[];
      digits: string | null;
    }
  | ParseError;

export function readJapanese(
  mode: HelperMode,
  input: string,
  counter: CounterId = "tsu",
): HelperResult {
  if (mode === "time") {
    const time = parseTime(input);
    if (time.status !== "ok") return time;
    const r = readTime(time.hour, time.minute);
    const readings: { kind: ReadingKind; reading: JapaneseReading }[] = [
      { kind: "main", reading: r.clock },
      { kind: "twelveHour", reading: r.twelveHour },
    ];
    if (r.half) readings.push({ kind: "half", reading: r.half });
    return {
      status: "ok",
      readings,
      alternatives: [],
      digits: `${time.hour}:${String(time.minute).padStart(2, "0")}`,
    };
  }
  const min = mode === "counter" ? 1 : 0;
  const max = mode === "counter" ? counterMax(counter) : NUMBER_MAX;
  const parsed = parseWholeNumber(input, min, max);
  if (parsed.status !== "ok") return parsed;
  const n = parsed.value;
  if (mode === "counter") {
    const { reading, alternatives } = readCounter(counter, n);
    return {
      status: "ok",
      readings: [{ kind: "main", reading }],
      alternatives,
      digits: null,
    };
  }
  const reading = mode === "price" ? readPrice(n) : readNumber(n);
  return {
    status: "ok",
    readings: [{ kind: "main", reading }],
    alternatives: [],
    digits: mode === "price" ? `${groupDigits(n)}円` : groupDigits(n),
  };
}
