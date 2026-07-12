export type HemisphereId = 'americas' | 'eurasia';

export interface HemisphereDef {
  id: HemisphereId;
  title: string;
  subtitle: string;
  /** SVG viewBox for zoomed hemisphere map (matches 900×400 world coords) */
  viewBox: string;
  countryIds: string[];
}

/** Nations grouped by theatre for mobile hemisphere navigation */
export const HEMISPHERES: Record<HemisphereId, HemisphereDef> = {
  americas: {
    id: 'americas',
    title: 'Americas',
    subtitle: 'North & South America',
    viewBox: '40 120 300 200',
    countryIds: ['usa'],
  },
  eurasia: {
    id: 'eurasia',
    title: 'Eurasia & Africa',
    subtitle: 'Europe, Middle East, Asia & Pacific',
    viewBox: '420 90 480 260',
    countryIds: [
      'england',
      'france',
      'germany',
      'russia',
      'ukraine',
      'turkey',
      'israel',
      'egypt',
      'saudi_arabia',
      'iran',
      'pakistan',
      'india',
      'china',
      'north_korea',
      'south_korea',
      'japan',
    ],
  },
};

export function getHemisphereForCountry(countryId: string): HemisphereId {
  return HEMISPHERES.americas.countryIds.includes(countryId) ? 'americas' : 'eurasia';
}

export function getCountriesInHemisphere(countryIds: string[], hemisphere: HemisphereId): string[] {
  const allowed = new Set(HEMISPHERES[hemisphere].countryIds);
  return countryIds.filter(id => allowed.has(id));
}
