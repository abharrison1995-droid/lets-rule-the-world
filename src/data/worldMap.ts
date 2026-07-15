/** Shared world-map coordinate system (SVG user space). */
export const WORLD_MAP_WIDTH = 1200;
export const WORLD_MAP_HEIGHT = 520;
export const WORLD_MAP_VIEWBOX = `0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`;

/** Short map labels to reduce overlap at full-world zoom. */
export const WORLD_MAP_SHORT_LABELS: Record<string, string> = {
  usa: 'USA',
  canada: 'Canada',
  mexico: 'Mexico',
  cuba: 'Cuba',
  colombia: 'Colombia',
  venezuela: 'Venezuela',
  brazil: 'Brazil',
  argentina: 'Argentina',
  chile: 'Chile',
  england: 'UK',
  france: 'France',
  germany: 'Germany',
  spain: 'Spain',
  italy: 'Italy',
  poland: 'Poland',
  sweden: 'Sweden',
  russia: 'Russia',
  ukraine: 'Ukraine',
  turkey: 'Turkey',
  israel: 'Israel',
  egypt: 'Egypt',
  algeria: 'Algeria',
  nigeria: 'Nigeria',
  ethiopia: 'Ethiopia',
  south_africa: 'S. Africa',
  saudi_arabia: 'Saudi',
  iraq: 'Iraq',
  uae: 'UAE',
  iran: 'Iran',
  pakistan: 'Pakistan',
  india: 'India',
  kazakhstan: 'Kazakhstan',
  china: 'China',
  vietnam: 'Vietnam',
  philippines: 'Philippines',
  indonesia: 'Indonesia',
  north_korea: 'N. Korea',
  south_korea: 'S. Korea',
  japan: 'Japan',
  australia: 'Australia',
  new_zealand: 'N. Zealand',
};

export function getWorldMapShortLabel(countryId: string, fallbackName: string): string {
  return WORLD_MAP_SHORT_LABELS[countryId] ?? fallbackName;
}
