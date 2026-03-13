import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const checks = [
  'App launches and shows welcome/calibration screen',
  'Calibration completes and dashboard appears',
  'Sitting upright pushes posture score above 70',
  'Slouching drops posture score below 50',
  'Ambient response visibly dims/warms screen on slouch',
  'Pet state changes between Thriving/Fading/Wilting',
  'Session timeline charts accumulate data',
  'Ending session opens recap overlay with non-zero stats',
  'Copy and Save buttons work for recap card',
];

async function run(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const failures: string[] = [];

  console.log('KINETIC interactive E2E verification');
  console.log('Answer y/n for each step after running the app.');

  for (const check of checks) {
    const answer = await rl.question(`${check}? [y/n] `);
    if (answer.trim().toLowerCase() !== 'y') failures.push(check);
  }

  rl.close();

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
