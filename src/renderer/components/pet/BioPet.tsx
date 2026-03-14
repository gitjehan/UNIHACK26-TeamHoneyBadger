import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PetHealthState, PetState } from '@renderer/lib/types';

/* ──────────────────────────────────────────────────────────
   BioPet — Three.js companion that reacts to biometric scores.

   Architecture:
     Effect 1 (mount-once): creates scene, renderer, camera, lights,
       floor, petGroup, animation loop. Stores everything in refs.
       Cleanup disposes everything. Runs exactly ONCE.

     Effect 2 (reactive props): updates existing materials, scale,
       geometry when pet stage/health changes. Never recreates the scene.

     Animation loop: handles breathing, tilt, and smooth color lerping
       via refs that are updated by Effect 2.
   ────────────────────────────────────────────────────────── */

interface BioPetProps {
  pet: PetState;
  postureTilt: number;
  postureScore: number;
  focusScore: number;
  stressScore: number;
}

// ── Health color mapping ──────────────────────────────────

const HEALTH_COLORS: Record<PetHealthState, THREE.Color> = {
  Thriving: new THREE.Color(0x3d6b4f),
  Fading: new THREE.Color(0xc4962c),
  Wilting: new THREE.Color(0xb85a4d),
};

const HEALTH_EMISSIVE_INTENSITY: Record<PetHealthState, number> = {
  Thriving: 0.28,
  Fading: 0.15,
  Wilting: 0.05,
};

const HEALTH_BREATH_AMPLITUDE: Record<PetHealthState, number> = {
  Thriving: 0.04,
  Fading: 0.02,
  Wilting: 0.01,
};

// Hex values to skip during color lerp (non-body materials)
const SKIP_COLORS = new Set([
  0xffffff, 0x222222, 0xf2e8ce, 0x333333, 0x8b0000, 0xe6dfd2,
  0xf8f4ed, // egg shell
]);

// Hysteresis: health must be stable for this many ms before committing
const HEALTH_HYSTERESIS_MS = 3000;

// Color lerp speed (0–1 per frame at 60fps ≈ 2s transition)
const COLOR_LERP_SPEED = 0.02;

export function BioPet({
  pet,
  postureTilt,
  postureScore,
  focusScore,
  stressScore,
}: BioPetProps): JSX.Element {
  // ── DOM ref ──
  const mountRef = useRef<HTMLDivElement>(null);

  // ── Three.js lifecycle refs (persisted across renders) ──
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const petGroupRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number>(0);
  const mountedRef = useRef(false);

  // ── Reactive value refs (read in animation loop without re-running effects) ──
  const postureTiltRef = useRef(postureTilt);
  const postureScoreRef = useRef(postureScore);
  const healthRef = useRef<PetHealthState>(pet.health);
  const breathAmplitudeRef = useRef(HEALTH_BREATH_AMPLITUDE[pet.health]);

  // ── Health hysteresis refs ──
  const committedHealthRef = useRef<PetHealthState>(pet.health);
  const pendingHealthRef = useRef<PetHealthState>(pet.health);
  const pendingHealthSinceRef = useRef<number>(Date.now());

  // ── Color lerp refs ──
  const currentColorRef = useRef(HEALTH_COLORS[pet.health].clone());
  const targetColorRef = useRef(HEALTH_COLORS[pet.health].clone());

  // State-driven committed health so Effect 4 re-runs on health changes
  // (the ref alone never triggers re-renders when the interval commits a new value)
  const [committedHealth, setCommittedHealth] = useState<PetHealthState>(pet.health);

  // ── Track current stage for rebuild detection ──
  const currentStageRef = useRef(pet.stage);
  const currentEggCrackRef = useRef(pet.eggCrackProgress);
  const isEggRef = useRef(pet.stage === 0);

  // Keep tilt/score refs up to date every render (cheap, no effect re-run)
  postureTiltRef.current = postureTilt;
  postureScoreRef.current = postureScore;

  // Stabilize accessories reference
  const accessoriesKeyRef = useRef(pet.accessories.join(','));
  accessoriesKeyRef.current = pet.accessories.join(',');

  // ── Build pet geometry ──────────────────────────────────

  const buildPetGeometry = useCallback(
    (group: THREE.Group, stage: number, health: PetHealthState, eggCrack: number) => {
      // Clear old children and dispose their geometry/materials
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (obj.material instanceof THREE.Material) obj.material.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          }
        });
      }

      const color = HEALTH_COLORS[health];
      const emissiveIntensity = HEALTH_EMISSIVE_INTENSITY[health];

      if (stage === 0) {
        isEggRef.current = true;

        // Egg shell — white/cream colored, proper egg shape (wider at bottom)
        const eggGroup = new THREE.Group();

        const egg = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 32, 32),
          new THREE.MeshStandardMaterial({
            color: 0xf8f4ed,
            roughness: 0.3,
            metalness: 0.0,
            emissive: new THREE.Color(0xf8f4ed),
            emissiveIntensity: 0.05,
          }),
        );
        // Egg shape: narrower at top, wider at bottom
        egg.scale.set(0.72, 1.0, 0.72);
        eggGroup.add(egg);

        group.add(eggGroup);

        // Crack rings appear progressively
        if (eggCrack > 20) {
          const crack = new THREE.Mesh(
            new THREE.TorusGeometry(0.4, 0.014, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xd4cabb }),
          );
          crack.rotation.x = Math.PI / 2.2;
          crack.position.y = 0.08;
          group.add(crack);
        }
        if (eggCrack > 50) {
          const crack2 = new THREE.Mesh(
            new THREE.TorusGeometry(0.34, 0.014, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xd4cabb }),
          );
          crack2.rotation.x = Math.PI / 1.8;
          crack2.position.y = -0.12;
          group.add(crack2);
        }
        if (eggCrack > 80) {
          const crack3 = new THREE.Mesh(
            new THREE.TorusGeometry(0.28, 0.014, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xd4cabb }),
          );
          crack3.rotation.x = Math.PI / 2.6;
          crack3.rotation.z = Math.PI / 8;
          crack3.position.y = 0.22;
          group.add(crack3);
        }
        return;
      }

      isEggRef.current = false;

      // Hatched pet body
      const bodyRadius = 0.75 + stage * 0.06;
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(bodyRadius, 24, 24),
        new THREE.MeshStandardMaterial({
          color: color.clone(),
          emissive: color.clone(),
          emissiveIntensity,
          roughness: 0.55,
        }),
      );

      // Eyes
      const eyeGeo = new THREE.SphereGeometry(0.07, 12, 12);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const pupilGeo = new THREE.SphereGeometry(0.035, 12, 12);
      const pupilMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      const rightEye = new THREE.Mesh(eyeGeo.clone(), eyeMat.clone());
      leftEye.position.set(-0.2, 0.15, 0.58);
      rightEye.position.set(0.2, 0.15, 0.58);

      const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
      const rightPupil = new THREE.Mesh(pupilGeo.clone(), pupilMat.clone());
      leftPupil.position.set(0, 0, 0.04);
      rightPupil.position.set(0, 0, 0.04);
      leftEye.add(leftPupil);
      rightEye.add(rightPupil);

      body.add(leftEye, rightEye);

      // Mouth — simple curved line using a tube
      if (health === 'Thriving') {
        const smileCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.12, -0.05, 0.6),
          new THREE.Vector3(0, -0.12, 0.65),
          new THREE.Vector3(0.12, -0.05, 0.6),
        );
        const smileGeo = new THREE.TubeGeometry(smileCurve, 12, 0.012, 6, false);
        const smileMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        body.add(new THREE.Mesh(smileGeo, smileMat));
      } else if (health === 'Wilting') {
        const frownCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.1, -0.1, 0.6),
          new THREE.Vector3(0, -0.04, 0.65),
          new THREE.Vector3(0.1, -0.1, 0.6),
        );
        const frownGeo = new THREE.TubeGeometry(frownCurve, 12, 0.012, 6, false);
        const frownMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        body.add(new THREE.Mesh(frownGeo, frownMat));
      } else {
        // Neutral straight mouth
        const lineGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.15, 6);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const mouth = new THREE.Mesh(lineGeo, lineMat);
        mouth.rotation.z = Math.PI / 2;
        mouth.position.set(0, -0.07, 0.6);
        body.add(mouth);
      }

      // Feet (small bumps at bottom)
      const footGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const footMat = new THREE.MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.8),
        roughness: 0.6,
      });
      const leftFoot = new THREE.Mesh(footGeo, footMat);
      const rightFoot = new THREE.Mesh(footGeo.clone(), footMat.clone());
      leftFoot.position.set(-0.22, -(bodyRadius - 0.05), 0.1);
      rightFoot.position.set(0.22, -(bodyRadius - 0.05), 0.1);
      leftFoot.scale.set(1, 0.6, 1.2);
      rightFoot.scale.set(1, 0.6, 1.2);

      group.add(body, leftFoot, rightFoot);

      // Accessories for higher stages
      const accessories = accessoriesKeyRef.current.split(',');
      if (stage >= 3 || accessories.includes('cape')) {
        const capeGeo = new THREE.PlaneGeometry(0.6, 0.8);
        const capeMat = new THREE.MeshStandardMaterial({
          color: 0x8b0000,
          side: THREE.DoubleSide,
          roughness: 0.7,
        });
        const cape = new THREE.Mesh(capeGeo, capeMat);
        cape.position.set(0, -0.1, -(bodyRadius - 0.05));
        cape.rotation.x = 0.15;
        group.add(cape);
      }
    },
    // eslint-disable-next-line
    [],
  );

  // ── EFFECT 1: Mount scene ONCE ──────────────────────────

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || mountedRef.current) return;
    mountedRef.current = true;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f0e8);
    sceneRef.current = scene;

    // Camera — positioned to look at the egg/pet standing upright
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / 220, 0.1, 100);
    camera.position.set(0, 0.8, 4.2);
    camera.lookAt(0, 0.3, 0);
    cameraRef.current = camera;

    // Renderer — shadows disabled and pixel ratio capped to save GPU memory
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, 220);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(3, 4, 2);
    const fill = new THREE.DirectionalLight(0xffe4c4, 0.25);
    fill.position.set(-2, 2, 3);
    scene.add(ambient, key, fill);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 32),
      new THREE.MeshStandardMaterial({ color: 0xe6dfd2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.7;
    scene.add(floor);

    // Pet group
    const petGroup = new THREE.Group();
    scene.add(petGroup);
    petGroupRef.current = petGroup;

    // Build initial pet geometry
    buildPetGeometry(petGroup, currentStageRef.current, committedHealthRef.current, currentEggCrackRef.current);

    // ── Resize handler ──
    const onResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth;
      renderer.setSize(w, 220);
      camera.aspect = w / 220;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ──
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = performance.now() / 1000;
      const group = petGroupRef.current;

      if (group) {
        // Breathing animation (amplitude driven by committed health)
        const scaleY = 1 + Math.sin(t * 2) * breathAmplitudeRef.current;
        group.scale.y = scaleY;

        // Posture tilt response (gentler for egg)
        const tiltFactor = isEggRef.current ? 0.25 : 0.5;
        group.rotation.z = THREE.MathUtils.degToRad(postureTiltRef.current * tiltFactor);

        if (!isEggRef.current) {
          group.rotation.x = THREE.MathUtils.degToRad(
            Math.max(-8, Math.min(8, (55 - postureScoreRef.current) * 0.12)),
          );
        } else {
          group.rotation.x = 0;
        }

        // Gentle idle sway
        group.rotation.y = Math.sin(t * 0.5) * 0.05;

        // Smooth color lerp toward target (only for hatched pet, not egg)
        if (!isEggRef.current) {
          const current = currentColorRef.current;
          const target = targetColorRef.current;
          if (!current.equals(target)) {
            current.lerp(target, COLOR_LERP_SPEED);

            group.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                if (SKIP_COLORS.has(child.material.color.getHex())) return;
                child.material.color.copy(current);
                child.material.emissive.copy(current);
              }
            });
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      mountedRef.current = false;
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      petGroupRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  // ── EFFECT 2: Health hysteresis + color transition ──────

  useEffect(() => {
    const incomingHealth = pet.health;

    if (incomingHealth !== pendingHealthRef.current) {
      pendingHealthRef.current = incomingHealth;
      pendingHealthSinceRef.current = Date.now();
    }

    const elapsed = Date.now() - pendingHealthSinceRef.current;
    if (incomingHealth !== committedHealthRef.current && elapsed >= HEALTH_HYSTERESIS_MS) {
      committedHealthRef.current = incomingHealth;
      healthRef.current = incomingHealth;
      targetColorRef.current = HEALTH_COLORS[incomingHealth].clone();
      breathAmplitudeRef.current = HEALTH_BREATH_AMPLITUDE[incomingHealth];
      setCommittedHealth(incomingHealth);
    }

    if (incomingHealth === committedHealthRef.current) {
      healthRef.current = incomingHealth;
    }
  }, [pet.health]);

  useEffect(() => {
    const interval = setInterval(() => {
      const pending = pendingHealthRef.current;
      const committed = committedHealthRef.current;
      if (pending !== committed) {
        const elapsed = Date.now() - pendingHealthSinceRef.current;
        if (elapsed >= HEALTH_HYSTERESIS_MS) {
          committedHealthRef.current = pending;
          healthRef.current = pending;
          targetColorRef.current = HEALTH_COLORS[pending].clone();
          breathAmplitudeRef.current = HEALTH_BREATH_AMPLITUDE[pending];
          setCommittedHealth(pending);
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // ── EFFECT 3: Rebuild geometry when stage changes ───────

  useEffect(() => {
    const group = petGroupRef.current;
    if (!group) return;

    const stageChanged = pet.stage !== currentStageRef.current;
    const eggCrackCrossedThreshold =
      pet.stage === 0 &&
      ((pet.eggCrackProgress > 20 && currentEggCrackRef.current <= 20) ||
        (pet.eggCrackProgress > 50 && currentEggCrackRef.current <= 50) ||
        (pet.eggCrackProgress > 80 && currentEggCrackRef.current <= 80));

    if (stageChanged || eggCrackCrossedThreshold) {
      currentStageRef.current = pet.stage;
      currentEggCrackRef.current = pet.eggCrackProgress;
      buildPetGeometry(group, pet.stage, committedHealthRef.current, pet.eggCrackProgress);
      currentColorRef.current = HEALTH_COLORS[committedHealthRef.current].clone();
      targetColorRef.current = HEALTH_COLORS[committedHealthRef.current].clone();
    }
  }, [pet.stage, pet.eggCrackProgress, buildPetGeometry]);

  // ── EFFECT 4: Update materials on committed health change ──

  useEffect(() => {
    const group = petGroupRef.current;
    if (!group) return;

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (SKIP_COLORS.has(child.material.color.getHex())) return;
        child.material.emissiveIntensity = HEALTH_EMISSIVE_INTENSITY[committedHealth];
      }
    });

    if (currentStageRef.current > 0) {
      buildPetGeometry(group, currentStageRef.current, committedHealth, currentEggCrackRef.current);
      currentColorRef.current = HEALTH_COLORS[committedHealth].clone();
      targetColorRef.current = HEALTH_COLORS[committedHealth].clone();
    }
  }, [committedHealth, buildPetGeometry]);

  // ── Render ──────────────────────────────────────────────

  const healthColor =
    pet.health === 'Thriving' ? 'var(--green-primary)' : pet.health === 'Fading' ? 'var(--amber-primary)' : 'var(--red-primary)';
  const healthBg =
    pet.health === 'Thriving' ? 'var(--green-bg)' : pet.health === 'Fading' ? 'var(--amber-bg)' : 'var(--red-bg)';

  // Evolution progress toward next stage
  const STAGE_MINS = [0, 10, 30, 120, 300, 600];
  const nextMin = STAGE_MINS[Math.min(pet.stage + 1, STAGE_MINS.length - 1)];
  const curMin = STAGE_MINS[pet.stage] ?? 0;
  const stageProgress = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - curMin) / Math.max(1, nextMin - curMin)) * 100));

  return (
    <div className="card">
      <h3>Bio-Pet</h3>
      <div
        ref={mountRef}
        style={{ width: '100%', height: 220, borderRadius: 10, overflow: 'hidden' }}
      />
      <div className="pet-meta" style={{ marginTop: 12, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>
            Stage {pet.stage} · {pet.stageName}
          </strong>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: healthBg,
              color: healthColor,
              borderRadius: 999,
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: healthColor }} />
            {pet.health}
          </span>
        </div>

        {pet.stage < 5 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>
              <span>Evolution</span>
              <span>{stageProgress}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg-card-muted)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stageProgress}%`, borderRadius: 999, background: healthColor, transition: 'width 0.6s ease-out' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <PetChip label="Posture" value={postureScore} />
          <PetChip label="Focus" value={focusScore} />
          <PetChip label="Stress" value={stressScore} />
          <PetChip label="Time" value={`${Math.round(pet.totalLockedInMinutes)}m`} />
        </div>
      </div>
    </div>
  );
}

function PetChip({ label, value }: { label: string; value: number | string }) {
  return (
    <span
      style={{
        background: 'var(--bg-card-muted)',
        border: '1px solid var(--border-card)',
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        color: 'var(--text-secondary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label} <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
    </span>
  );
}
