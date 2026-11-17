import type { CityBrief } from "@/domain/city-notes";

// A made-up city brief for tests only. Short on purpose; real notes come
// from the city research run (docs/city-research.md).
export const SAMPLE_BRIEF: CityBrief = {
  glance: {
    en: "A sample city on the coast, known for its castle and a grilled dish.",
    es: "Una ciudad de ejemplo en la costa, conocida por su castillo y un plato a la parrilla.",
  },
  timeline: [
    {
      when: "1600",
      text: {
        en: "A lord builds the castle and the town grows around it.",
        es: "Un señor construye el castillo y el pueblo crece a su alrededor.",
      },
    },
  ],
  moments: [
    {
      title: { en: "The great fire", es: "El gran incendio" },
      when: "1 Jan 1900",
      text: {
        en: "Most of the old town burned and was rebuilt in stone.",
        es: "Casi todo el casco antiguo se quemó y se reconstruyó en piedra.",
      },
      places: [{ name: "Sample Castle", placeId: null }],
    },
  ],
  traditions: [
    {
      name: { en: "Lantern night", es: "Noche de faroles" },
      text: {
        en: "Paper lanterns float on the river each summer.",
        es: "Cada verano flotan faroles de papel en el río.",
      },
    },
  ],
  food: [
    {
      name: {
        en: "Grilled sample cake",
        es: "Pastel de ejemplo a la parrilla",
      },
      japanese: "焼き見本",
      text: {
        en: "A savoury pancake of batter and cabbage, cooked on a hot plate.",
        es: "Una tortita salada de masa y repollo, cocinada en una plancha.",
      },
    },
  ],
  season: {
    en: "In winter the castle park is lit up every evening.",
    es: "En invierno el parque del castillo se ilumina cada noche.",
  },
  glossary: [
    {
      term: "teppan",
      japanese: "鉄板",
      text: {
        en: "The iron hot plate the pancake is cooked on.",
        es: "La plancha de hierro donde se cocina la tortita.",
      },
    },
  ],
  sources: [{ url: "https://example.com/sample-city", note: null }],
};
