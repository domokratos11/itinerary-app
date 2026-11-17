import { describe, expect, it } from "vitest";

import {
  COUNTER_IDS,
  groupDigits,
  kanjiNumber,
  NUMBER_MAX,
  parseTime,
  parseWholeNumber,
  readCounter,
  readJapanese,
  readNumber,
  readPrice,
  readTime,
  type CounterId,
} from "@/domain/japanese-numbers";

function kana(r: { kana: string }) {
  return r.kana;
}

describe("readNumber", () => {
  it.each([
    [0, "零", "ゼロ", "zero"],
    [1, "一", "いち", "ichi"],
    [4, "四", "よん", "yon"],
    [7, "七", "なな", "nana"],
    [9, "九", "きゅう", "kyuu"],
    [10, "十", "じゅう", "juu"],
    [11, "十一", "じゅういち", "juuichi"],
    [14, "十四", "じゅうよん", "juuyon"],
    [20, "二十", "にじゅう", "nijuu"],
    [47, "四十七", "よんじゅうなな", "yonjuunana"],
    [99, "九十九", "きゅうじゅうきゅう", "kyuujuukyuu"],
    [100, "百", "ひゃく", "hyaku"],
    [300, "三百", "さんびゃく", "sanbyaku"],
    [600, "六百", "ろっぴゃく", "roppyaku"],
    [800, "八百", "はっぴゃく", "happyaku"],
    [1000, "千", "せん", "sen"],
    [3000, "三千", "さんぜん", "sanzen"],
    [8000, "八千", "はっせん", "hassen"],
    [
      1980,
      "千九百八十",
      "せんきゅうひゃくはちじゅう",
      "sen kyuuhyaku hachijuu",
    ],
    [1005, "千五", "せんご", "sen go"],
    [10_000, "一万", "いちまん", "ichiman"],
    [
      12_800,
      "一万二千八百",
      "いちまんにせんはっぴゃく",
      "ichiman nisen happyaku",
    ],
    [100_000, "十万", "じゅうまん", "juuman"],
    [1_000_000, "百万", "ひゃくまん", "hyakuman"],
    [3_500_000, "三百五十万", "さんびゃくごじゅうまん", "sanbyaku gojuuman"],
    [10_000_000, "一千万", "いっせんまん", "issenman"],
    [
      99_999_999,
      "九千九百九十九万九千九百九十九",
      "きゅうせんきゅうひゃくきゅうじゅうきゅうまんきゅうせんきゅうひゃくきゅうじゅうきゅう",
      "kyuusen kyuuhyaku kyuujuukyuuman kyuusen kyuuhyaku kyuujuukyuu",
    ],
    [100_000_000, "一億", "いちおく", "ichioku"],
    [300_000_000, "三億", "さんおく", "san'oku"],
    [100_010_000, "一億一万", "いちおくいちまん", "ichioku ichiman"],
  ])("%i is %s, %s, %s", (n, written, kanaText, romaji) => {
    expect(readNumber(n)).toEqual({ written, kana: kanaText, romaji });
  });

  it("reads up to just under 1兆", () => {
    expect(kanjiNumber(NUMBER_MAX)).toBe(
      "九千九百九十九億九千九百九十九万九千九百九十九",
    );
  });
});

describe("readPrice", () => {
  it.each([
    [
      1980,
      "千九百八十円",
      "せんきゅうひゃくはちじゅうえん",
      "sen kyuuhyaku hachijuu en",
    ],
    [4, "四円", "よえん", "yo en"],
    [9, "九円", "きゅうえん", "kyuu en"],
    [14, "十四円", "じゅうよえん", "juuyo en"],
    [40, "四十円", "よんじゅうえん", "yonjuu en"],
    [540, "五百四十円", "ごひゃくよんじゅうえん", "gohyaku yonjuu en"],
    [1004, "千四円", "せんよえん", "sen yo en"],
    [10_000, "一万円", "いちまんえん", "ichiman en"],
    [40_000, "四万円", "よんまんえん", "yonman en"],
    [
      12_800,
      "一万二千八百円",
      "いちまんにせんはっぴゃくえん",
      "ichiman nisen happyaku en",
    ],
  ])("%i yen is %s, %s, %s", (n, written, kanaText, romaji) => {
    expect(readPrice(n)).toEqual({ written, kana: kanaText, romaji });
  });
});

describe("readTime", () => {
  it.each([
    [0, 0, "0時", "れいじ", "reiji"],
    [1, 1, "1時1分", "いちじいっぷん", "ichiji ippun"],
    [4, 3, "4時3分", "よじさんぷん", "yoji sanpun"],
    [7, 4, "7時4分", "しちじよんぷん", "shichiji yonpun"],
    [9, 6, "9時6分", "くじろっぷん", "kuji roppun"],
    [10, 8, "10時8分", "じゅうじはっぷん", "juuji happun"],
    [11, 10, "11時10分", "じゅういちじじゅっぷん", "juuichiji juppun"],
    [14, 15, "14時15分", "じゅうよじじゅうごふん", "juuyoji juugofun"],
    [15, 30, "15時30分", "じゅうごじさんじゅっぷん", "juugoji sanjuppun"],
    [17, 2, "17時2分", "じゅうしちじにふん", "juushichiji nifun"],
    [19, 45, "19時45分", "じゅうくじよんじゅうごふん", "juukuji yonjuugofun"],
    [20, 11, "20時11分", "にじゅうじじゅういっぷん", "nijuuji juuippun"],
    [
      23,
      59,
      "23時59分",
      "にじゅうさんじごじゅうきゅうふん",
      "nijuusanji gojuukyuufun",
    ],
  ])("%i:%i is %s, %s, %s", (h, m, written, kanaText, romaji) => {
    expect(readTime(h, m).clock).toEqual({ written, kana: kanaText, romaji });
  });

  it.each([
    [5, "ごふん"],
    [7, "ななふん"],
    [9, "きゅうふん"],
    [16, "じゅうろっぷん"],
    [18, "じゅうはっぷん"],
    [20, "にじゅっぷん"],
    [33, "さんじゅうさんぷん"],
    [40, "よんじゅっぷん"],
    [50, "ごじゅっぷん"],
    [54, "ごじゅうよんぷん"],
  ])("reads %i minutes as %s", (m, minute) => {
    expect(readTime(12, m).clock.kana).toBe(`じゅうにじ${minute}`);
  });

  it("gives the 12-hour form and half past", () => {
    const r = readTime(15, 30);
    expect(r.twelveHour).toEqual({
      written: "午後3時30分",
      kana: "ごごさんじさんじゅっぷん",
      romaji: "gogo sanji sanjuppun",
    });
    expect(r.half).toEqual({
      written: "午後3時半",
      kana: "ごごさんじはん",
      romaji: "gogo sanji han",
    });
    expect(readTime(9, 0).twelveHour).toEqual({
      written: "午前9時",
      kana: "ごぜんくじ",
      romaji: "gozen kuji",
    });
    expect(readTime(9, 0).half).toBeNull();
  });

  it("calls noon 正午 and keeps midnight at 午前0時", () => {
    expect(readTime(12, 0).twelveHour.written).toBe("正午");
    expect(readTime(12, 30).twelveHour.written).toBe("午後0時30分");
    expect(readTime(0, 0).twelveHour).toEqual({
      written: "午前0時",
      kana: "ごぜんれいじ",
      romaji: "gozen reiji",
    });
  });
});

// The readings a traveller hears, 1 to 10, for each counter.
const ONE_TO_TEN: Record<CounterId, string[]> = {
  tsu: [
    "ひとつ",
    "ふたつ",
    "みっつ",
    "よっつ",
    "いつつ",
    "むっつ",
    "ななつ",
    "やっつ",
    "ここのつ",
    "とお",
  ],
  ko: [
    "いっこ",
    "にこ",
    "さんこ",
    "よんこ",
    "ごこ",
    "ろっこ",
    "ななこ",
    "はっこ",
    "きゅうこ",
    "じゅっこ",
  ],
  nin: [
    "ひとり",
    "ふたり",
    "さんにん",
    "よにん",
    "ごにん",
    "ろくにん",
    "ななにん",
    "はちにん",
    "きゅうにん",
    "じゅうにん",
  ],
  mai: [
    "いちまい",
    "にまい",
    "さんまい",
    "よんまい",
    "ごまい",
    "ろくまい",
    "ななまい",
    "はちまい",
    "きゅうまい",
    "じゅうまい",
  ],
  hon: [
    "いっぽん",
    "にほん",
    "さんぼん",
    "よんほん",
    "ごほん",
    "ろっぽん",
    "ななほん",
    "はっぽん",
    "きゅうほん",
    "じゅっぽん",
  ],
  hai: [
    "いっぱい",
    "にはい",
    "さんばい",
    "よんはい",
    "ごはい",
    "ろっぱい",
    "ななはい",
    "はっぱい",
    "きゅうはい",
    "じゅっぱい",
  ],
  haku: [
    "いっぱく",
    "にはく",
    "さんぱく",
    "よんぱく",
    "ごはく",
    "ろっぱく",
    "ななはく",
    "はっぱく",
    "きゅうはく",
    "じゅっぱく",
  ],
  kai: [
    "いっかい",
    "にかい",
    "さんがい",
    "よんかい",
    "ごかい",
    "ろっかい",
    "ななかい",
    "はっかい",
    "きゅうかい",
    "じゅっかい",
  ],
};

const ONE_TO_TEN_ROMAJI: Record<CounterId, string[]> = {
  tsu: [
    "hitotsu",
    "futatsu",
    "mittsu",
    "yottsu",
    "itsutsu",
    "muttsu",
    "nanatsu",
    "yattsu",
    "kokonotsu",
    "too",
  ],
  ko: [
    "ikko",
    "niko",
    "sanko",
    "yonko",
    "goko",
    "rokko",
    "nanako",
    "hakko",
    "kyuuko",
    "jukko",
  ],
  nin: [
    "hitori",
    "futari",
    "sannin",
    "yonin",
    "gonin",
    "rokunin",
    "nananin",
    "hachinin",
    "kyuunin",
    "juunin",
  ],
  mai: [
    "ichimai",
    "nimai",
    "sanmai",
    "yonmai",
    "gomai",
    "rokumai",
    "nanamai",
    "hachimai",
    "kyuumai",
    "juumai",
  ],
  hon: [
    "ippon",
    "nihon",
    "sanbon",
    "yonhon",
    "gohon",
    "roppon",
    "nanahon",
    "happon",
    "kyuuhon",
    "juppon",
  ],
  hai: [
    "ippai",
    "nihai",
    "sanbai",
    "yonhai",
    "gohai",
    "roppai",
    "nanahai",
    "happai",
    "kyuuhai",
    "juppai",
  ],
  haku: [
    "ippaku",
    "nihaku",
    "sanpaku",
    "yonpaku",
    "gohaku",
    "roppaku",
    "nanahaku",
    "happaku",
    "kyuuhaku",
    "juppaku",
  ],
  kai: [
    "ikkai",
    "nikai",
    "sangai",
    "yonkai",
    "gokai",
    "rokkai",
    "nanakai",
    "hakkai",
    "kyuukai",
    "jukkai",
  ],
};

describe("readCounter", () => {
  it.each(COUNTER_IDS.map((id) => [id]))("reads 1 to 10 with %s", (id) => {
    const readings = ONE_TO_TEN[id].map(
      (_, i) => readCounter(id, i + 1).reading,
    );
    expect(readings.map(kana)).toEqual(ONE_TO_TEN[id]);
    expect(readings.map((r) => r.romaji)).toEqual(ONE_TO_TEN_ROMAJI[id]);
  });

  it.each([
    ["ko", 11, "じゅういっこ"],
    ["ko", 16, "じゅうろっこ"],
    ["ko", 20, "にじゅっこ"],
    ["ko", 100, "ひゃっこ"],
    ["ko", 300, "さんびゃっこ"],
    ["ko", 1000, "せんこ"],
    ["nin", 11, "じゅういちにん"],
    ["nin", 14, "じゅうよにん"],
    ["nin", 24, "にじゅうよにん"],
    ["nin", 100, "ひゃくにん"],
    ["hon", 13, "じゅうさんぼん"],
    ["hon", 14, "じゅうよんほん"],
    ["hon", 18, "じゅうはっぽん"],
    ["hon", 100, "ひゃっぽん"],
    ["hon", 600, "ろっぴゃっぽん"],
    ["hon", 1000, "せんぼん"],
    ["hon", 3000, "さんぜんぼん"],
    ["hon", 10_000, "いちまんぼん"],
    ["hai", 13, "じゅうさんばい"],
    ["hai", 20, "にじゅっぱい"],
    ["haku", 11, "じゅういっぱく"],
    ["haku", 13, "じゅうさんぱく"],
    ["haku", 14, "じゅうよんぱく"],
    ["kai", 11, "じゅういっかい"],
    ["kai", 13, "じゅうさんがい"],
    ["kai", 14, "じゅうよんかい"],
    ["kai", 20, "にじゅっかい"],
    ["mai", 100, "ひゃくまい"],
  ] as const)("reads %s %i as %s", (id, n, expected) => {
    expect(readCounter(id, n).reading.kana).toBe(expected);
  });

  it("writes native counts in kanji and the rest in digits", () => {
    expect(readCounter("tsu", 3).reading.written).toBe("三つ");
    expect(readCounter("tsu", 10).reading.written).toBe("十");
    expect(readCounter("mai", 2).reading.written).toBe("2枚");
    expect(readCounter("nin", 1200).reading.written).toBe("1,200人");
  });

  it("offers the other readings also heard", () => {
    expect(readCounter("haku", 4).alternatives.map(kana)).toEqual(["よんはく"]);
    expect(readCounter("hon", 10).alternatives.map(kana)).toEqual(["じっぽん"]);
    expect(readCounter("nin", 7).alternatives.map(kana)).toEqual(["しちにん"]);
    expect(readCounter("kai", 3).alternatives.map(kana)).toEqual(["さんかい"]);
    expect(readCounter("mai", 3).alternatives).toEqual([]);
  });
});

describe("parseWholeNumber", () => {
  it.each([
    ["1,980", 1980],
    ["1 980", 1980],
    ["1.980", 1980],
    ["12.800.000", 12_800_000],
    ["１，９８０", 1980],
    ["¥1,980", 1980],
    ["￥12,800", 12800],
    ["1980円", 1980],
    ["  0 ", 0],
  ])("reads %s as %i", (input, value) => {
    expect(parseWholeNumber(input)).toEqual({ status: "ok", value });
  });

  it("tells empty, invalid and out-of-range input apart", () => {
    expect(parseWholeNumber("")).toEqual({ status: "empty" });
    expect(parseWholeNumber("¥ ")).toEqual({ status: "empty" });
    expect(parseWholeNumber("12a")).toEqual({ status: "invalid" });
    expect(parseWholeNumber("1.5")).toEqual({ status: "invalid" });
    expect(parseWholeNumber("-3")).toEqual({ status: "invalid" });
    expect(parseWholeNumber("1000000000000")).toEqual({
      status: "range",
      min: 0,
      max: NUMBER_MAX,
    });
    expect(parseWholeNumber("99999999999999999999")).toMatchObject({
      status: "range",
    });
    expect(parseWholeNumber("0", 1, 10)).toEqual({
      status: "range",
      min: 1,
      max: 10,
    });
  });
});

describe("parseTime", () => {
  it.each([
    ["15:30", 15, 30],
    ["9:05", 9, 5],
    ["１５：３０", 15, 30],
    ["15.30", 15, 30],
    ["15時30分", 15, 30],
    ["15時", 15, 0],
    ["1530", 15, 30],
    ["930", 9, 30],
    ["7", 7, 0],
  ])("reads %s as %i:%i", (input, hour, minute) => {
    expect(parseTime(input)).toEqual({ status: "ok", hour, minute });
  });

  it("refuses what isn't a time", () => {
    expect(parseTime(" ")).toEqual({ status: "empty" });
    expect(parseTime("noon")).toEqual({ status: "invalid" });
    expect(parseTime("24:00")).toEqual({ status: "timeRange" });
    expect(parseTime("12:60")).toEqual({ status: "timeRange" });
  });
});

describe("readJapanese", () => {
  it("reads a price with its digits", () => {
    const result = readJapanese("price", "1980");
    expect(result).toMatchObject({ status: "ok", digits: "1,980円" });
  });

  it("reads a time in all its forms", () => {
    const result = readJapanese("time", "1530");
    expect(
      result.status === "ok" && result.readings.map((r) => r.kind),
    ).toEqual(["main", "twelveHour", "half"]);
  });

  it("keeps a counter within its range", () => {
    expect(readJapanese("counter", "11", "tsu")).toEqual({
      status: "range",
      min: 1,
      max: 10,
    });
    expect(readJapanese("counter", "0", "hon")).toMatchObject({
      status: "range",
    });
  });

  it("groups digits in threes", () => {
    expect(groupDigits(1234567)).toBe("1,234,567");
    expect(groupDigits(980)).toBe("980");
  });
});
