import readline from 'node:readline/promises';
import { execSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';

const checks: Array<{ label: string; optionalWithoutBrightness?: boolean }> = [
  { label: 'App launches and shows welcome/calibration screen' },
  { label: 'Calibration completes and dashboard appears' },
  { label: 'Sitting upright pushes posture score above 70' },
  { label: 'Slouching drops posture score below 50' },
  { label: 'Ambient response visibly dims/warms screen on slouch', optionalWithoutBrightness: true },
  { label: 'Pet state changes between Thriving/Fading/Wilting' },
  { label: 'Session timeline charts accumulate data' },
  { label: 'Ending session opens Sydney leaderboard map overlay' },
  { label: 'View Stats closes map and opens recap overlay with non-zero stats' },
  { label: 'Copy and Save buttons work for recap card' },
];

function brightnessSupported(): boolean {
  try {
    const output = execSync('brightness -l', { stdio: 'pipe' }).toString();
    return /brightness\s+[0-9.]+/i.test(output);
  } catch {
    return false;
  }
}

async function run(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const failures: string[] = [];
  const skipped: string[] = [];
  const hasBrightnessSupport = brightnessSupported();

  console.log('Axis interactive E2E verification');
  console.log('Answer y/n/s for each step after running the app. (s = skip)');
  if (!hasBrightnessSupport) {
    console.log('brightness CLI is unavailable on this display, ambient dimming check is optional.');
  }

  for (const check of checks) {
    if (check.optionalWithoutBrightness && !hasBrightnessSupport) {
      skipped.push(check.label);
      continue;
    }
    const answer = await rl.question(`${check.label}? [y/n/s] `);
    const normalized = answer.trim().toLowerCase();
    if (normalized === 's') {
      skipped.push(check.label);
      continue;
    }
    if (normalized !== 'y') failures.push(check.label);
  }

  rl.close();

  if (skipped.length) {
    console.log('\nSKIPPED checks:');
    skipped.forEach((item) => console.log(`- ${item}`));
  }

  if (failures.length) {
    console.error('\nFAILED checks:');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log('\nPASS all interactive E2E checks');
}

run().catch((error) => {
  console.error('Interactive E2E verification failed', error);
  process.exit(1);
});
