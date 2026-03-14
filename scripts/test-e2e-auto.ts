import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { _electron as electron } from 'playwright';

const appAsar = path.resolve(
  process.cwd(),
  'out',
  'Axis-darwin-arm64',
  'Axis.app',
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

    const beginButton = page.getByRole('button', { name: /begin session/i });
    await beginButton.click();
    await page.waitForTimeout(1200);

    const endSessionButton = page.getByRole('button', { name: /end session/i });
    await endSessionButton.waitFor({ state: 'visible', timeout: 20_000 });
    await endSessionButton.click();

    const leaderboardDialog = page.getByRole('dialog', { name: /sydney leaderboard map/i });
    await leaderboardDialog.waitFor({ state: 'visible', timeout: 20_000 });

    const leaderboardWasVisible = await page.evaluate(() => {
      const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug ?? {};
      return debug.leaderboardVisible === true;
    });
    if (!leaderboardWasVisible) {
      throw new Error('Leaderboard overlay did not report visible=true in debug state');
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug ?? {};
      return debug.leaderboardVisible === false;
    }, null, { timeout: 20_000 });

    const snapshots = await page.evaluate(async () => {
      const rows: Array<{ stage: string; poseBackend: string; faceBackend: string; leaderboardVisible: string }> = [];
      for (let i = 0; i < 50; i += 1) {
        const debug = (window as unknown as { __kineticDebug?: Record<string, unknown> }).__kineticDebug ?? {};
        const backend = (debug.backend as Record<string, unknown> | undefined) ?? {};
        rows.push({
          stage: String(debug.stage ?? 'unknown'),
          poseBackend: String(backend.pose ?? 'unknown'),
          faceBackend: String(backend.face ?? 'unknown'),
          leaderboardVisible: String(debug.leaderboardVisible ?? 'unknown'),
        });
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return rows;
    });

    const poseBackends = new Set(snapshots.map((row) => row.poseBackend));
    const faceBackends = new Set(snapshots.map((row) => row.faceBackend));
    const stages = new Set(snapshots.map((row) => row.stage));
    const leaderboardFlags = new Set(snapshots.map((row) => row.leaderboardVisible));

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

    if (![...leaderboardFlags].some((value) => ['true', 'false'].includes(value))) {
      throw new Error(`Unexpected leaderboard visibility values: ${[...leaderboardFlags].join(', ')}`);
    }

    console.log('PASS autonomous runtime smoke');
    console.log(`Stages observed: ${[...stages].join(', ')}`);
    console.log(`Pose backends observed: ${[...poseBackends].join(', ')}`);
    console.log(`Face backends observed: ${[...faceBackends].join(', ')}`);
    console.log(`Leaderboard visible observed: ${[...leaderboardFlags].join(', ')}`);
  } finally {
    await electronApp.close();
  }
}

run().catch((error) => {
  console.error('Autonomous E2E flow failed');
  console.error(error);
  process.exit(1);
});
