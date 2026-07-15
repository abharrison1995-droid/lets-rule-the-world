/** Shared world-map coordinate system (SVG user space). */
export const WORLD_MAP_WIDTH = 1200;
export const WORLD_MAP_HEIGHT = 520;
export const WORLD_MAP_VIEWBOX = `0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`;

/** Short map labels to reduce overlap at full-world zoom. */
export const WORLD_MAP_SHORT_LABELS: Record<string, string> = {
  usa: 'USA',
  england: 'UK',
  france: 'France',
  germany: 'Germany',
  russia: 'Russia',
  ukraine: 'Ukraine',
  turkey: 'Turkey',
  israel: 'Israel',
  egypt: 'Egypt',
  saudi_arabia: 'Saudi',
  iran: 'Iran',
  pakistan: 'Pakistan',
  india: 'India',
  china: 'China',
  north_korea: 'N. Korea',
  south_korea: 'S. Korea',
  japan: 'Japan',
  cuba: 'Cuba',
};

export function getWorldMapShortLabel(countryId: string, fallbackName: string): string {
  return WORLD_MAP_SHORT_LABELS[countryId] ?? fallbackName;
}
