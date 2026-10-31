// Google Maps browser key and Map ID. Like the Firebase config, these ship in
// the page and are not secrets: the key is protected by its website and API
// restrictions and by daily caps. See docs/maps-setup.md. While either is null
// the app works without the map and live details.
export const mapsConfig: { browserKey: string | null; mapId: string | null } = {
  browserKey: null,
  mapId: null,
};
