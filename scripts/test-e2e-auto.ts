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
    await page.waitForFunction(
      () => Boolean((window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug),
      null,
      { timeout: 20_000 },
    );

    const startButton = page.getByRole('button', { name: /start calibration/i });
    if (await startButton.count()) {
      await startButton.click();
      await page.waitForTimeout(4500);
    }

    const snapshots = await page.evaluate(async () => {
      const rows: Array<{ stage: string; poseBackend: string; faceBackend: string }> = [];
      for (let i = 0; i < 50; i += 1) {
        const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug ?? {};
        const backend = (debug.backend as Record<string, unknown> | undefined) ?? {};
        rows.push({
          stage: String(debug.stage ?? 'unknown'),
          poseBackend: String(backend.pose ?? 'unknown'),
          faceBackend: String(backend.face ?? 'unknown'),
        });
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return rows;
    });

    const poseBackends = new Set(snapshots.map((row) => row.poseBackend));
    const faceBackends = new Set(snapshots.map((row) => row.faceBackend));
    const stages = new Set(snapshots.map((row) => row.stage));

    if (poseBackends.has('synthetic') || faceBackends.has('synthetic')) {
      throw new Error('Synthetic fallback backend detected in runtime');
    }

    if (![...poseBackends].some((value) => ['human', 'mediapipe', 'unavailable', 'starting'].includes(value))) {
      throw new Error(`Unexpected pose backend values: ${[...poseBackends].join(', ')}`);
    }

    if (![...faceBackends].some((value) => ['human', 'unavailable', 'starting'].includes(value))) {
      throw new Error(`Unexpected face backend values: ${[...faceBackends].join(', ')}`);
    }

    if (![...stages].some((value) => ['welcome', 'calibrating', 'ready'].includes(value))) {
      throw new Error(`Unexpected stage values: ${[...stages].join(', ')}`);
    }

    console.log('PASS autonomous runtime smoke');
    console.log(`Stages observed: ${[...stages].join(', ')}`);
    console.log(`Pose backends observed: ${[...poseBackends].join(', ')}`);
    console.log(`Face backends observed: ${[...faceBackends].join(', ')}`);
  } finally {
    await electronApp.close();
  }
}

run().catch((error) => {
  console.error('Autonomous E2E flow failed');
  console.error(error);
  process.exit(1);
});
