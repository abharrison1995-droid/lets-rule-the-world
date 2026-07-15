export type HemisphereId = 'americas' | 'eurasia';

export interface HemisphereDef {
  id: HemisphereId;
  title: string;
  subtitle: string;
  /** SVG viewBox for zoomed hemisphere map */
  viewBox: string;
  countryIds: string[];
}

/** Nations grouped by theatre (strike range + geography). */
export const HEMISPHERES: Record<HemisphereId, HemisphereDef> = {
  americas: {
    id: 'americas',
    title: 'Americas',
    subtitle: 'North & South America',
    viewBox: '40 80 380 440',
    countryIds: [
      'usa',
      'canada',
      'mexico',
      'cuba',
      'colombia',
      'venezuela',
      'brazil',
      'argentina',
      'chile',
    ],
  },
  eurasia: {
    id: 'eurasia',
    title: 'Eurasia, Africa & Pacific',
    subtitle: 'Europe, Africa, Middle East, Asia & Oceania',
    viewBox: '340 60 840 460',
    countryIds: [
      'england',
      'france',
      'germany',
      'spain',
      'italy',
      'poland',
      'sweden',
      'russia',
      'ukraine',
      'turkey',
      'israel',
      'egypt',
      'algeria',
      'nigeria',
      'ethiopia',
      'south_africa',
      'saudi_arabia',
      'iraq',
      'uae',
      'iran',
      'pakistan',
      'india',
      'kazakhstan',
      'china',
      'vietnam',
      'philippines',
      'indonesia',
      'north_korea',
      'south_korea',
      'japan',
      'australia',
      'new_zealand',
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
