/** Equirectangular world map — viewBox 1000×500 (WGS84 simplified) */

export const WORLD_VIEWBOX = { width: 1000, height: 500 };

export interface WorldCountryShape {
  path: string;
  label: [number, number];
  labelShort?: string;
  /** Invisible click/hover target radius for tiny countries */
  hitRadius?: number;
}

export const MAP_BACKGROUNDS = {
  ocean: '#0c1929',
  graticule: '#1a2a3a',
  landmass: '#142032',
  continents: [
    'M 45,55 L 280,45 L 300,120 L 280,280 L 220,380 L 120,400 L 60,320 L 40,200 Z',
    'M 300,40 L 920,35 L 960,120 L 940,280 L 820,400 L 520,420 L 380,380 L 320,280 L 300,160 Z',
    'M 820,340 L 900,335 L 910,380 L 850,395 L 815,370 Z',
  ],
};

export const WORLD_COUNTRY_SHAPES: Record<string, WorldCountryShape> = {
  usa: {
    path: 'M 58,108 L 118,95 L 168,102 L 210,118 L 248,145 L 255,185 L 240,220 L 210,250 L 175,268 L 130,260 L 95,230 L 70,195 L 52,155 Z M 55,175 L 75,200 L 68,235 L 45,218 Z',
    label: [155, 175],
    labelShort: 'USA',
  },
  england: {
    path: 'M 468,108 L 478,98 L 492,102 L 498,118 L 492,132 L 478,138 L 465,128 Z',
    label: [482, 118],
    labelShort: 'UK',
    hitRadius: 12,
  },
  russia: {
    path: 'M 498,52 L 580,42 L 680,38 L 780,48 L 860,65 L 920,88 L 940,120 L 920,155 L 850,170 L 750,165 L 650,155 L 560,145 L 510,130 L 485,95 Z',
    label: [700, 95],
  },
  china: {
    path: 'M 668,145 L 720,135 L 768,142 L 800,165 L 810,200 L 795,235 L 760,255 L 710,260 L 665,245 L 640,210 L 645,175 Z',
    label: [725, 200],
  },
  turkey: {
    path: 'M 528,168 L 558,162 L 578,175 L 572,195 L 548,202 L 522,190 Z',
    label: [550, 182],
  },
  israel: {
    path: 'M 548,218 L 556,212 L 562,222 L 558,232 L 550,234 Z',
    label: [554, 224],
    hitRadius: 14,
  },
  india: {
    path: 'M 628,195 L 668,188 L 698,205 L 710,240 L 695,275 L 660,290 L 625,280 L 605,250 L 610,215 Z',
    label: [658, 242],
  },
  pakistan: {
    path: 'M 598,175 L 628,168 L 642,195 L 635,225 L 608,232 L 590,205 Z',
    label: [615, 200],
  },
  iran: {
    path: 'M 568,195 L 608,188 L 628,210 L 622,240 L 595,252 L 565,240 L 558,215 Z',
    label: [592, 220],
  },
  north_korea: {
    path: 'M 768,168 L 782,158 L 790,185 L 785,210 L 772,218 L 762,195 Z',
    label: [776, 188],
  },
  south_korea: {
    path: 'M 772,218 L 788,212 L 795,235 L 788,255 L 772,260 L 765,238 Z',
    label: [780, 238],
  },
  ukraine: {
    path: 'M 518,145 L 548,138 L 568,155 L 562,178 L 538,185 L 512,172 Z',
    label: [540, 162],
    hitRadius: 16,
  },
  france: {
    path: 'M 468,155 L 488,148 L 498,165 L 495,185 L 478,192 L 462,178 Z',
    label: [480, 170],
  },
  germany: {
    path: 'M 488,138 L 512,132 L 522,150 L 518,168 L 498,175 L 482,160 Z',
    label: [502, 155],
  },
  japan: {
    path: 'M 808,175 L 828,168 L 838,195 L 832,225 L 818,240 L 805,215 Z',
    label: [822, 205],
  },
  saudi_arabia: {
    path: 'M 548,235 L 598,228 L 628,245 L 635,275 L 620,305 L 585,315 L 555,300 L 538,270 Z',
    label: [585, 272],
  },
  egypt: {
    path: 'M 528,218 L 548,212 L 558,235 L 552,258 L 532,268 L 518,245 Z',
    label: [538, 242],
  },
};

export function getWorldShape(countryId: string): WorldCountryShape | undefined {
  return WORLD_COUNTRY_SHAPES[countryId];
}
