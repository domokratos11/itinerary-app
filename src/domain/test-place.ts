import { placeRecordDefaults, type PlaceRecord } from "./schemas";

// A place for tests. The sample trip has none.
export function testPlace(fields: Partial<PlaceRecord> = {}): PlaceRecord {
  return {
    id: "test-place",
    cityId: "tokyo-ueno",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Test+Place",
    name: "Test Place",
    lat: null,
    lng: null,
    category: "sight",
    purpose: null,
    description: null,
    tips: [],
    costEstimateJPY: null,
    durationMin: null,
    openingHours: null,
    closedDates: [],
    seasonFrom: null,
    seasonTo: null,
    priority: "want",
    verifiedAt: null,
    websiteUrl: null,
    notes: null,
    status: "researched",
    source: "catalog",
    ...placeRecordDefaults(),
    archived: false,
    updatedAt: "2026-10-29T00:00:00.000Z",
    ...fields,
  };
}
