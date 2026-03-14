/**
 * Sprite Data - Traced pixel-by-pixel from OrangeTabby-Idle.png frame 1
 * 
 * Palette:
 * . = transparent
 * o = outline #5C3A1E
 * d = fur dark #8B5E3C
 * m = fur mid #C4864A
 * l = fur light #E8AA6A
 * h = fur highlight #F5CDA0
 * p = pink #E88B8B
 * w = white #FFFDF8
 * e = eye pupil #1A1510
 * g = eye iris #7BAF8B
 */

export const catPalette: Record<string, string> = {
  o: '#5C3A1E',
  d: '#8B5E3C',
  m: '#C4864A',
  l: '#E8AA6A',
  h: '#F5CDA0',
  p: '#E88B8B',
  w: '#FFFDF8',
  e: '#1A1510',
  g: '#7BAF8B',
  a: '#C9A34E',
  r: '#D4645A',
};

export const eggPalette: Record<string, string> = {
  o: '#5C3A1E',
  b: '#F5EDE4',
  s: '#E0D4C4',
  h: '#FFFDF8',
  x: '#C8A882',  // warm speckle/freckle
};

export const cushionPalette: Record<string, string> = {
  o: '#D4C4B0',
  b: '#FFF8F0',
  s: '#F0E8DC',
  h: '#FFFFFF',
};

export const heartPalette: Record<string, string> = {
  h: '#E88B8B',
};

export const irisColors: Record<string, string> = {
  Thriving: '#7BAF8B',
  Fading: '#C9A34E',
  Wilting: '#D4645A',
};

export const crackPalette: Record<string, string> = { c: '#5C3A1E' };
export const crackGlowPalette: Record<string, string> = { c: '#5C3A1E', g: '#FFF8E0' };

// ─────────────────────────────────────────────────────────────
// Egg
// ─────────────────────────────────────────────────────────────

export const eggGrid: string[] = [
  '.......oooooo.......',
  '......ohhhhhho......',
  '.....ohhhhbbbboo....',
  '....ohhhbbbbbbbbo...',
  '...ohhbbbbbbbbbbbo..',
  '...ohbbbbbbbbbbbbo..',
  '..ohbbbbbbxbbbbbbo..',  // speckle top-right area
  '..obbbbbbbbbbbbbbo..',
  '..obbxbbbbbbbbbbbo..',  // speckle left-mid area
  '..obbbbbbbbbbbbbbo..',
  '..obbbbbbbbbbxbbbo..',  // speckle right-mid area
  '..obbbbbbbbbbbbbbo..',
  '..obbbbbbxbbbbbo...',   // speckle lower-left area
  '...obbbbbbbbbbbo....',
  '...obbbbbbbsssbo....',
  '....obbbbsssso......',
  '.....obssso.........',
  '......oooo..........',
];

export const eggCracks85: string[] = [
  '....................',
  '....................',
  '....................',
  '....................',
  '.......c............',
  '......c.c...........',
  '.......c............',
  '....................',
  '....................',
  '.............c......',
  '............c.c.....',
  '.............c......',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
];

export const eggCracks95: string[] = [
  '....................',
  '....................',
  '....................',
  '......g.............',
  '.....gcg............',
  '....gc.cg...........',
  '.....gcg............',
  '......g.............',
  '....................',
  '............g.......',
  '...........gcg......',
  '..........gc.cg.....',
  '...........gcg......',
  '............g.......',
  '....................',
  '....................',
  '....................',
  '....................',
];

// ─────────────────────────────────────────────────────────────
// Cat Idle Frame 1 - EXACT trace from OrangeTabby-Idle.png
// 32x32 canvas, cat centered
// ─────────────────────────────────────────────────────────────

export const catIdle1: string[] = [
  '................................',
  '................................',
  '................................',
  '................................',
  '........o.......o...............',
  '.......omo.....omo..............',
  '......ommo....opmo..............',
  '.....ommmooooommmo..............',
  '.....ommmmmmmmmmo...............',
  '....ommmwwommmmo................',
  '....omwgweommmmo................',
  '....ommwwmmmmmo.................',
  '...olmmmmmmmmmo..................',
  '...ollmmmmmmmmo..................',
  '..owwlmmmmmmmo...................',
  '..owwlmmmmmmo....................',
  '...ollmmmmmo.....................',
  '...ommmmmmo......................',
  '...ommoommmo.....................',
  '....oo..ommo..........oo........',
  '........ommo.........ommo.......',
  '........ommmo.......ommmo.......',
  '.........ommo......ommmmo.......',
  '.........ommo.....ommmmmo.......',
  '..........oo.....ommmmmmo.......',
  '................ommmmmmmo.......',
  '...............ommmmmmmmo.......',
  '..............ommmmmmmmmo.......',
  '.............ommmmmmmmmmo.......',
  '............ommmmmmmmmmmo.......',
  '.............ooooooooooo........',
  '................................',
];

// Cat Idle Frame 2 - shifted 1px down for breathing
export const catIdle2: string[] = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '........o.......o...............',
  '.......omo.....omo..............',
  '......ommo....opmo..............',
  '.....ommmooooommmo..............',
  '.....ommmmmmmmmmo...............',
  '....ommmwwommmmo................',
  '....omwgweommmmo................',
  '....ommwwmmmmmo.................',
  '...olmmmmmmmmmo..................',
  '...ollmmmmmmmmo..................',
  '..owwlmmmmmmmo...................',
  '..owwlmmmmmmo....................',
  '...ollmmmmmo.....................',
  '...ommmmmmo......................',
  '...ommoommmo.....................',
  '....oo..ommo..........oo........',
  '........ommo.........ommo.......',
  '........ommmo.......ommmo.......',
  '.........ommo......ommmmo.......',
  '.........ommo.....ommmmmo.......',
  '..........oo.....ommmmmmo.......',
  '................ommmmmmmo.......',
  '...............ommmmmmmmo.......',
  '..............ommmmmmmmmo.......',
  '.............ommmmmmmmmmo.......',
  '............ommmmmmmmmmmo.......',
  '.............ooooooooooo........',
];

// Cat Blink - eyes as line
export const catBlink: string[] = [
  '................................',
  '................................',
  '................................',
  '................................',
  '........o.......o...............',
  '.......omo.....omo..............',
  '......ommo....opmo..............',
  '.....ommmooooommmo..............',
  '.....ommmmmmmmmmo...............',
  '....ommmmmmmmmo.................',
  '....omeeeommmmo.................',
  '....ommmmmmmmmo.................',
  '...olmmmmmmmmmo..................',
  '...ollmmmmmmmmo..................',
  '..owwlmmmmmmmo...................',
  '..owwlmmmmmmo....................',
  '...ollmmmmmo.....................',
  '...ommmmmmo......................',
  '...ommoommmo.....................',
  '....oo..ommo..........oo........',
  '........ommo.........ommo.......',
  '........ommmo.......ommmo.......',
  '.........ommo......ommmmo.......',
  '.........ommo.....ommmmmo.......',
  '..........oo.....ommmmmmo.......',
  '................ommmmmmmo.......',
  '...............ommmmmmmmo.......',
  '..............ommmmmmmmmo.......',
  '.............ommmmmmmmmmo.......',
  '............ommmmmmmmmmmo.......',
  '.............ooooooooooo........',
  '................................',
];

// Cat Sleep - curled up
export const catSleep: string[] = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '........o.......o...............',
  '.......omo.....omo..............',
  '......ommo....opmo..............',
  '.....ommmooooommmo..............',
  '.....ommmmmmmmmmo...............',
  '....omeeeommmmo.................',
  '....ommmmmmmmmo.................',
  '...olmmmmmmmmo..................',
  '..owwlmmmmmmo...................',
  '..owwlmmmmmo....................',
  '...olmmmmmo.....................',
  '...ommmmmmoooo..................',
  '....ommmmmmmmmooo...............',
  '.....ommmmmmmmmmmmo.............',
  '......ommmmmmmmmmmo.............',
  '.......ooooooooooooo............',
  '................................',
  '................................',
  '................................',
  '................................',
];

// Cat Happy - same as idle with small mouth
export const catHappy: string[] = [
  '................................',
  '................................',
  '................................',
  '................................',
  '........o.......o...............',
  '.......omo.....omo..............',
  '......ommo....opmo..............',
  '.....ommmooooommmo..............',
  '.....ommmmmmmmmmo...............',
  '....ommmwwommmmo................',
  '....omwgweommmmo................',
  '....ommwwpmmmmo.................',
  '...olmmmmmmmmmo..................',
  '...ollmmmmmmmmo..................',
  '..owwlmmmmmmmo...................',
  '..owwlmmmmmmo....................',
  '...ollmmmmmo.....................',
  '...ommmmmmo......................',
  '...ommoommmo.....................',
  '....oo..ommo..........oo........',
  '........ommo.........ommo.......',
  '........ommmo.......ommmo.......',
  '.........ommo......ommmmo.......',
  '.........ommo.....ommmmmo.......',
  '..........oo.....ommmmmmo.......',
  '................ommmmmmmo.......',
  '...............ommmmmmmmo.......',
  '..............ommmmmmmmmo.......',
  '.............ommmmmmmmmmo.......',
  '............ommmmmmmmmmmo.......',
  '.............ooooooooooo........',
  '................................',
];

// Cat Worried - amber eyes, flatter ears
export const catWorried: string[] = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '.......o.......o................',
  '......omo.....omo...............',
  '.....ommo....opmo...............',
  '.....ommmooooommmo..............',
  '.....ommmmmmmmmmo...............',
  '....ommmwommmmo.................',
  '....omwaweommo..................',
  '....ommwwmmmmo..................',
  '...olmmmmmmmmo...................',
  '...ollmmmmmmmo...................',
  '..owwlmmmmmmo....................',
  '..owwlmmmmmo.....................',
  '...ollmmmmo......................',
  '...ommmmmo.......................',
  '...ommoommmo.....................',
  '....oo..ommo..........oo........',
  '........ommo.........ommo.......',
  '........ommmo.......ommmo.......',
  '.........ommo......ommmmo.......',
  '.........ommo.....ommmmmo.......',
  '..........oo.....ommmmmmo.......',
  '................ommmmmmmo.......',
  '...............ommmmmmmmo.......',
  '..............ommmmmmmmmo.......',
  '.............ooooooooooo........',
  '................................',
  '................................',
];

// ─────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────

export const cushionGrid: string[] = [
  '......ooooooooooo......',
  '....oobbbbbbbbbbboo....',
  '...obbbbbbbbbbbbbbboo..',
  '..obbbbbbbbbbbbbbbbbo..',
  '.obbbbbbbbbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbbbbbbbbo.',
  '.obbbbbbbssssssbbbbbbo.',
  '..ooooooooooooooooooo..',
];

export const heartGrid: string[] = [
  '.hh.hh.',
  'hhhhhhh',
  'hhhhhhh',
  '.hhhhh.',
  '..hhh..',
  '...h...',
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function getCatPaletteWithIris(health: 'Thriving' | 'Fading' | 'Wilting'): Record<string, string> {
  return { ...catPalette, g: irisColors[health], a: irisColors[health], r: irisColors[health] };
}

export function mirrorSprite(grid: string[]): string[] {
  return grid.map(row => row.split('').reverse().join(''));
}

// Legacy exports
export const kittenPalette = catPalette;
export const kittenIdleSit1 = catIdle1;
export const kittenIdleSit2 = catIdle2;
export const kittenSleep1 = catSleep;
export const kittenSleep2 = catSleep;
export const kittenBlink = catBlink;
export const kittenHappy = catHappy;
export const kittenWorried = catWorried;
export const kittenWalkR1 = catIdle1;
export const kittenWalkR2 = catIdle2;
export const kittenWalkR3 = catIdle1;
export const kittenWalkR4 = catIdle2;
export const fluffyCushion = cushionGrid;
export const cloudSmall = cushionGrid;
export const flowerPink = heartGrid;
export const worldPalette = cushionPalette;
export const kittenIdleFrames = [catIdle1, catIdle2];
export const kittenSleepFrames = [catSleep];
export const getKittenPaletteWithIris = getCatPaletteWithIris;
