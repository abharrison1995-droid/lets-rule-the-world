/**
 * World-map silhouette geometry (1200×520).
 * Neighboring landmasses share border point chains so seams kiss instead of overlapping blobs.
 */

export type CoastDef = { path: string; label: [number, number] };

function poly(pts: Array<[number, number]>): string {
  if (pts.length < 3) return '';
  return `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
}

function reverse(pts: Array<[number, number]>): Array<[number, number]> {
  return [...pts].reverse();
}

function coast(pts: Array<[number, number]>, label: [number, number]): CoastDef {
  return { path: poly(pts), label };
}

// ── Shared land seams (always walked west→east or north→south as noted) ──

/** Canada south / USA north — west → east */
const SEAM_CAN_USA: Array<[number, number]> = [
  [92, 168],
  [118, 160],
  [148, 156],
  [178, 158],
  [205, 168],
  [222, 182],
  [228, 198],
];

/** USA south / Mexico north — west → east */
const SEAM_USA_MEX: Array<[number, number]> = [
  [98, 268],
  [125, 274],
  [152, 278],
  [178, 282],
  [198, 272],
  [210, 258],
];

/** Chile east / Argentina west — north → south */
const SEAM_CHL_ARG: Array<[number, number]> = [
  [300, 458],
  [305, 478],
  [308, 495],
  [310, 510],
];

/** Colombia east tip / Venezuela west tip — north → south */
const SEAM_COL_VEN: Array<[number, number]> = [
  [262, 348],
  [268, 362],
  [270, 378],
];

/** Spain north / France southwest — west → east */
const SEAM_ESP_FRA: Array<[number, number]> = [
  [398, 192],
  [412, 188],
  [425, 186],
  [438, 190],
];

/** France east / Germany southwest — south → north-ish */
const SEAM_FRA_DEU: Array<[number, number]> = [
  [458, 178],
  [462, 168],
  [465, 158],
  [468, 148],
];

/** France southeast / Italy northwest */
const SEAM_FRA_ITA: Array<[number, number]> = [
  [452, 198],
  [458, 205],
  [462, 214],
];

/** Germany east / Poland west — south → north */
const SEAM_DEU_POL: Array<[number, number]> = [
  [502, 162],
  [505, 148],
  [508, 135],
  [510, 122],
];

/** Poland southeast / Ukraine northwest */
const SEAM_POL_UKR: Array<[number, number]> = [
  [538, 148],
  [542, 155],
  [545, 162],
];

/** Ukraine east / Russia southwest */
const SEAM_UKR_RUS: Array<[number, number]> = [
  [555, 158],
  [560, 168],
  [562, 178],
  [558, 188],
];

/** Iraq west-ish / Saudi north — west → east */
const SEAM_IRQ_SAU: Array<[number, number]> = [
  [555, 288],
  [570, 292],
  [585, 295],
];

/** Iraq east / Iran west — north → south */
const SEAM_IRQ_IRN: Array<[number, number]> = [
  [590, 248],
  [595, 262],
  [598, 278],
  [592, 290],
];

/** Iran east / Pakistan west */
const SEAM_IRN_PAK: Array<[number, number]> = [
  [635, 258],
  [640, 272],
  [642, 288],
];

/** Pakistan east / India west — north → south */
const SEAM_PAK_IND: Array<[number, number]> = [
  [688, 248],
  [692, 268],
  [695, 288],
  [692, 308],
];

/** China northeast / N. Korea west */
const SEAM_CHN_NK: Array<[number, number]> = [
  [938, 178],
  [945, 188],
  [950, 200],
];

/** N. Korea south / S. Korea north */
const SEAM_NK_SK: Array<[number, number]> = [
  [958, 208],
  [972, 210],
  [985, 212],
];

/** China southeast / Vietnam north */
const SEAM_CHN_VNM: Array<[number, number]> = [
  [908, 288],
  [922, 292],
  [938, 298],
];

/** Russia south / Kazakhstan north — west → east */
const SEAM_RUS_KAZ: Array<[number, number]> = [
  [610, 162],
  [645, 158],
  [680, 160],
  [715, 165],
  [740, 168],
];

export const WORLD_COASTLINES: Record<string, CoastDef> = {
  // ── Americas ──
  canada: coast(
    [
      [88, 102],
      [115, 88],
      [150, 82],
      [185, 86],
      [215, 98],
      [228, 122],
      [232, 148],
      [225, 172],
      ...reverse(SEAM_CAN_USA),
      [100, 162],
      [85, 140],
      [82, 118],
    ],
    [155, 125]
  ),

  usa: coast(
    [
      ...SEAM_CAN_USA,
      [235, 212],
      [238, 232],
      [228, 250],
      ...reverse(SEAM_USA_MEX),
      [88, 252],
      [72, 228],
      [68, 205],
      [75, 185],
    ],
    [158, 225]
  ),

  mexico: coast(
    [
      ...SEAM_USA_MEX,
      [218, 278],
      [212, 302],
      [198, 325],
      [175, 342],
      [148, 348],
      [122, 340],
      [105, 318],
      [98, 295],
      [95, 275],
    ],
    [148, 310]
  ),

  cuba: coast(
    [
      [222, 302],
      [238, 294],
      [255, 292],
      [270, 298],
      [278, 310],
      [272, 322],
      [255, 328],
      [238, 326],
      [225, 318],
    ],
    [250, 312]
  ),

  colombia: coast(
    [
      [208, 348],
      [228, 342],
      [248, 345],
      ...SEAM_COL_VEN,
      [255, 392],
      [238, 402],
      [218, 398],
      [205, 380],
      [202, 362],
    ],
    [232, 372]
  ),

  venezuela: coast(
    [
      [270, 322],
      [292, 316],
      [318, 318],
      [332, 335],
      [328, 355],
      [310, 370],
      [288, 375],
      ...reverse(SEAM_COL_VEN),
    ],
    [302, 345]
  ),

  brazil: coast(
    [
      [318, 368],
      [348, 358],
      [382, 362],
      [408, 385],
      [415, 415],
      [405, 445],
      [375, 458],
      [342, 462],
      [318, 448],
      [305, 420],
      [302, 392],
    ],
    [360, 412]
  ),

  chile: coast(
    [
      [262, 422],
      [278, 418],
      [288, 425],
      [292, 445],
      ...SEAM_CHL_ARG,
      [298, 510],
      [285, 508],
      [272, 490],
      [265, 465],
      [260, 440],
    ],
    [278, 465]
  ),

  argentina: coast(
    [
      [312, 455],
      [338, 448],
      [362, 455],
      [370, 478],
      [365, 500],
      [348, 512],
      [322, 514],
      ...reverse(SEAM_CHL_ARG),
    ],
    [345, 485]
  ),

  // ── Europe ──
  sweden: coast(
    [
      [442, 68],
      [468, 58],
      [492, 62],
      [505, 78],
      [508, 98],
      [498, 115],
      [478, 118],
      [455, 112],
      [442, 95],
      [438, 80],
    ],
    [472, 88]
  ),

  england: coast(
    [
      [392, 118],
      [408, 110],
      [422, 112],
      [432, 125],
      [434, 140],
      [426, 154],
      [412, 160],
      [398, 156],
      [390, 142],
      [388, 128],
    ],
    [412, 138]
  ),

  spain: coast(
    [
      [348, 198],
      [368, 188],
      [388, 186],
      ...SEAM_ESP_FRA,
      [442, 205],
      [438, 228],
      [422, 245],
      [398, 250],
      [372, 245],
      [352, 228],
      [345, 210],
    ],
    [392, 218]
  ),

  france: coast(
    [
      ...SEAM_ESP_FRA,
      [448, 182],
      ...SEAM_FRA_DEU,
      [470, 155],
      [468, 175],
      [462, 192],
      ...SEAM_FRA_ITA,
      [448, 218],
      [432, 212],
      [418, 200],
    ],
    [440, 188]
  ),

  germany: coast(
    [
      [468, 128],
      [485, 122],
      [502, 125],
      ...reverse(SEAM_DEU_POL),
      [500, 168],
      [485, 175],
      [470, 172],
      ...reverse(SEAM_FRA_DEU),
    ],
    [488, 150]
  ),

  poland: coast(
    [
      ...SEAM_DEU_POL,
      [525, 118],
      [545, 122],
      [555, 135],
      [550, 148],
      ...SEAM_POL_UKR,
      [528, 158],
      [512, 155],
    ],
    [532, 138]
  ),

  italy: coast(
    [
      ...SEAM_FRA_ITA,
      [475, 198],
      [492, 195],
      [502, 210],
      [498, 228],
      [485, 245],
      [468, 248],
      [458, 235],
      [452, 220],
    ],
    [478, 222]
  ),

  ukraine: coast(
    [
      ...reverse(SEAM_POL_UKR),
      [548, 152],
      [558, 155],
      ...SEAM_UKR_RUS,
      [545, 195],
      [528, 198],
      [512, 188],
      [508, 172],
      [515, 160],
    ],
    [532, 175]
  ),

  // ── Russia / Central Asia ──
  russia: coast(
    [
      [555, 82],
      [595, 70],
      [655, 62],
      [715, 70],
      [760, 85],
      [798, 102],
      [818, 125],
      [812, 148],
      [785, 162],
      ...reverse(SEAM_RUS_KAZ),
      [585, 158],
      [568, 152],
      ...reverse(SEAM_UKR_RUS),
      [552, 148],
      [548, 120],
      [550, 98],
    ],
    [685, 118]
  ),

  kazakhstan: coast(
    [
      ...SEAM_RUS_KAZ,
      [748, 178],
      [735, 195],
      [700, 202],
      [655, 200],
      [622, 192],
      [608, 178],
    ],
    [670, 180]
  ),

  // ── Middle East / Africa hinge ──
  turkey: coast(
    [
      [505, 205],
      [528, 198],
      [555, 200],
      [572, 212],
      [575, 228],
      [562, 242],
      [538, 248],
      [515, 242],
      [502, 225],
    ],
    [538, 224]
  ),

  israel: coast(
    [
      [528, 258],
      [538, 252],
      [548, 254],
      [555, 262],
      [556, 272],
      [552, 280],
      [542, 282],
      [532, 278],
      [526, 268],
    ],
    [542, 268]
  ),

  iraq: coast(
    [
      [558, 232],
      [575, 226],
      [588, 232],
      ...SEAM_IRQ_IRN,
      ...reverse(SEAM_IRQ_SAU),
      [560, 275],
      [552, 255],
    ],
    [572, 255]
  ),

  iran: coast(
    [
      [575, 238],
      [600, 232],
      [625, 238],
      ...SEAM_IRN_PAK,
      [628, 295],
      [605, 302],
      [582, 295],
      ...reverse(SEAM_IRQ_IRN),
    ],
    [605, 268]
  ),

  saudi_arabia: coast(
    [
      ...SEAM_IRQ_SAU,
      [605, 300],
      [625, 318],
      [622, 345],
      [600, 362],
      [572, 365],
      [548, 352],
      [538, 328],
      [542, 305],
    ],
    [578, 335]
  ),

  uae: coast(
    [
      [612, 315],
      [628, 310],
      [642, 312],
      [652, 322],
      [655, 335],
      [648, 345],
      [632, 348],
      [618, 342],
      [610, 328],
    ],
    [633, 330]
  ),

  egypt: coast(
    [
      [472, 298],
      [498, 290],
      [522, 292],
      [538, 308],
      [535, 332],
      [518, 348],
      [492, 350],
      [472, 335],
      [465, 315],
    ],
    [502, 322]
  ),

  algeria: coast(
    [
      [392, 268],
      [420, 260],
      [448, 265],
      [462, 285],
      [458, 312],
      [438, 332],
      [408, 330],
      [388, 310],
      [385, 288],
    ],
    [425, 298]
  ),

  nigeria: coast(
    [
      [425, 352],
      [452, 345],
      [478, 350],
      [490, 372],
      [482, 398],
      [455, 412],
      [428, 408],
      [415, 385],
      [418, 365],
    ],
    [452, 380]
  ),

  ethiopia: coast(
    [
      [568, 368],
      [598, 360],
      [625, 368],
      [635, 392],
      [622, 415],
      [592, 420],
      [568, 408],
      [560, 385],
    ],
    [598, 392]
  ),

  south_africa: coast(
    [
      [532, 448],
      [565, 438],
      [598, 445],
      [612, 468],
      [605, 492],
      [575, 508],
      [542, 505],
      [522, 485],
      [525, 462],
    ],
    [568, 475]
  ),

  // ── South Asia ──
  pakistan: coast(
    [
      [638, 235],
      [665, 228],
      [682, 238],
      ...SEAM_PAK_IND,
      [678, 300],
      [655, 305],
      [638, 290],
      ...reverse(SEAM_IRN_PAK),
    ],
    [662, 265]
  ),

  india: coast(
    [
      ...SEAM_PAK_IND,
      [718, 255],
      [755, 268],
      [778, 295],
      [775, 330],
      [752, 358],
      [715, 365],
      [688, 350],
      [678, 320],
    ],
    [728, 312]
  ),

  // ── East Asia / Pacific ──
  china: coast(
    [
      [772, 182],
      [820, 168],
      [875, 172],
      [920, 185],
      ...SEAM_CHN_NK,
      [948, 215],
      [942, 245],
      [928, 272],
      ...SEAM_CHN_VNM,
      [890, 305],
      [848, 312],
      [805, 298],
      [775, 268],
      [762, 228],
      [765, 200],
    ],
    [860, 245]
  ),

  north_korea: coast(
    [
      ...SEAM_CHN_NK,
      [962, 172],
      [978, 178],
      [988, 192],
      [982, 208],
      ...reverse(SEAM_NK_SK),
      [952, 205],
    ],
    [968, 192]
  ),

  south_korea: coast(
    [
      ...SEAM_NK_SK,
      [998, 218],
      [1008, 235],
      [1000, 252],
      [982, 258],
      [962, 248],
      [955, 228],
    ],
    [982, 235]
  ),

  japan: coast(
    [
      [1028, 168],
      [1055, 158],
      [1078, 172],
      [1085, 198],
      [1072, 225],
      [1048, 238],
      [1025, 230],
      [1015, 205],
      [1018, 182],
    ],
    [1052, 200]
  ),

  vietnam: coast(
    [
      ...SEAM_CHN_VNM,
      [955, 308],
      [968, 328],
      [960, 352],
      [940, 362],
      [920, 355],
      [908, 335],
      [905, 312],
    ],
    [935, 335]
  ),

  philippines: coast(
    [
      [985, 272],
      [1010, 265],
      [1032, 275],
      [1038, 298],
      [1025, 322],
      [1002, 330],
      [982, 318],
      [975, 292],
    ],
    [1008, 298]
  ),

  indonesia: coast(
    [
      [798, 378],
      [845, 368],
      [895, 372],
      [940, 385],
      [948, 405],
      [925, 422],
      [870, 428],
      [820, 422],
      [795, 402],
    ],
    [875, 400]
  ),

  australia: coast(
    [
      [935, 428],
      [980, 415],
      [1035, 418],
      [1085, 438],
      [1092, 468],
      [1065, 492],
      [1010, 505],
      [955, 498],
      [925, 475],
      [922, 448],
    ],
    [1010, 458]
  ),

  new_zealand: coast(
    [
      [1105, 445],
      [1135, 435],
      [1162, 445],
      [1170, 468],
      [1155, 492],
      [1125, 500],
      [1100, 485],
      [1095, 462],
    ],
    [1135, 470]
  ),
};

export function getWorldCoastline(countryId: string): CoastDef | undefined {
  return WORLD_COASTLINES[countryId];
}

/** Land pairs that intentionally share a coastline seam (AABB overlap is expected). */
export const WORLD_LAND_NEIGHBORS: Array<[string, string]> = [
  ['canada', 'usa'],
  ['usa', 'mexico'],
  ['colombia', 'venezuela'],
  ['venezuela', 'brazil'],
  ['brazil', 'argentina'],
  ['chile', 'argentina'],
  ['spain', 'france'],
  ['england', 'france'],
  ['france', 'germany'],
  ['france', 'italy'],
  ['germany', 'poland'],
  ['poland', 'ukraine'],
  ['ukraine', 'russia'],
  ['russia', 'kazakhstan'],
  ['russia', 'china'],
  ['iraq', 'saudi_arabia'],
  ['iraq', 'iran'],
  ['iran', 'saudi_arabia'],
  ['iran', 'pakistan'],
  ['pakistan', 'india'],
  ['saudi_arabia', 'uae'],
  ['turkey', 'iraq'],
  ['china', 'india'],
  ['china', 'north_korea'],
  ['north_korea', 'south_korea'],
  ['china', 'vietnam'],
];

export function areWorldLandNeighbors(a: string, b: string): boolean {
  return WORLD_LAND_NEIGHBORS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a)
  );
}
