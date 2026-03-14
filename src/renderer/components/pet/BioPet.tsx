import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PetHealthState, PetState } from '@renderer/lib/types';

interface BioPetProps {
  pet: PetState;
  postureTilt: number;
  postureScore: number;
  focusScore: number;
  stressScore: number;
}

// ── Health color mapping ──────────────────────────────────

const HEALTH_COLORS: Record<PetHealthState, THREE.Color> = {
  Thriving: new THREE.Color(0x4ddb8a),
  Fading: new THREE.Color(0xf0c040),
  Wilting: new THREE.Color(0xe06050),
};

const HEALTH_GLOW: Record<PetHealthState, THREE.Color> = {
  Thriving: new THREE.Color(0x3dff90),
  Fading: new THREE.Color(0xffdd44),
  Wilting: new THREE.Color(0xff6655),
};

const HEALTH_EMISSIVE_INTENSITY: Record<PetHealthState, number> = {
  Thriving: 0.35,
  Fading: 0.2,
  Wilting: 0.08,
};

const HEALTH_BREATH_AMPLITUDE: Record<PetHealthState, number> = {
  Thriving: 0.035,
  Fading: 0.02,
  Wilting: 0.01,
};

const SKIP_COLORS = new Set([
  0xffffff, 0x222222, 0xf2e8ce, 0x333333, 0x8b0000, 0xe6dfd2,
]);

const HEALTH_HYSTERESIS_MS = 3000;
const COLOR_LERP_SPEED = 0.02;
const PARTICLE_COUNT = 14;
const CANVAS_HEIGHT = 300;

// ── Helpers ────────────────────────────────────────────────

function createGradientBackground(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#1b1833');
  g.addColorStop(0.5, '#1e1a35');
  g.addColorStop(1, '#110f20');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  return new THREE.CanvasTexture(c);
}

function createGlowSprite(): THREE.SpriteMaterial {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 245, 220, 1)');
  g.addColorStop(0.2, 'rgba(255, 230, 180, 0.8)');
  g.addColorStop(0.5, 'rgba(255, 210, 140, 0.3)');
  g.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function createEggGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [];
  const segs = 48;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const angle = t * Math.PI;
    const r = Math.sin(angle) * (0.44 + 0.14 * Math.cos(angle));
    const y = t * 1.2 - 0.6;
    points.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(points, 64);
}

function createGroundGlow(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(120, 100, 200, 0.35)');
  g.addColorStop(0.3, 'rgba(100, 80, 180, 0.15)');
  g.addColorStop(0.7, 'rgba(60, 50, 120, 0.05)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.59;
  return mesh;
}

// ── Component ──────────────────────────────────────────────

export function BioPet({
  pet,
  postureTilt,
  postureScore,
  focusScore,
  stressScore,
}: BioPetProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const petGroupRef = useRef<THREE.Group | null>(null);
  const particleGroupRef = useRef<THREE.Group | null>(null);
  const auraRef = useRef<THREE.Mesh | null>(null);
  const innerLightRef = useRef<THREE.PointLight | null>(null);
  const groundGlowRef = useRef<THREE.Mesh | null>(null);
  const frameRef = useRef<number>(0);
  const mountedRef = useRef(false);

  const postureTiltRef = useRef(postureTilt);
  const postureScoreRef = useRef(postureScore);
  const healthRef = useRef<PetHealthState>(pet.health);
  const breathAmplitudeRef = useRef(HEALTH_BREATH_AMPLITUDE[pet.health]);

  const committedHealthRef = useRef<PetHealthState>(pet.health);
  const pendingHealthRef = useRef<PetHealthState>(pet.health);
  const pendingHealthSinceRef = useRef<number>(Date.now());

  const currentColorRef = useRef(HEALTH_COLORS[pet.health].clone());
  const targetColorRef = useRef(HEALTH_COLORS[pet.health].clone());

  const [committedHealth, setCommittedHealth] = useState<PetHealthState>(pet.health);

  const currentStageRef = useRef(pet.stage);
  const currentEggCrackRef = useRef(pet.eggCrackProgress);
  const isEggRef = useRef(pet.stage === 0);

  postureTiltRef.current = postureTilt;
  postureScoreRef.current = postureScore;

  const accessoriesKeyRef = useRef(pet.accessories.join(','));
  accessoriesKeyRef.current = pet.accessories.join(',');

  // ── Build pet geometry ──────────────────────────────────

  const buildPetGeometry = useCallback(
    (group: THREE.Group, stage: number, health: PetHealthState, eggCrack: number) => {
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

        const eggGroup = new THREE.Group();

        // Proper egg shape via lathe profile
        const egg = new THREE.Mesh(
          createEggGeometry(),
          new THREE.MeshPhysicalMaterial({
            color: 0xfcf6ee,
            roughness: 0.12,
            metalness: 0.05,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08,
            emissive: new THREE.Color(0xffe8cc),
            emissiveIntensity: 0.18,
            envMapIntensity: 1.2,
          }),
        );
        eggGroup.add(egg);

        // Pearlescent sheen layer (slightly larger, very transparent)
        const sheen = new THREE.Mesh(
          createEggGeometry(),
          new THREE.MeshPhysicalMaterial({
            color: 0xeeddff,
            roughness: 0.05,
            metalness: 0.3,
            clearcoat: 0.5,
            transparent: true,
            opacity: 0.08,
            side: THREE.FrontSide,
            depthWrite: false,
          }),
        );
        sheen.scale.set(1.02, 1.02, 1.02);
        eggGroup.add(sheen);

        group.add(eggGroup);

        // Glowing crack lines
        if (eggCrack > 20) {
          const crack = new THREE.Mesh(
            new THREE.TorusGeometry(0.36, 0.012, 8, 48),
            new THREE.MeshBasicMaterial({
              color: 0xffdd88,
              transparent: true,
              opacity: 0.9,
            }),
          );
          crack.rotation.x = Math.PI / 2.2;
          crack.position.y = 0.04;
          group.add(crack);

          // Glow halo around crack
          const crackGlow = new THREE.Mesh(
            new THREE.TorusGeometry(0.36, 0.04, 8, 48),
            new THREE.MeshBasicMaterial({
              color: 0xffcc44,
              transparent: true,
              opacity: 0.25,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          crackGlow.rotation.x = Math.PI / 2.2;
          crackGlow.position.y = 0.04;
          group.add(crackGlow);
        }
        if (eggCrack > 50) {
          const crack2 = new THREE.Mesh(
            new THREE.TorusGeometry(0.3, 0.012, 8, 48),
            new THREE.MeshBasicMaterial({
              color: 0xffdd88,
              transparent: true,
              opacity: 0.9,
            }),
          );
          crack2.rotation.x = Math.PI / 1.8;
          crack2.position.y = -0.14;
          group.add(crack2);

          const crackGlow2 = new THREE.Mesh(
            new THREE.TorusGeometry(0.3, 0.04, 8, 48),
            new THREE.MeshBasicMaterial({
              color: 0xffcc44,
              transparent: true,
              opacity: 0.2,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          crackGlow2.rotation.x = Math.PI / 1.8;
          crackGlow2.position.y = -0.14;
          group.add(crackGlow2);
        }
        if (eggCrack > 80) {
          const crack3 = new THREE.Mesh(
            new THREE.TorusGeometry(0.24, 0.012, 8, 48),
            new THREE.MeshBasicMaterial({
              color: 0xffeebb,
              transparent: true,
              opacity: 0.95,
            }),
          );
          crack3.rotation.x = Math.PI / 2.6;
          crack3.rotation.z = Math.PI / 8;
          crack3.position.y = 0.2;
          group.add(crack3);

          const crackGlow3 = new THREE.Mesh(
            new THREE.TorusGeometry(0.24, 0.05, 8, 48),
            new THREE.MeshBasicMaterial({
              color: 0xffbb33,
              transparent: true,
              opacity: 0.3,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          crackGlow3.rotation.x = Math.PI / 2.6;
          crackGlow3.rotation.z = Math.PI / 8;
          crackGlow3.position.y = 0.2;
          group.add(crackGlow3);
        }
        return;
      }

      // ── Hatched pet ──────────────────────────────────────
      isEggRef.current = false;

      const bodyRadius = 0.7 + stage * 0.05;
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(bodyRadius, 32, 32),
        new THREE.MeshPhysicalMaterial({
          color: color.clone(),
          emissive: color.clone(),
          emissiveIntensity,
          roughness: 0.35,
          metalness: 0.05,
          clearcoat: 0.6,
          clearcoatRoughness: 0.15,
        }),
      );

      // Eyes - slightly larger, more expressive
      const eyeWhiteGeo = new THREE.SphereGeometry(0.09, 16, 16);
      const eyeWhiteMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.1,
        clearcoat: 1.0,
      });
      const pupilGeo = new THREE.SphereGeometry(0.045, 16, 16);
      const pupilMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a1a2e,
        roughness: 0.1,
        clearcoat: 1.0,
      });
      const highlightGeo = new THREE.SphereGeometry(0.015, 8, 8);
      const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const leftEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
      const rightEye = new THREE.Mesh(eyeWhiteGeo.clone(), eyeWhiteMat.clone());
      leftEye.position.set(-0.22, 0.18, bodyRadius * 0.78);
      rightEye.position.set(0.22, 0.18, bodyRadius * 0.78);

      const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
      const rightPupil = new THREE.Mesh(pupilGeo.clone(), pupilMat.clone());
      leftPupil.position.set(0, 0, 0.05);
      rightPupil.position.set(0, 0, 0.05);
      leftEye.add(leftPupil);
      rightEye.add(rightPupil);

      // Eye highlights for that cute shine
      const leftHighlight = new THREE.Mesh(highlightGeo, highlightMat);
      const rightHighlight = new THREE.Mesh(highlightGeo.clone(), highlightMat.clone());
      leftHighlight.position.set(0.02, 0.02, 0.06);
      rightHighlight.position.set(0.02, 0.02, 0.06);
      leftEye.add(leftHighlight);
      rightEye.add(rightHighlight);

      body.add(leftEye, rightEye);

      // Blush cheeks (cute factor)
      const blushGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const blushMat = new THREE.MeshBasicMaterial({
        color: health === 'Thriving' ? 0xff9999 : health === 'Fading' ? 0xffbb88 : 0xcc8888,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
      const leftBlush = new THREE.Mesh(blushGeo, blushMat);
      const rightBlush = new THREE.Mesh(blushGeo.clone(), blushMat.clone());
      leftBlush.position.set(-0.32, 0.04, bodyRadius * 0.72);
      rightBlush.position.set(0.32, 0.04, bodyRadius * 0.72);
      leftBlush.scale.set(1.4, 0.8, 0.5);
      rightBlush.scale.set(1.4, 0.8, 0.5);
      body.add(leftBlush, rightBlush);

      // Mouth
      if (health === 'Thriving') {
        const smileCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.13, -0.06, bodyRadius * 0.8),
          new THREE.Vector3(0, -0.14, bodyRadius * 0.85),
          new THREE.Vector3(0.13, -0.06, bodyRadius * 0.8),
        );
        const smileGeo = new THREE.TubeGeometry(smileCurve, 16, 0.014, 8, false);
        const smileMat = new THREE.MeshBasicMaterial({ color: 0x2a2a3e });
        body.add(new THREE.Mesh(smileGeo, smileMat));
      } else if (health === 'Wilting') {
        const frownCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.1, -0.12, bodyRadius * 0.8),
          new THREE.Vector3(0, -0.06, bodyRadius * 0.85),
          new THREE.Vector3(0.1, -0.12, bodyRadius * 0.8),
        );
        const frownGeo = new THREE.TubeGeometry(frownCurve, 16, 0.014, 8, false);
        const frownMat = new THREE.MeshBasicMaterial({ color: 0x2a2a3e });
        body.add(new THREE.Mesh(frownGeo, frownMat));
      } else {
        const lineGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.16, 8);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x2a2a3e });
        const mouth = new THREE.Mesh(lineGeo, lineMat);
        mouth.rotation.z = Math.PI / 2;
        mouth.position.set(0, -0.08, bodyRadius * 0.8);
        body.add(mouth);
      }

      // Feet
      const footGeo = new THREE.SphereGeometry(0.13, 16, 16);
      const footMat = new THREE.MeshPhysicalMaterial({
        color: color.clone().multiplyScalar(0.75),
        roughness: 0.4,
        clearcoat: 0.4,
      });
      const leftFoot = new THREE.Mesh(footGeo, footMat);
      const rightFoot = new THREE.Mesh(footGeo.clone(), footMat.clone());
      leftFoot.position.set(-0.24, -(bodyRadius - 0.04), 0.1);
      rightFoot.position.set(0.24, -(bodyRadius - 0.04), 0.1);
      leftFoot.scale.set(1, 0.55, 1.3);
      rightFoot.scale.set(1, 0.55, 1.3);

      group.add(body, leftFoot, rightFoot);

      // Cape for higher stages
      const accessories = accessoriesKeyRef.current.split(',');
      if (stage >= 3 || accessories.includes('cape')) {
        const capeGeo = new THREE.PlaneGeometry(0.65, 0.85);
        const capeMat = new THREE.MeshPhysicalMaterial({
          color: 0x8b0000,
          side: THREE.DoubleSide,
          roughness: 0.5,
          clearcoat: 0.3,
          emissive: new THREE.Color(0x440000),
          emissiveIntensity: 0.15,
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

    // Scene with dark gradient background
    const scene = new THREE.Scene();
    scene.background = createGradientBackground();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / CANVAS_HEIGHT, 0.1, 100);
    camera.position.set(0, 0.4, 3.8);
    camera.lookAt(0, 0.05, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'default',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, CANVAS_HEIGHT);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Lighting ──────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x6666aa, 0.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff0dd, 1.2);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8899cc, 0.5);
    fillLight.position.set(-3, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffaa66, 0.7);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // Accent bottom light for dramatic uplighting
    const bottomLight = new THREE.PointLight(0x7766cc, 0.6, 5);
    bottomLight.position.set(0, -1.5, 1);
    scene.add(bottomLight);

    // Inner glow light (warm, pulsing — positioned at egg center)
    const innerLight = new THREE.PointLight(0xffe8cc, 1.8, 3.5);
    innerLight.position.set(0, 0, 0);
    scene.add(innerLight);
    innerLightRef.current = innerLight;

    // ── Ground glow ──────────────────────────────────────
    const groundGlow = createGroundGlow();
    scene.add(groundGlow);
    groundGlowRef.current = groundGlow;

    // Subtle reflective floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 64),
      new THREE.MeshStandardMaterial({
        color: 0x1a1830,
        roughness: 0.7,
        metalness: 0.3,
        transparent: true,
        opacity: 0.6,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.61;
    scene.add(floor);

    // ── Outer aura (soft glow sphere) ────────────────────
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xddccff,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(aura);
    auraRef.current = aura;

    // ── Particle sprites ─────────────────────────────────
    const particleGroup = new THREE.Group();
    const baseMat = createGlowSprite();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const sprite = new THREE.Sprite(baseMat.clone());
      const size = 0.04 + Math.random() * 0.06;
      sprite.scale.set(size, size, size);
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 0.8 + Math.random() * 0.5;
      const height = (Math.random() - 0.5) * 1.0;
      sprite.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
      );
      sprite.userData = { angle, radius, height, speed: 0.15 + Math.random() * 0.25, phase: Math.random() * Math.PI * 2 };
      particleGroup.add(sprite);
    }
    scene.add(particleGroup);
    particleGroupRef.current = particleGroup;

    // ── Pet group ────────────────────────────────────────
    const petGroup = new THREE.Group();
    scene.add(petGroup);
    petGroupRef.current = petGroup;

    buildPetGeometry(petGroup, currentStageRef.current, committedHealthRef.current, currentEggCrackRef.current);

    // ── Resize ───────────────────────────────────────────
    const onResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth;
      renderer.setSize(w, CANVAS_HEIGHT);
      camera.aspect = w / CANVAS_HEIGHT;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ───────────────────────────────────
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = performance.now() / 1000;
      const group = petGroupRef.current;

      if (group) {
        // Breathing
        const breathScale = 1 + Math.sin(t * 2) * breathAmplitudeRef.current;
        group.scale.y = breathScale;

        // Gentle vertical bob
        group.position.y = Math.sin(t * 1.2) * 0.02;

        // Posture tilt — very subtle for egg, more for hatched
        const tiltFactor = isEggRef.current ? 0.08 : 0.4;
        group.rotation.z = THREE.MathUtils.lerp(
          group.rotation.z,
          THREE.MathUtils.degToRad(postureTiltRef.current * tiltFactor),
          0.05,
        );

        if (!isEggRef.current) {
          group.rotation.x = THREE.MathUtils.degToRad(
            Math.max(-8, Math.min(8, (55 - postureScoreRef.current) * 0.1)),
          );
        } else {
          group.rotation.x = 0;
        }

        // Gentle idle sway
        group.rotation.y = Math.sin(t * 0.5) * 0.04;

        // Smooth color lerp
        if (!isEggRef.current) {
          const current = currentColorRef.current;
          const target = targetColorRef.current;
          if (!current.equals(target)) {
            current.lerp(target, COLOR_LERP_SPEED);
            group.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
                if (SKIP_COLORS.has(child.material.color.getHex())) return;
                child.material.color.copy(current);
                child.material.emissive.copy(current);
              }
            });
          }
        }
      }

      // Pulsing inner glow
      if (innerLightRef.current) {
        const basePower = isEggRef.current ? 1.8 : 1.0;
        const pulseAmp = isEggRef.current ? 0.6 : 0.3;
        innerLightRef.current.intensity = basePower + Math.sin(t * 1.5) * pulseAmp;
        if (!isEggRef.current) {
          const glowColor = HEALTH_GLOW[committedHealthRef.current];
          innerLightRef.current.color.lerp(glowColor, 0.02);
        } else {
          innerLightRef.current.color.set(0xffe8cc);
        }
      }

      // Aura pulse
      if (auraRef.current && auraRef.current.material instanceof THREE.MeshBasicMaterial) {
        const baseOpacity = isEggRef.current ? 0.06 : 0.04;
        auraRef.current.material.opacity = baseOpacity + Math.sin(t * 1.5) * 0.025;
        auraRef.current.scale.setScalar(1.0 + Math.sin(t * 1.2) * 0.04);
        if (!isEggRef.current) {
          auraRef.current.material.color.lerp(HEALTH_GLOW[committedHealthRef.current], 0.01);
        }
      }

      // Ground glow pulse
      if (groundGlowRef.current && groundGlowRef.current.material instanceof THREE.MeshBasicMaterial) {
        groundGlowRef.current.material.opacity = 0.7 + Math.sin(t * 1.5) * 0.15;
      }

      // Orbiting particles
      if (particleGroupRef.current) {
        particleGroupRef.current.children.forEach((child) => {
          const d = child.userData as { angle: number; radius: number; height: number; speed: number; phase: number };
          d.angle += d.speed * 0.008;
          child.position.x = Math.cos(d.angle) * d.radius;
          child.position.z = Math.sin(d.angle) * d.radius;
          child.position.y = d.height + Math.sin(t * 0.8 + d.phase) * 0.15;
          if (child instanceof THREE.Sprite) {
            const flicker = 0.5 + Math.sin(t * 3 + d.phase) * 0.3 + Math.sin(t * 7.3 + d.phase * 2) * 0.2;
            child.material.opacity = Math.max(0.1, flicker);
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ──────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        }
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
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
      particleGroupRef.current = null;
      auraRef.current = null;
      innerLightRef.current = null;
      groundGlowRef.current = null;
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

  // ── EFFECT 3: Rebuild geometry on stage / crack change ──

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

  // ── EFFECT 4: Update materials on committed health ──────

  useEffect(() => {
    const group = petGroupRef.current;
    if (!group) return;

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
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
    pet.health === 'Thriving' ? '#4ddb8a' : pet.health === 'Fading' ? '#f0c040' : '#e06050';
  const healthBg =
    pet.health === 'Thriving' ? 'rgba(77,219,138,0.12)' : pet.health === 'Fading' ? 'rgba(240,192,64,0.12)' : 'rgba(224,96,80,0.12)';

  const STAGE_MINS = [0, 10, 30, 120, 300, 600];
  const nextMin = STAGE_MINS[Math.min(pet.stage + 1, STAGE_MINS.length - 1)];
  const curMin = STAGE_MINS[pet.stage] ?? 0;
  const stageProgress = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - curMin) / Math.max(1, nextMin - curMin)) * 100));

  return (
    <div
      style={{
        borderRadius: 20,
        background: 'linear-gradient(145deg, #1e1b33 0%, #151225 100%)',
        border: '1px solid rgba(140, 120, 200, 0.15)',
        boxShadow: '0 4px 24px rgba(30, 25, 60, 0.4), inset 0 1px 0 rgba(200, 180, 255, 0.06)',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          padding: '12px 18px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: healthColor,
            boxShadow: `0 0 8px ${healthColor}`,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'rgba(200, 190, 230, 0.6)',
          }}
        >
          Bio-Pet
        </span>
      </div>

      {/* 3D Viewport */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: CANVAS_HEIGHT,
          borderRadius: 0,
          overflow: 'hidden',
        }}
      />

      {/* Meta section */}
      <div style={{ padding: '14px 18px 16px', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 15, color: '#e8e4f0', letterSpacing: '-0.01em' }}>
            Stage {pet.stage} · {pet.stageName}
          </strong>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: healthBg,
              color: healthColor,
              borderRadius: 999,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: healthColor,
                boxShadow: `0 0 6px ${healthColor}`,
              }}
            />
            {pet.health}
          </span>
        </div>

        {pet.stage < 5 && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'rgba(200, 190, 230, 0.45)',
                marginBottom: 4,
              }}
            >
              <span>Evolution</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{stageProgress}%</span>
            </div>
            <div
              style={{
                height: 4,
                background: 'rgba(200, 180, 255, 0.08)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${stageProgress}%`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${healthColor}, ${healthColor}dd)`,
                  boxShadow: `0 0 8px ${healthColor}66`,
                  transition: 'width 0.6s ease-out',
                }}
              />
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
        background: 'rgba(200, 180, 255, 0.06)',
        border: '1px solid rgba(140, 120, 200, 0.12)',
        borderRadius: 8,
        padding: '3px 9px',
        fontSize: 11,
        color: 'rgba(200, 190, 230, 0.55)',
        fontVariantNumeric: 'tabular-nums',
        backdropFilter: 'blur(4px)',
      }}
    >
      {label}{' '}
      <strong style={{ color: '#e0dcf0' }}>{typeof value === 'number' ? Math.round(value) : value}</strong>
    </span>
  );
}
