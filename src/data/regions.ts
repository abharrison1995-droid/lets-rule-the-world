import type { Region } from '../types/game';

function r(
  id: string, countryId: string, name: string, neighbours: string[],
  terrain: Region['terrain'], pop: number, industry: number,
  troops: number, path: string, center: [number, number],
  defenseRating = 0
): Region {
  return {
    id, countryId, name, neighbours, terrain,
    population: pop, industryValue: industry,
    garrison: {
      troops,
      defenseSystems: defenseRating > 0
        ? [{ id: `${id}-ads`, type: 'generic', rating: defenseRating }]
        : [],
    },
    controlledBy: countryId,
    unrest: 0,
    fortificationLevel: 0,
    facilities: [],
    mapPath: path,
    center,
  };
}

export const REGIONS: Record<string, Region> = {
  // USA — 8 regions
  ...Object.fromEntries([
    r('usa_ne', 'usa', 'Northeast', ['usa_mid_atlantic', 'usa_great_lakes'], 'urban', 58000000, 2800, 15000,
      'M 200,80 L 280,75 L 290,120 L 250,140 L 200,130 Z', [245, 105], 2),
    r('usa_mid_atlantic', 'usa', 'Mid-Atlantic', ['usa_ne', 'usa_southeast', 'usa_great_lakes'], 'urban', 42000000, 1800, 12000,
      'M 200,130 L 250,140 L 260,180 L 220,190 L 190,160 Z', [225, 160]),
    r('usa_southeast', 'usa', 'Southeast', ['usa_mid_atlantic', 'usa_southwest', 'usa_great_lakes', 'cuba_west'], 'coastal', 65000000, 2200, 18000,
      'M 190,160 L 220,190 L 240,240 L 200,250 L 170,210 Z', [205, 210]),
    r('usa_great_lakes', 'usa', 'Great Lakes', ['usa_ne', 'usa_mid_atlantic', 'usa_southeast', 'usa_plains'], 'urban', 48000000, 2400, 14000,
      'M 170,130 L 200,130 L 190,160 L 160,170 L 140,150 Z', [170, 150]),
    r('usa_plains', 'usa', 'Great Plains', ['usa_great_lakes', 'usa_southeast', 'usa_southwest', 'usa_rockies'], 'plains', 22000000, 900, 8000,
      'M 100,140 L 170,130 L 170,210 L 130,220 L 90,180 Z', [130, 175]),
    r('usa_southwest', 'usa', 'Southwest', ['usa_southeast', 'usa_plains', 'usa_rockies', 'usa_west_coast'], 'desert', 38000000, 1600, 12000,
      'M 130,220 L 170,210 L 160,270 L 120,280 L 100,250 Z', [140, 245]),
    r('usa_rockies', 'usa', 'Rocky Mountains', ['usa_plains', 'usa_southwest', 'usa_west_coast'], 'mountain', 18000000, 700, 6000,
      'M 90,180 L 130,220 L 120,280 L 80,270 L 70,210 Z', [100, 235]),
    r('usa_west_coast', 'usa', 'West Coast', ['usa_southwest', 'usa_rockies'], 'coastal', 52000000, 3500, 16000,
      'M 50,180 L 90,180 L 80,270 L 40,260 L 30,200 Z', [60, 225], 3),
  ].map(reg => [reg.id, reg])),

  // Russia — 10 regions
  ...Object.fromEntries([
    r('rus_west', 'russia', 'Western Russia', ['rus_central', 'rus_south', 'ukr_east'], 'plains', 28000000, 1200, 45000,
      'M 80,100 L 160,90 L 170,150 L 120,160 L 70,140 Z', [120, 125]),
    r('rus_central', 'russia', 'Central Russia', ['rus_west', 'rus_volga', 'rus_ural'], 'plains', 35000000, 1500, 30000,
      'M 120,160 L 170,150 L 180,200 L 140,210 L 100,190 Z', [145, 180]),
    r('rus_volga', 'russia', 'Volga Region', ['rus_west', 'rus_central', 'rus_south', 'rus_ural'], 'plains', 30000000, 1100, 25000,
      'M 140,210 L 180,200 L 190,250 L 150,260 L 120,240 Z', [160, 235]),
    r('rus_south', 'russia', 'Southern Russia', ['rus_west', 'rus_volga', 'ukr_east'], 'plains', 25000000, 800, 35000,
      'M 100,190 L 140,210 L 120,240 L 80,230 L 70,200 Z', [105, 215]),
    r('rus_ural', 'russia', 'Ural Mountains', ['rus_central', 'rus_volga', 'rus_siberia_w'], 'mountain', 12000000, 600, 15000,
      'M 180,200 L 220,190 L 230,250 L 190,260 L 150,250 Z', [195, 225]),
    r('rus_siberia_w', 'russia', 'Western Siberia', ['rus_ural', 'rus_siberia_c'], 'plains', 18000000, 500, 12000,
      'M 230,190 L 300,180 L 310,240 L 260,250 L 230,250 Z', [270, 215]),
    r('rus_siberia_c', 'russia', 'Central Siberia', ['rus_siberia_w', 'rus_far_east'], 'mountain', 8000000, 300, 8000,
      'M 300,180 L 380,170 L 390,230 L 340,240 L 310,240 Z', [350, 205]),
    r('rus_far_east', 'russia', 'Russian Far East', ['rus_siberia_c'], 'coastal', 6000000, 400, 20000,
      'M 380,170 L 450,160 L 460,220 L 420,230 L 390,230 Z', [420, 195]),
    r('rus_arctic', 'russia', 'Arctic Zone', ['rus_west', 'rus_central', 'rus_siberia_w'], 'mountain', 2000000, 200, 5000,
      'M 80,60 L 300,50 L 310,90 L 160,100 L 70,90 Z', [190, 75]),
    r('rus_crimea', 'russia', 'Crimea', ['rus_south', 'ukr_south'], 'coastal', 2500000, 150, 15000,
      'M 80,230 L 110,225 L 115,250 L 85,255 Z', [98, 240]),
  ].map(reg => [reg.id, reg])),

  // Ukraine — 6 regions (non-playable, front-line context)
  ...Object.fromEntries([
    r('ukr_west', 'ukraine', 'Western Ukraine', ['ukr_central', 'rus_west'], 'plains', 8000000, 300, 25000,
      'M 60,120 L 90,115 L 95,150 L 70,155 Z', [78, 135]),
    r('ukr_central', 'ukraine', 'Central Ukraine', ['ukr_west', 'ukr_east', 'ukr_south'], 'plains', 12000000, 400, 30000,
      'M 70,155 L 95,150 L 100,185 L 75,190 Z', [85, 170]),
    r('ukr_east', 'ukraine', 'Eastern Ukraine', ['ukr_central', 'rus_west', 'rus_south'], 'urban', 6000000, 500, 40000,
      'M 95,150 L 120,145 L 125,180 L 100,185 Z', [110, 165]),
    r('ukr_south', 'ukraine', 'Southern Ukraine', ['ukr_central', 'rus_crimea', 'rus_south'], 'coastal', 5000000, 250, 20000,
      'M 75,190 L 100,185 L 105,220 L 80,225 Z', [90, 203]),
    r('ukr_north', 'ukraine', 'Northern Ukraine', ['ukr_west', 'ukr_central'], 'plains', 4000000, 200, 15000,
      'M 60,100 L 90,100 L 95,130 L 65,135 Z', [78, 118]),
    r('ukr_kyiv', 'ukraine', 'Kyiv Region', ['ukr_central', 'ukr_north', 'ukr_west'], 'urban', 4000000, 350, 20000,
      'M 65,135 L 95,130 L 95,150 L 70,155 Z', [80, 143]),
  ].map(reg => [reg.id, reg])),

  // China — 8 regions
  ...Object.fromEntries([
    r('chn_east', 'china', 'Eastern China', ['chn_central', 'chn_south', 'chn_northeast'], 'coastal', 450000000, 8000, 200000,
      'M 300,180 L 380,175 L 390,220 L 340,230 L 300,210 Z', [345, 200]),
    r('chn_central', 'china', 'Central China', ['chn_east', 'chn_west', 'chn_south', 'chn_northeast'], 'plains', 350000000, 4000, 150000,
      'M 280,210 L 340,230 L 330,270 L 280,280 L 260,240 Z', [305, 248]),
    r('chn_south', 'china', 'Southern China', ['chn_east', 'chn_central', 'chn_southwest'], 'coastal', 200000000, 3500, 120000,
      'M 280,280 L 330,270 L 340,310 L 290,320 L 270,295 Z', [305, 295]),
    r('chn_northeast', 'china', 'Northeast China', ['chn_east', 'chn_central', 'nk_north'], 'plains', 110000000, 2000, 80000,
      'M 380,175 L 420,165 L 430,200 L 390,210 Z', [405, 188]),
    r('chn_northwest', 'china', 'Northwest China', ['chn_west', 'chn_central'], 'desert', 50000000, 800, 60000,
      'M 200,200 L 260,190 L 270,240 L 220,250 L 190,220 Z', [235, 218]),
    r('chn_southwest', 'china', 'Southwest China', ['chn_central', 'chn_south', 'chn_west'], 'mountain', 120000000, 1500, 90000,
      'M 240,250 L 280,280 L 270,320 L 230,310 L 220,270 Z', [255, 288]),
    r('chn_west', 'china', 'Western China', ['chn_northwest', 'chn_southwest', 'chn_central'], 'mountain', 40000000, 500, 80000,
      'M 160,200 L 200,200 L 220,270 L 180,280 L 150,240 Z', [185, 240]),
    r('chn_tibet', 'china', 'Tibet', ['chn_west', 'chn_southwest', 'ind_north'], 'mountain', 3000000, 100, 30000,
      'M 180,280 L 220,270 L 210,310 L 170,320 Z', [195, 295]),
  ].map(reg => [reg.id, reg])),

  // Israel — 5 regions
  ...Object.fromEntries([
    r('isr_center', 'israel', 'Central Israel', ['isr_north', 'isr_south', 'isr_west_bank'], 'urban', 4500000, 400, 25000,
      'M 120,120 L 160,115 L 165,150 L 140,155 L 115,140 Z', [140, 135], 5),
    r('isr_north', 'israel', 'Northern Israel', ['isr_center', 'isr_golan'], 'coastal', 1500000, 150, 15000,
      'M 115,90 L 160,85 L 165,115 L 120,120 Z', [140, 102], 4),
    r('isr_south', 'israel', 'Southern Israel', ['isr_center', 'isr_negev'], 'desert', 1200000, 80, 10000,
      'M 115,140 L 140,155 L 135,190 L 110,185 Z', [125, 165], 3),
    r('isr_golan', 'israel', 'Golan Heights', ['isr_north'], 'mountain', 50000, 20, 8000,
      'M 160,85 L 190,80 L 195,110 L 165,115 Z', [177, 97], 3),
    r('isr_west_bank', 'israel', 'West Bank', ['isr_center', 'isr_south'], 'mountain', 3000000, 50, 8000,
      'M 140,155 L 165,150 L 170,175 L 145,180 Z', [155, 165], 1),
    r('isr_negev', 'israel', 'Negev', ['isr_south'], 'desert', 700000, 50, 5000,
      'M 110,185 L 135,190 L 130,220 L 105,215 Z', [118, 202], 2),
  ].map(reg => [reg.id, reg])),

  // Iran — 7 regions
  ...Object.fromEntries([
    r('irn_tehran', 'iran', 'Tehran Region', ['irn_north', 'irn_central', 'irn_west'], 'urban', 15000000, 500, 30000,
      'M 200,80 L 240,75 L 245,110 L 210,115 Z', [222, 95]),
    r('irn_north', 'iran', 'Northern Iran', ['irn_tehran', 'irn_west'], 'mountain', 8000000, 200, 20000,
      'M 180,50 L 240,45 L 245,75 L 200,80 Z', [215, 62]),
    r('irn_west', 'iran', 'Western Iran', ['irn_tehran', 'irn_north', 'irn_southwest', 'irn_central'], 'mountain', 10000000, 300, 25000,
      'M 160,80 L 200,80 L 210,115 L 175,120 Z', [188, 98]),
    r('irn_central', 'iran', 'Central Iran', ['irn_tehran', 'irn_west', 'irn_east', 'irn_south'], 'desert', 5000000, 150, 15000,
      'M 210,115 L 245,110 L 250,150 L 215,155 Z', [230, 132]),
    r('irn_east', 'iran', 'Eastern Iran', ['irn_central', 'irn_south', 'pak_balochistan'], 'desert', 6000000, 100, 18000,
      'M 250,110 L 300,105 L 305,150 L 250,150 Z', [275, 128]),
    r('irn_south', 'iran', 'Southern Iran', ['irn_central', 'irn_east', 'irn_southwest'], 'coastal', 12000000, 600, 22000,
      'M 215,155 L 250,150 L 260,190 L 220,195 Z', [238, 172]),
    r('irn_southwest', 'iran', 'Khuzestan', ['irn_west', 'irn_south'], 'coastal', 5000000, 400, 20000,
      'M 175,120 L 210,115 L 215,155 L 180,160 Z', [195, 138]),
  ].map(reg => [reg.id, reg])),

  // India — 8 regions
  ...Object.fromEntries([
    r('ind_north', 'india', 'Northern India', ['ind_central', 'ind_east', 'chn_tibet', 'pak_punjab'], 'plains', 300000000, 2000, 180000,
      'M 180,60 L 240,55 L 250,100 L 200,105 Z', [215, 80]),
    r('ind_central', 'india', 'Central India', ['ind_north', 'ind_south', 'ind_west', 'ind_east'], 'plains', 250000000, 1500, 150000,
      'M 200,105 L 250,100 L 260,150 L 210,155 Z', [230, 128]),
    r('ind_south', 'india', 'Southern India', ['ind_central', 'ind_west', 'ind_east'], 'coastal', 280000000, 2500, 120000,
      'M 210,155 L 260,150 L 270,200 L 220,205 Z', [240, 175]),
    r('ind_west', 'india', 'Western India', ['ind_central', 'ind_south', 'ind_north', 'pak_sindh'], 'coastal', 200000000, 2200, 100000,
      'M 150,100 L 200,105 L 210,155 L 170,160 Z', [180, 130]),
    r('ind_east', 'india', 'Eastern India', ['ind_north', 'ind_central', 'ind_south'], 'plains', 220000000, 1200, 130000,
      'M 250,100 L 300,95 L 310,150 L 260,150 Z', [275, 123]),
    r('ind_northeast', 'india', 'Northeast India', ['ind_east', 'ind_north'], 'mountain', 50000000, 300, 60000,
      'M 300,80 L 340,75 L 345,110 L 305,115 Z', [322, 95]),
    r('ind_kashmir', 'india', 'Kashmir', ['ind_north', 'pak_punjab'], 'mountain', 12000000, 50, 40000,
      'M 180,30 L 220,25 L 225,55 L 185,60 Z', [202, 42]),
    r('ind_andaman', 'india', 'Andaman Islands', [], 'coastal', 400000, 10, 2000,
      'M 340,170 L 360,168 L 362,185 L 342,188 Z', [351, 177]),
  ].map(reg => [reg.id, reg])),

  // Pakistan — 6 regions
  ...Object.fromEntries([
    r('pak_punjab', 'pakistan', 'Punjab', ['pak_sindh', 'pak_kpk', 'ind_north', 'ind_kashmir'], 'plains', 110000000, 400, 35000,
      'M 160,60 L 200,55 L 205,90 L 165,95 Z', [182, 73]),
    r('pak_sindh', 'pakistan', 'Sindh', ['pak_punjab', 'pak_balochistan', 'ind_west'], 'coastal', 50000000, 300, 25000,
      'M 140,90 L 165,95 L 170,130 L 145,135 Z', [155, 112]),
    r('pak_kpk', 'pakistan', 'Khyber Pakhtunkhwa', ['pak_punjab', 'pak_balochistan'], 'mountain', 35000000, 100, 30000,
      'M 165,55 L 200,50 L 205,80 L 170,85 Z', [185, 67]),
    r('pak_balochistan', 'pakistan', 'Balochistan', ['pak_sindh', 'pak_kpk', 'irn_east'], 'desert', 15000000, 80, 20000,
      'M 120,80 L 170,80 L 175,130 L 130,135 Z', [148, 105]),
    r('pak_ict', 'pakistan', 'Islamabad Capital', ['pak_punjab', 'pak_kpk'], 'urban', 12000000, 150, 15000,
      'M 175,70 L 195,68 L 198,85 L 178,88 Z', [186, 77]),
    r('pak_azad_kashmir', 'pakistan', 'Azad Kashmir', ['pak_punjab', 'ind_kashmir'], 'mountain', 4000000, 20, 12000,
      'M 185,40 L 210,38 L 212,55 L 188,58 Z', [199, 47]),
  ].map(reg => [reg.id, reg])),

  // England — 5 regions
  ...Object.fromEntries([
    r('eng_london', 'england', 'London & SE', ['eng_midlands', 'eng_east'], 'urban', 18000000, 900, 8000,
      'M 200,180 L 250,175 L 255,210 L 210,215 Z', [227, 193]),
    r('eng_midlands', 'england', 'Midlands', ['eng_london', 'eng_north', 'eng_west'], 'urban', 12000000, 500, 5000,
      'M 180,160 L 220,155 L 225,185 L 185,190 Z', [202, 172]),
    r('eng_north', 'england', 'Northern England', ['eng_midlands', 'eng_west'], 'plains', 15000000, 400, 6000,
      'M 170,130 L 210,125 L 215,160 L 175,165 Z', [192, 147]),
    r('eng_west', 'england', 'South West', ['eng_midlands', 'eng_north'], 'coastal', 6000000, 300, 4000,
      'M 150,160 L 185,155 L 190,190 L 155,195 Z', [170, 173]),
    r('eng_east', 'england', 'East Anglia', ['eng_london', 'eng_midlands'], 'coastal', 7000000, 350, 3500,
      'M 230,170 L 270,165 L 275,200 L 235,205 Z', [252, 185]),
  ].map(reg => [reg.id, reg])),

  // Turkey — 6 regions
  ...Object.fromEntries([
    r('tur_marmara', 'turkey', 'Marmara', ['tur_aegean', 'tur_central', 'tur_black_sea'], 'urban', 25000000, 600, 35000,
      'M 100,80 L 150,75 L 155,110 L 110,115 Z', [128, 93]),
    r('tur_aegean', 'turkey', 'Aegean', ['tur_marmara', 'tur_mediterranean', 'tur_central'], 'coastal', 12000000, 350, 20000,
      'M 80,110 L 110,115 L 115,150 L 85,155 Z', [98, 132]),
    r('tur_central', 'turkey', 'Central Anatolia', ['tur_marmara', 'tur_aegean', 'tur_east', 'tur_mediterranean'], 'plains', 15000000, 400, 25000,
      'M 110,115 L 155,110 L 160,150 L 120,155 Z', [135, 132]),
    r('tur_mediterranean', 'turkey', 'Mediterranean', ['tur_aegean', 'tur_central', 'tur_east'], 'coastal', 10000000, 300, 18000,
      'M 85,155 L 120,155 L 125,190 L 90,195 Z', [105, 173]),
    r('tur_east', 'turkey', 'Eastern Anatolia', ['tur_central', 'tur_mediterranean', 'tur_black_sea'], 'mountain', 8000000, 150, 30000,
      'M 155,110 L 210,105 L 215,150 L 160,155 Z', [185, 128]),
    r('tur_black_sea', 'turkey', 'Black Sea', ['tur_marmara', 'tur_east'], 'coastal', 9000000, 250, 15000,
      'M 150,55 L 210,50 L 215,90 L 155,95 Z', [182, 72]),
  ].map(reg => [reg.id, reg])),

  // North Korea — 5 regions
  ...Object.fromEntries([
    r('nk_pyongyang', 'north_korea', 'Pyongyang', ['nk_west', 'nk_east'], 'urban', 3000000, 80, 40000,
      'M 150,100 L 190,95 L 195,130 L 155,135 Z', [172, 115]),
    r('nk_west', 'north_korea', 'West Coast', ['nk_pyongyang', 'nk_south', 'sk_northwest'], 'coastal', 5000000, 50, 30000,
      'M 120,110 L 155,110 L 160,150 L 125,155 Z', [140, 130]),
    r('nk_east', 'north_korea', 'East Coast', ['nk_pyongyang', 'nk_north'], 'coastal', 4000000, 40, 25000,
      'M 195,95 L 240,90 L 245,130 L 200,135 Z', [220, 112]),
    r('nk_north', 'north_korea', 'Northern Border', ['nk_east', 'chn_northeast'], 'mountain', 2000000, 20, 20000,
      'M 180,60 L 240,55 L 245,90 L 185,95 Z', [212, 73]),
    r('nk_south', 'north_korea', 'DMZ Region', ['nk_west', 'sk_northwest'], 'mountain', 3000000, 30, 50000,
      'M 125,155 L 160,150 L 165,175 L 130,180 Z', [147, 165]),
  ].map(reg => [reg.id, reg])),

  // South Korea — 5 regions
  ...Object.fromEntries([
    r('sk_seoul', 'south_korea', 'Seoul Metro', ['sk_northwest', 'sk_central'], 'urban', 26000000, 800, 20000,
      'M 140,120 L 180,115 L 185,150 L 145,155 Z', [162, 135]),
    r('sk_northwest', 'south_korea', 'Northwest', ['sk_seoul', 'sk_central', 'nk_south', 'nk_west'], 'coastal', 8000000, 300, 15000,
      'M 120,140 L 145,140 L 150,170 L 125,175 Z', [135, 155]),
    r('sk_central', 'south_korea', 'Central Korea', ['sk_seoul', 'sk_northwest', 'sk_south', 'sk_east'], 'plains', 10000000, 400, 12000,
      'M 145,155 L 185,150 L 190,185 L 150,190 Z', [167, 170]),
    r('sk_south', 'south_korea', 'Southern Korea', ['sk_central', 'sk_east'], 'coastal', 12000000, 500, 10000,
      'M 150,190 L 190,185 L 195,220 L 155,225 Z', [172, 205]),
    r('sk_east', 'south_korea', 'Eastern Coast', ['sk_central', 'sk_south'], 'coastal', 5000000, 200, 8000,
      'M 190,150 L 230,145 L 235,200 L 195,205 Z', [212, 173]),
  ].map(reg => [reg.id, reg])),

  // Japan — 4 regions (NPC)
  ...Object.fromEntries([
    r('jpn_kanto', 'japan', 'Kanto', ['jpn_chubu'], 'urban', 44000000, 1800, 12000,
      'M 200,120 L 250,115 L 255,155 L 210,160 Z', [228, 138]),
    r('jpn_kansai', 'japan', 'Kansai', ['jpn_chubu', 'jpn_kyushu'], 'urban', 20000000, 900, 8000,
      'M 170,160 L 210,155 L 215,190 L 175,195 Z', [193, 173]),
    r('jpn_chubu', 'japan', 'Chubu', ['jpn_kanto', 'jpn_kansai'], 'coastal', 10000000, 600, 6000,
      'M 210,155 L 255,150 L 260,180 L 215,185 Z', [235, 168]),
    r('jpn_kyushu', 'japan', 'Kyushu', ['jpn_kansai'], 'coastal', 14000000, 500, 5000,
      'M 150,190 L 175,185 L 180,220 L 155,225 Z', [165, 205]),
  ].map(reg => [reg.id, reg])),

  // France — 4 regions (NPC)
  ...Object.fromEntries([
    r('fra_ile', 'france', 'Île-de-France', ['fra_north', 'fra_south'], 'urban', 12000000, 700, 8000,
      'M 180,100 L 220,95 L 225,130 L 185,135 Z', [203, 115]),
    r('fra_south', 'france', 'Southern France', ['fra_ile', 'fra_west'], 'coastal', 8000000, 400, 5000,
      'M 185,135 L 225,130 L 230,170 L 190,175 Z', [208, 153]),
    r('fra_north', 'france', 'Northern France', ['fra_ile', 'fra_west'], 'plains', 9000000, 450, 6000,
      'M 180,70 L 220,65 L 225,95 L 185,100 Z', [203, 82]),
    r('fra_west', 'france', 'Western France', ['fra_south', 'fra_north'], 'coastal', 6000000, 300, 4000,
      'M 150,100 L 185,95 L 190,135 L 155,140 Z', [172, 118]),
  ].map(reg => [reg.id, reg])),

  // Germany — 4 regions (NPC)
  ...Object.fromEntries([
    r('deu_west', 'germany', 'Western Germany', ['deu_south', 'deu_north'], 'urban', 18000000, 900, 7000,
      'M 180,90 L 220,85 L 225,120 L 185,125 Z', [203, 105]),
    r('deu_south', 'germany', 'Southern Germany', ['deu_west', 'deu_east'], 'plains', 16000000, 800, 6000,
      'M 185,125 L 225,120 L 230,160 L 190,165 Z', [208, 143]),
    r('deu_north', 'germany', 'Northern Germany', ['deu_west', 'deu_east'], 'coastal', 12000000, 600, 5000,
      'M 180,55 L 220,50 L 225,85 L 185,90 Z', [203, 70]),
    r('deu_east', 'germany', 'Eastern Germany', ['deu_south', 'deu_north'], 'plains', 8000000, 400, 4000,
      'M 225,85 L 265,80 L 270,120 L 230,125 Z', [248, 103]),
  ].map(reg => [reg.id, reg])),

  // Cuba — 3 regions (NPC / Campaign Mission 1)
  ...Object.fromEntries([
    r('cuba_west', 'cuba', 'Western Cuba', ['cuba_central', 'usa_southeast'], 'coastal', 3500000, 120, 4500,
      'M 80,200 L 140,195 L 145,230 L 85,235 Z', [112, 215], 1),
    r('cuba_central', 'cuba', 'Central Cuba', ['cuba_west', 'cuba_east'], 'plains', 4200000, 140, 5000,
      'M 140,195 L 200,190 L 205,230 L 145,235 Z', [172, 212]),
    r('cuba_east', 'cuba', 'Eastern Cuba', ['cuba_central'], 'mountain', 3400000, 100, 5500,
      'M 200,190 L 255,200 L 250,240 L 205,235 Z', [228, 216], 1),
  ].map(reg => [reg.id, reg])),
};

/** Neighbour border strips for Tier 2 national maps */
export const NEIGHBOUR_STRIPS: Record<string, string[]> = {
  russia: ['ukr_west', 'ukr_east', 'ukr_south', 'ukr_central'],
  ukraine: ['rus_west', 'rus_south', 'rus_crimea'],
  israel: ['irn_southwest', 'irn_west'],
  india: ['pak_punjab', 'pak_sindh', 'chn_tibet'],
  pakistan: ['ind_north', 'ind_kashmir', 'ind_west', 'irn_east'],
  north_korea: ['sk_northwest', 'chn_northeast'],
  south_korea: ['nk_south', 'nk_west'],
  usa: [],
  china: ['ind_north'],
  iran: ['pak_balochistan', 'isr_south'],
  england: [],
  turkey: [],
};

export function getRegionsForCountry(countryId: string): Region[] {
  return Object.values(REGIONS).filter(r => r.countryId === countryId);
}

export function getNeighbourStrip(countryId: string): Region[] {
  const stripIds = NEIGHBOUR_STRIPS[countryId] ?? [];
  return stripIds.map(id => REGIONS[id]).filter(Boolean);
}
