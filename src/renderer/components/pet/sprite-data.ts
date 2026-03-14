/**
 * Active pixel-art sprites used by BioPet.
 * This file intentionally keeps only the currently-rendered egg/cushion assets.
 */

export const eggPalette: Record<string, string> = {
  o: '#5C3A1E',
  b: '#F5EDE4',
  s: '#E0D4C4',
  h: '#FFFDF8',
  x: '#C8A882',
  p: '#C4917B',
};

export const cushionPalette: Record<string, string> = {
  o: '#D4C4B0',
  b: '#FFF8F0',
  s: '#F0E8DC',
  h: '#FFFFFF',
};

export const crackPalette: Record<string, string> = { c: '#5C3A1E' };
export const crackGlowPalette: Record<string, string> = { c: '#5C3A1E', g: '#FFF8E0' };

export const eggGrid: string[] = [
  '.......oooooo.......',
  '......ohhhhhho......',
  '.....ohhhhbbbboo....',
  '....ohhhbbbbbbbbo...',
  '...ohhbbbbbbbbbbbo..',
  '...ohbbbpbpbpbbbbo..',
  '..ohbbbbbbxbbbbbbo..',
  '..obbbbbbpppbbbbbo..',
  '..obbxbbbpppbbbbbo..',
  '..obbbbbbbpbbbbbbo..',
  '..obbbbbbbbbbxbbbo..',
  '..obbbbbbbbbbbbbbo..',
  '..obbbbbbxbbbbbo...',
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
