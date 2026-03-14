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

const HEALTH_COLORS: Record<PetHealthState, THREE.Color> = {
  Thriving: new THREE.Color(0x4a7c59),
  Fading: new THREE.Color(0xb8860b),
  Wilting: new THREE.Color(0xc0392b),
};

const HEALTH_EMISSIVE: Record<PetHealthState, number> = {
  Thriving: 0.2,
  Fading: 0.12,
  Wilting: 0.05,
};

const HEALTH_BREATH: Record<PetHealthState, number> = {
  Thriving: 0.03,
  Fading: 0.018,
  Wilting: 0.008,
};

const SKIP_HEX = new Set([0xffffff, 0x222222, 0x333333, 0x8b0000]);
const HEALTH_HYSTERESIS_MS = 3000;
const COLOR_LERP = 0.02;
const PARTICLE_N = 8;
const H = 260;

// ── Shared geometry (created once, reused) ─────────────────

let _eggGeo: THREE.LatheGeometry | null = null;
function eggGeo(): THREE.LatheGeometry {
  if (_eggGeo) return _eggGeo;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const a = t * Math.PI;
    pts.push(new THREE.Vector2(
      Math.sin(a) * (0.44 + 0.14 * Math.cos(a)),
      t * 1.2 - 0.6,
    ));
  }
  _eggGeo = new THREE.LatheGeometry(pts, 32);
  return _eggGeo;
}

// ── Sky gradient texture ───────────────────────────────────

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#c9dde8');
  g.addColorStop(0.45, '#dce8e4');
  g.addColorStop(1, '#efe9df');
  x.fillStyle = g;
  x.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(c);
}

// ── Pollen sprite texture ──────────────────────────────────

function pollenTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(245,220,140,0.9)');
  g.addColorStop(0.4, 'rgba(240,200,100,0.4)');
  g.addColorStop(1, 'rgba(230,180,60,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// ── Tiny garden flowers + grass ────────────────────────────

const FLOWER_SPOTS = [
  { x: -1.1, z: 0.4, s: 0.9, hue: 0xf5a0b0 },
  { x: 1.2, z: 0.2, s: 0.75, hue: 0xfff0ee },
  { x: -0.6, z: 1.1, s: 0.85, hue: 0xf0b8c8 },
  { x: 0.8, z: 1.0, s: 0.7, hue: 0xffe8e0 },
  { x: 0.0, z: -1.1, s: 0.8, hue: 0xf5a0b0 },
];

function buildGarden(scene: THREE.Scene, gardenGroup: THREE.Group) {
  const petalGeo = new THREE.SphereGeometry(0.028, 6, 6);
  const centerGeo = new THREE.SphereGeometry(0.022, 6, 6);
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.6 });
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.01, 1, 4);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a8a50, roughness: 0.8 });

  for (const f of FLOWER_SPOTS) {
    const flower = new THREE.Group();
    const stem = new THREE.Mesh(stemGeo, stemMat);
    const stemH = 0.15 * f.s;
    stem.scale.y = stemH;
    stem.position.y = -0.55 + stemH * 0.5;
    flower.add(stem);

    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.y = -0.55 + stemH + 0.02;
    flower.add(center);

    const petalMat = new THREE.MeshStandardMaterial({ color: f.hue, roughness: 0.5 });
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(
        Math.cos(a) * 0.04,
        center.position.y,
        Math.sin(a) * 0.04,
      );
      petal.scale.set(1.2, 0.6, 1.2);
      flower.add(petal);
    }

    flower.position.set(f.x, 0, f.z);
    flower.rotation.y = Math.random() * Math.PI * 2;
    gardenGroup.add(flower);
  }

  const grassGeo = new THREE.BoxGeometry(0.012, 0.1, 0.006);
  const grassColors = [0x5a9a5f, 0x4d8850, 0x6aaa6a, 0x72b070];
  for (let i = 0; i < 12; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: grassColors[i % grassColors.length],
      roughness: 0.85,
    });
    const blade = new THREE.Mesh(grassGeo, mat);
    const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const r = 0.6 + Math.random() * 0.7;
    blade.position.set(Math.cos(angle) * r, -0.52, Math.sin(angle) * r);
    blade.rotation.z = (Math.random() - 0.5) * 0.3;
    blade.scale.y = 0.6 + Math.random() * 0.6;
    gardenGroup.add(blade);
  }

  scene.add(gardenGroup);
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
  const gardenRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef(0);
  const mountedRef = useRef(false);

  const tiltRef = useRef(postureTilt);
  const scoreRef = useRef(postureScore);
  const breathRef = useRef(HEALTH_BREATH[pet.health]);
  const committedRef = useRef<PetHealthState>(pet.health);
  const pendingRef = useRef<PetHealthState>(pet.health);
  const pendingSinceRef = useRef(Date.now());
  const curColorRef = useRef(HEALTH_COLORS[pet.health].clone());
  const tgtColorRef = useRef(HEALTH_COLORS[pet.health].clone());
  const [committed, setCommitted] = useState<PetHealthState>(pet.health);
  const stageRef = useRef(pet.stage);
  const crackRef = useRef(pet.eggCrackProgress);
  const isEggRef = useRef(pet.stage === 0);

  tiltRef.current = postureTilt;
  scoreRef.current = postureScore;

  const accRef = useRef(pet.accessories.join(','));
  accRef.current = pet.accessories.join(',');

  // ── Build pet mesh ───────────────────────────────────────

  const buildPet = useCallback(
    (group: THREE.Group, stage: number, health: PetHealthState, crack: number) => {
      while (group.children.length) {
        const c = group.children[0];
        group.remove(c);
        c.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry?.dispose();
            if (o.material instanceof THREE.Material) o.material.dispose();
            if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          }
        });
      }

      const col = HEALTH_COLORS[health];
      const ei = HEALTH_EMISSIVE[health];

      if (stage === 0) {
        isEggRef.current = true;

        const egg = new THREE.Mesh(
          eggGeo(),
          new THREE.MeshStandardMaterial({
            color: 0xfaf5ed,
            roughness: 0.18,
            metalness: 0.02,
            emissive: new THREE.Color(0xf5e8d4),
            emissiveIntensity: 0.1,
          }),
        );
        group.add(egg);

        // Warm golden crack lines
        const crackMat = new THREE.MeshBasicMaterial({ color: 0xd4a050 });
        if (crack > 20) {
          const c1 = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.012, 6, 32), crackMat);
          c1.rotation.x = Math.PI / 2.2;
          c1.position.y = 0.04;
          group.add(c1);
        }
        if (crack > 50) {
          const c2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 32), crackMat);
          c2.rotation.x = Math.PI / 1.8;
          c2.position.y = -0.14;
          group.add(c2);
        }
        if (crack > 80) {
          const c3 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 6, 32), crackMat);
          c3.rotation.x = Math.PI / 2.6;
          c3.rotation.z = Math.PI / 8;
          c3.position.y = 0.2;
          group.add(c3);
        }
        return;
      }

      // ── Hatched pet ────────────────────────────────────
      isEggRef.current = false;
      const br = 0.7 + stage * 0.05;

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(br, 24, 24),
        new THREE.MeshStandardMaterial({
          color: col.clone(),
          emissive: col.clone(),
          emissiveIntensity: ei,
          roughness: 0.4,
        }),
      );

      // Eyes
      const eyeG = new THREE.SphereGeometry(0.085, 10, 10);
      const eyeM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
      const pupG = new THREE.SphereGeometry(0.042, 10, 10);
      const pupM = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.1 });
      const hiG = new THREE.SphereGeometry(0.014, 6, 6);
      const hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const lEye = new THREE.Mesh(eyeG, eyeM);
      const rEye = new THREE.Mesh(eyeG, eyeM);
      lEye.position.set(-0.22, 0.18, br * 0.78);
      rEye.position.set(0.22, 0.18, br * 0.78);
      lEye.add(new THREE.Mesh(pupG, pupM).translateZ(0.05));
      rEye.add(new THREE.Mesh(pupG, pupM).translateZ(0.05));
      lEye.add(new THREE.Mesh(hiG, hiM).translateZ(0.06).translateX(0.02).translateY(0.02));
      rEye.add(new THREE.Mesh(hiG, hiM).translateZ(0.06).translateX(0.02).translateY(0.02));
      body.add(lEye, rEye);

      // Blush
      const blushM = new THREE.MeshBasicMaterial({
        color: health === 'Thriving' ? 0xf5a0a0 : health === 'Fading' ? 0xf0bb88 : 0xcc9090,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const blG = new THREE.SphereGeometry(0.055, 8, 8);
      const lBl = new THREE.Mesh(blG, blushM);
      const rBl = new THREE.Mesh(blG, blushM);
      lBl.position.set(-0.3, 0.04, br * 0.72);
      rBl.position.set(0.3, 0.04, br * 0.72);
      lBl.scale.set(1.3, 0.7, 0.5);
      rBl.scale.set(1.3, 0.7, 0.5);
      body.add(lBl, rBl);

      // Mouth
      const mouthCol = 0x333333;
      if (health === 'Thriving') {
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.12, -0.06, br * 0.82),
          new THREE.Vector3(0, -0.13, br * 0.87),
          new THREE.Vector3(0.12, -0.06, br * 0.82),
        );
        body.add(new THREE.Mesh(
          new THREE.TubeGeometry(curve, 10, 0.013, 6, false),
          new THREE.MeshBasicMaterial({ color: mouthCol }),
        ));
      } else if (health === 'Wilting') {
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.1, -0.11, br * 0.82),
          new THREE.Vector3(0, -0.05, br * 0.87),
          new THREE.Vector3(0.1, -0.11, br * 0.82),
        );
        body.add(new THREE.Mesh(
          new THREE.TubeGeometry(curve, 10, 0.013, 6, false),
          new THREE.MeshBasicMaterial({ color: mouthCol }),
        ));
      } else {
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6),
          new THREE.MeshBasicMaterial({ color: mouthCol }),
        );
        m.rotation.z = Math.PI / 2;
        m.position.set(0, -0.07, br * 0.82);
        body.add(m);
      }

      // Feet
      const fG = new THREE.SphereGeometry(0.12, 10, 10);
      const fM = new THREE.MeshStandardMaterial({
        color: col.clone().multiplyScalar(0.75),
        roughness: 0.55,
      });
      const lF = new THREE.Mesh(fG, fM);
      const rF = new THREE.Mesh(fG, fM);
      lF.position.set(-0.22, -(br - 0.04), 0.1);
      rF.position.set(0.22, -(br - 0.04), 0.1);
      lF.scale.set(1, 0.55, 1.2);
      rF.scale.set(1, 0.55, 1.2);

      group.add(body, lF, rF);

      const acc = accRef.current.split(',');
      if (stage >= 3 || acc.includes('cape')) {
        const cape = new THREE.Mesh(
          new THREE.PlaneGeometry(0.6, 0.8),
          new THREE.MeshStandardMaterial({ color: 0x8b0000, side: THREE.DoubleSide, roughness: 0.6 }),
        );
        cape.position.set(0, -0.1, -(br - 0.05));
        cape.rotation.x = 0.15;
        group.add(cape);
      }
    },
    [],
  );

  // ── EFFECT 1: Mount ──────────────────────────────────────

  useEffect(() => {
    const el = mountRef.current;
    if (!el || mountedRef.current) return;
    mountedRef.current = true;

    const scene = new THREE.Scene();
    scene.background = skyTexture();
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(42, el.clientWidth / H, 0.1, 50);
    cam.position.set(0, 0.5, 3.6);
    cam.lookAt(0, 0.0, 0);
    cameraRef.current = cam;

    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.setSize(el.clientWidth, H);
    el.appendChild(r.domElement);
    rendererRef.current = r;

    // Lighting — warm sunlight + sky fill (only 2 directional + ambient)
    scene.add(new THREE.AmbientLight(0xfff8f0, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
    sun.position.set(3, 5, 2);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xaac4dd, 0.35);
    fill.position.set(-2, 3, 3);
    scene.add(fill);

    // Ground (grass)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2, 32),
      new THREE.MeshStandardMaterial({ color: 0x8cb888, roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    scene.add(ground);

    // Garden flowers + grass blades
    const garden = new THREE.Group();
    gardenRef.current = garden;
    buildGarden(scene, garden);

    // Pollen particles (sprites — cheap billboarded quads)
    const pGroup = new THREE.Group();
    const pTex = pollenTexture();
    const pMat = new THREE.SpriteMaterial({ map: pTex, transparent: true, depthWrite: false, opacity: 0.7 });
    for (let i = 0; i < PARTICLE_N; i++) {
      const sp = new THREE.Sprite(pMat);
      const sz = 0.05 + Math.random() * 0.04;
      sp.scale.set(sz, sz, sz);
      const a = (i / PARTICLE_N) * Math.PI * 2;
      const rad = 0.7 + Math.random() * 0.5;
      const h = -0.3 + Math.random() * 0.8;
      sp.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad);
      sp.userData = { a, rad, h, spd: 0.1 + Math.random() * 0.15, ph: Math.random() * 6.28 };
      pGroup.add(sp);
    }
    scene.add(pGroup);
    particlesRef.current = pGroup;

    // Pet group
    const pg = new THREE.Group();
    scene.add(pg);
    petGroupRef.current = pg;
    buildPet(pg, stageRef.current, committedRef.current, crackRef.current);

    // Resize
    const onResize = () => {
      const w = el.clientWidth;
      r.setSize(w, H);
      cam.aspect = w / H;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // Animation loop — kept lean
    const loop = () => {
      frameRef.current = requestAnimationFrame(loop);
      const t = performance.now() * 0.001;
      const g = petGroupRef.current;

      if (g) {
        g.scale.y = 1 + Math.sin(t * 2) * breathRef.current;
        g.position.y = Math.sin(t * 1.2) * 0.015;

        const tf = isEggRef.current ? 0.08 : 0.35;
        g.rotation.z += (THREE.MathUtils.degToRad(tiltRef.current * tf) - g.rotation.z) * 0.05;
        g.rotation.x = isEggRef.current ? 0 : THREE.MathUtils.degToRad(
          Math.max(-6, Math.min(6, (55 - scoreRef.current) * 0.08)),
        );
        g.rotation.y = Math.sin(t * 0.5) * 0.03;

        // Color lerp (only during health transitions)
        const cc = curColorRef.current;
        const tc = tgtColorRef.current;
        if (!cc.equals(tc)) {
          cc.lerp(tc, COLOR_LERP);
          g.traverse((ch) => {
            if (ch instanceof THREE.Mesh && ch.material instanceof THREE.MeshStandardMaterial) {
              const hex = ch.material.color.getHex();
              if (SKIP_HEX.has(hex) || hex === 0xfaf5ed || hex === 0xd4a050) return;
              ch.material.color.copy(cc);
              ch.material.emissive.copy(cc);
            }
          });
        }
      }

      // Orbiting pollen
      const pg2 = particlesRef.current;
      if (pg2) {
        for (let i = 0; i < pg2.children.length; i++) {
          const s = pg2.children[i];
          const d = s.userData as { a: number; rad: number; h: number; spd: number; ph: number };
          d.a += d.spd * 0.006;
          s.position.x = Math.cos(d.a) * d.rad;
          s.position.z = Math.sin(d.a) * d.rad;
          s.position.y = d.h + Math.sin(t * 0.7 + d.ph) * 0.1;
        }
      }

      // Gentle flower sway
      const gg = gardenRef.current;
      if (gg) {
        for (let i = 0; i < gg.children.length; i++) {
          const ch = gg.children[i];
          if (ch instanceof THREE.Group) {
            ch.rotation.z = Math.sin(t * 0.8 + i * 1.3) * 0.04;
          }
        }
      }

      r.render(scene, cam);
    };
    loop();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose();
          if (o.material instanceof THREE.Material) o.material.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        }
        if (o instanceof THREE.Sprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
      r.dispose();
      if (el.contains(r.domElement)) el.removeChild(r.domElement);
      mountedRef.current = false;
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      petGroupRef.current = null;
      gardenRef.current = null;
      particlesRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  // ── EFFECT 2: Health hysteresis ──────────────────────────

  useEffect(() => {
    const h = pet.health;
    if (h !== pendingRef.current) {
      pendingRef.current = h;
      pendingSinceRef.current = Date.now();
    }
    const dt = Date.now() - pendingSinceRef.current;
    if (h !== committedRef.current && dt >= HEALTH_HYSTERESIS_MS) {
      committedRef.current = h;
      tgtColorRef.current = HEALTH_COLORS[h].clone();
      breathRef.current = HEALTH_BREATH[h];
      setCommitted(h);
    }
  }, [pet.health]);

  useEffect(() => {
    const iv = setInterval(() => {
      const p = pendingRef.current;
      if (p !== committedRef.current && Date.now() - pendingSinceRef.current >= HEALTH_HYSTERESIS_MS) {
        committedRef.current = p;
        tgtColorRef.current = HEALTH_COLORS[p].clone();
        breathRef.current = HEALTH_BREATH[p];
        setCommitted(p);
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // ── EFFECT 3: Rebuild on stage / crack ───────────────────

  useEffect(() => {
    const g = petGroupRef.current;
    if (!g) return;
    const sc = pet.stage !== stageRef.current;
    const cc = pet.stage === 0 && (
      (pet.eggCrackProgress > 20 && crackRef.current <= 20) ||
      (pet.eggCrackProgress > 50 && crackRef.current <= 50) ||
      (pet.eggCrackProgress > 80 && crackRef.current <= 80)
    );
    if (sc || cc) {
      stageRef.current = pet.stage;
      crackRef.current = pet.eggCrackProgress;
      buildPet(g, pet.stage, committedRef.current, pet.eggCrackProgress);
      curColorRef.current = HEALTH_COLORS[committedRef.current].clone();
      tgtColorRef.current = HEALTH_COLORS[committedRef.current].clone();
    }
  }, [pet.stage, pet.eggCrackProgress, buildPet]);

  // ── EFFECT 4: Materials on health commit ─────────────────

  useEffect(() => {
    const g = petGroupRef.current;
    if (!g) return;
    g.traverse((ch) => {
      if (ch instanceof THREE.Mesh && ch.material instanceof THREE.MeshStandardMaterial) {
        if (SKIP_HEX.has(ch.material.color.getHex())) return;
        ch.material.emissiveIntensity = HEALTH_EMISSIVE[committed];
      }
    });
    if (stageRef.current > 0) {
      buildPet(g, stageRef.current, committed, crackRef.current);
      curColorRef.current = HEALTH_COLORS[committed].clone();
      tgtColorRef.current = HEALTH_COLORS[committed].clone();
    }
  }, [committed, buildPet]);

  // ── Render ──────────────────────────────────────────────

  const hc =
    pet.health === 'Thriving' ? 'var(--green-primary)' : pet.health === 'Fading' ? 'var(--amber-primary)' : 'var(--red-primary)';
  const hbg =
    pet.health === 'Thriving' ? 'var(--green-bg)' : pet.health === 'Fading' ? 'var(--amber-bg)' : 'var(--red-bg)';

  const STAGE_MINS = [0, 10, 30, 120, 300, 600];
  const nxt = STAGE_MINS[Math.min(pet.stage + 1, STAGE_MINS.length - 1)];
  const cur = STAGE_MINS[pet.stage] ?? 0;
  const prog = pet.stage >= 5 ? 100 : Math.min(100, Math.round(((pet.totalLockedInMinutes - cur) / Math.max(1, nxt - cur)) * 100));

  return (
    <div className="card">
      <h3>Bio-Pet</h3>

      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: H,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
        }}
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
              background: hbg,
              color: hc,
              borderRadius: 999,
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: hc }} />
            {pet.health}
          </span>
        </div>

        {pet.stage < 5 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>
              <span>Evolution</span>
              <span>{prog}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg-card-muted)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${prog}%`, borderRadius: 999, background: hc, transition: 'width 0.6s ease-out' }} />
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
      {label} <strong style={{ color: 'var(--text-primary)' }}>{typeof value === 'number' ? Math.round(value) : value}</strong>
    </span>
  );
}
