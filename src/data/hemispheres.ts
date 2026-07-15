export type HemisphereId = 'americas' | 'eurasia';

export interface HemisphereDef {
  id: HemisphereId;
  title: string;
  subtitle: string;
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
      'peru',
      'ecuador',
      'bolivia',
      'uruguay',
      'paraguay',
    ],
  },
  eurasia: {
    id: 'eurasia',
    title: 'Eurasia, Africa & Pacific',
    subtitle: 'Europe, Africa, Middle East, Asia & Oceania',
    viewBox: '340 60 840 460',
    countryIds: [
      'england',
      'ireland',
      'france',
      'germany',
      'spain',
      'portugal',
      'italy',
      'netherlands',
      'belgium',
      'switzerland',
      'austria',
      'poland',
      'czechia',
      'sweden',
      'norway',
      'finland',
      'denmark',
      'greece',
      'romania',
      'belarus',
      'russia',
      'ukraine',
      'turkey',
      'israel',
      'syria',
      'jordan',
      'egypt',
      'algeria',
      'morocco',
      'libya',
      'nigeria',
      'ghana',
      'ethiopia',
      'kenya',
      'tanzania',
      'angola',
      'drc',
      'south_africa',
      'saudi_arabia',
      'iraq',
      'uae',
      'iran',
      'pakistan',
      'afghanistan',
      'india',
      'bangladesh',
      'kazakhstan',
      'uzbekistan',
      'mongolia',
      'china',
      'taiwan',
      'vietnam',
      'thailand',
      'myanmar',
      'malaysia',
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
