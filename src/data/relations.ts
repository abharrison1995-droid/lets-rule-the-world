/** Starting bilateral relations seeded from real-world alignments (2025-2026) */

const RELATION_PAIRS: Array<[string, string, number]> = [
  // USA relations
  ['usa', 'england', 85], ['usa', 'israel', 80], ['usa', 'japan', 75],
  ['usa', 'south_korea', 78], ['usa', 'france', 70], ['usa', 'germany', 65],
  ['usa', 'turkey', 45], ['usa', 'saudi_arabia', 60], ['usa', 'india', 55],
  ['usa', 'ukraine', 70], ['usa', 'russia', -75], ['usa', 'china', -40],
  ['usa', 'iran', -80], ['usa', 'north_korea', -90], ['usa', 'pakistan', 20],
  ['usa', 'egypt', 40],
  ['usa', 'cuba', -70],
  ['usa', 'canada', 88],
  ['usa', 'mexico', 55],
  ['usa', 'brazil', 45],
  ['usa', 'australia', 75],
  ['usa', 'poland', 70],
  ['usa', 'spain', 65],
  ['usa', 'italy', 68],
  ['usa', 'sweden', 72],
  ['usa', 'philippines', 60],
  ['usa', 'colombia', 40],
  ['usa', 'venezuela', -55],
  ['usa', 'iraq', 25],
  ['usa', 'uae', 55],
  ['usa', 'indonesia', 40],
  ['usa', 'vietnam', 35],
  ['usa', 'kazakhstan', 30],
  ['usa', 'nigeria', 30],
  ['usa', 'south_africa', 40],
  ['usa', 'argentina', 35],
  ['usa', 'chile', 50],
  ['usa', 'algeria', 15],
  ['usa', 'ethiopia', 25],
  ['usa', 'new_zealand', 70],

  // Russia relations
  ['russia', 'china', 60], ['russia', 'iran', 55], ['russia', 'india', 45],
  ['russia', 'turkey', 30], ['russia', 'ukraine', -90], ['russia', 'england', -60],
  ['russia', 'germany', -55], ['russia', 'france', -50], ['russia', 'israel', -20],
  ['russia', 'north_korea', 40], ['russia', 'pakistan', 25], ['russia', 'saudi_arabia', 15],
  ['russia', 'egypt', 35],
  ['russia', 'cuba', 45],

  // China relations
  ['china', 'pakistan', 70], ['china', 'iran', 50], ['china', 'north_korea', 55],
  ['china', 'russia', 60], ['china', 'india', -25], ['china', 'japan', -35],
  ['china', 'south_korea', 10], ['china', 'turkey', 25], ['china', 'saudi_arabia', 40],
  ['china', 'israel', 15], ['china', 'england', -15], ['china', 'germany', 10],
  ['china', 'france', 15],   ['china', 'egypt', 30],
  ['china', 'cuba', 35],

  // Iran relations
  ['iran', 'russia', 55], ['iran', 'china', 50], ['iran', 'pakistan', 35],
  ['iran', 'turkey', 15], ['iran', 'iraq', 40], ['iran', 'israel', -95],
  ['iran', 'saudi_arabia', -70], ['iran', 'usa', -80], ['iran', 'england', -55],
  ['iran', 'india', 20], ['iran', 'north_korea', 30],

  // Israel relations
  ['israel', 'usa', 80], ['israel', 'england', 55], ['israel', 'france', 40],
  ['israel', 'germany', 50], ['israel', 'turkey', -30], ['israel', 'iran', -95],
  ['israel', 'saudi_arabia', -20], ['israel', 'egypt', -15], ['israel', 'russia', -20],
  ['israel', 'china', 15], ['israel', 'india', 35],

  // India relations
  ['india', 'usa', 55], ['india', 'russia', 45], ['india', 'china', -25],
  ['india', 'pakistan', -80], ['india', 'iran', 20], ['india', 'israel', 35],
  ['india', 'england', 50], ['india', 'france', 40], ['india', 'japan', 45],
  ['india', 'turkey', 25], ['india', 'saudi_arabia', 30],

  // Pakistan relations
  ['pakistan', 'china', 70], ['pakistan', 'usa', 20], ['pakistan', 'india', -80],
  ['pakistan', 'iran', 35], ['pakistan', 'saudi_arabia', 55], ['pakistan', 'turkey', 40],
  ['pakistan', 'russia', 25], ['pakistan', 'england', 30],

  // Turkey relations
  ['turkey', 'usa', 45], ['turkey', 'russia', 30], ['turkey', 'iran', 15],
  ['turkey', 'israel', -30], ['turkey', 'saudi_arabia', 35], ['turkey', 'pakistan', 40],
  ['turkey', 'ukraine', 40], ['turkey', 'germany', 35], ['turkey', 'france', 25],
  ['turkey', 'england', 30], ['turkey', 'egypt', 20],

  // Korea relations
  ['north_korea', 'south_korea', -85], ['north_korea', 'usa', -90],
  ['north_korea', 'china', 55], ['north_korea', 'russia', 40], ['north_korea', 'japan', -70],
  ['south_korea', 'usa', 78], ['south_korea', 'japan', 25], ['south_korea', 'china', 10],
  ['south_korea', 'russia', -30], ['south_korea', 'north_korea', -85],

  // UK relations
  ['england', 'france', 55], ['england', 'germany', 50], ['england', 'india', 50],
  ['england', 'pakistan', 30], ['england', 'iran', -55], ['england', 'saudi_arabia', 45],
  ['england', 'egypt', 35], ['england', 'ukraine', 55],

  // European
  ['france', 'germany', 65], ['france', 'ukraine', 50],
  ['germany', 'ukraine', 55], ['germany', 'russia', -55],

  // Middle East
  ['saudi_arabia', 'usa', 60], ['saudi_arabia', 'pakistan', 55],
  ['saudi_arabia', 'egypt', 40], ['saudi_arabia', 'israel', -20],
  ['egypt', 'israel', -15], ['egypt', 'usa', 40],

  // Ukraine
  ['ukraine', 'russia', -90], ['ukraine', 'turkey', 40],
  ['ukraine', 'poland', 60],

  // Japan
  ['japan', 'south_korea', 25], ['japan', 'india', 45], ['japan', 'russia', -35],
  ['japan', 'australia', 55], ['japan', 'philippines', 40], ['japan', 'vietnam', 35],

  // Americas NPCs
  ['canada', 'mexico', 50], ['canada', 'england', 70], ['canada', 'france', 55],
  ['mexico', 'brazil', 35], ['brazil', 'argentina', 40], ['brazil', 'china', 45],
  ['argentina', 'chile', 45], ['colombia', 'venezuela', -25], ['venezuela', 'cuba', 55],
  ['venezuela', 'russia', 50], ['venezuela', 'china', 40],

  // Europe NPCs
  ['spain', 'france', 55], ['spain', 'italy', 50], ['italy', 'france', 55],
  ['italy', 'germany', 50], ['poland', 'germany', 50], ['poland', 'usa', 70],
  ['sweden', 'germany', 55], ['sweden', 'poland', 50],

  // Africa / ME / Asia NPCs
  ['algeria', 'egypt', 35], ['algeria', 'france', -15], ['nigeria', 'south_africa', 30],
  ['ethiopia', 'egypt', 20], ['iraq', 'iran', 40], ['iraq', 'saudi_arabia', -30],
  ['iraq', 'turkey', 25], ['uae', 'saudi_arabia', 65], ['uae', 'iran', -25],
  ['kazakhstan', 'russia', 55], ['kazakhstan', 'china', 45],
  ['vietnam', 'china', -20], ['vietnam', 'usa', 35], ['indonesia', 'china', 25],
  ['indonesia', 'australia', 40], ['philippines', 'china', -30],
  ['australia', 'new_zealand', 80], ['australia', 'china', -15], ['australia', 'india', 50],
];

export function relationKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function buildRelationsMatrix(): Record<string, number> {
  const matrix: Record<string, number> = {};
  for (const [a, b, value] of RELATION_PAIRS) {
    matrix[relationKey(a, b)] = value;
  }
  return matrix;
}

export function getRelation(
  matrix: Record<string, number>,
  a: string,
  b: string
): number {
  if (a === b) return 100;
  return matrix[relationKey(a, b)] ?? 0;
}

export function setRelation(
  matrix: Record<string, number>,
  a: string,
  b: string,
  value: number
): void {
  matrix[relationKey(a, b)] = Math.max(-100, Math.min(100, value));
}

export function modifyRelation(
  matrix: Record<string, number>,
  a: string,
  b: string,
  delta: number
): void {
  const current = getRelation(matrix, a, b);
  setRelation(matrix, a, b, current + delta);
}
