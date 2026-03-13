import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { _electron as electron } from 'playwright';

const appAsar = path.resolve(
  process.cwd(),
  'out',
  'KINETIC-darwin-arm64',
  'KINETIC.app',
  'Contents',
  'Resources',
  'app.asar',
);

async function run(): Promise<void> {
  console.log('Building packaged app for autonomous E2E...');
  execSync('npm run package', { stdio: 'inherit' });

  if (!fs.existsSync(appAsar)) {
    throw new Error(`Packaged app entry not found: ${appAsar}`);
  }

  const electronApp = await electron.launch({
    args: [appAsar],
    env: {
      ...process.env,
      KINETIC_AUTOTEST: '1',
    },
    timeout: 120_000,
  });

  try {
    const page = await electronApp.firstWindow();
    await page.waitForFunction(() => {
      const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug;
      return Boolean(debug);
    }, null, { timeout: 20_000 });
    await page.waitForFunction(() => {
      const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug;
      return Number(debug?.timelinePoints ?? 0) > 8;
    }, null, {
      timeout: 20_000,
    });

    const postureSamples: number[] = await page.evaluate(async () => {
      const values: number[] = [];
      for (let i = 0; i < 90; i += 1) {
        const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug;
        values.push(Number(debug?.posture ?? 0));
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return values;
    });

    const minPosture = Math.min(...postureSamples);
    const maxPosture = Math.max(...postureSamples);

    if (maxPosture < 70) {
      throw new Error(`Expected upright posture >= 70, got max ${maxPosture}`);
    }
    if (minPosture > 50) {
      throw new Error(`Expected slouch posture <= 50, got min ${minPosture}`);
    }

    const healthStates: string[] = await page.evaluate(async () => {
      const seen = new Set<string>();
      for (let i = 0; i < 80; i += 1) {
        const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug;
        const health = debug?.petHealth;
        if (typeof health === 'string') seen.add(health);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return [...seen];
    });

    const distinctHealthStates = new Set(healthStates);
    if (distinctHealthStates.size < 2) {
      throw new Error(`Expected at least two pet health states, saw: ${healthStates.join(', ')}`);
    }
    if (!healthStates.includes('Thriving') && !healthStates.includes('Wilting')) {
      throw new Error(`Expected edge pet state (Thriving or Wilting), saw: ${healthStates.join(', ')}`);
    }

    const timelinePoints = await page.evaluate(() => {
      const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug;
      return Number(debug?.timelinePoints ?? 0);
    });
    if (timelinePoints < 20) {
      throw new Error(`Expected session timeline accumulation >= 20 points, got ${timelinePoints}`);
    }

    await page.getByRole('button', { name: 'End Session' }).click();
    await page.waitForFunction(() => {
      const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug;
      return Boolean(debug?.recapVisible);
    }, null, {
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'Copy' }).click();
    await page.getByRole('button', { name: 'Save PNG' }).click();
    await page.waitForTimeout(600);

    const recapPath = path.resolve(process.cwd(), 'out', 'kinetic-recap-autotest.png');
    if (!fs.existsSync(recapPath)) {
      throw new Error('Expected recap file at out/kinetic-recap-autotest.png');
    }
    const stats = fs.statSync(recapPath);
    if (stats.size <= 0) {
      throw new Error('Autotest recap file is empty');
    }

    console.log('PASS autonomous E2E flow');
    console.log(`Posture range ${minPosture}..${maxPosture}`);
    console.log(`Health states: ${healthStates.join(', ')}`);
    console.log(`Timeline points: ${timelinePoints}`);
  } finally {
    await electronApp.close();
  }
}

run().catch((error) => {
  console.error('Autonomous E2E flow failed');
  console.error(error);
  process.exit(1);
});
