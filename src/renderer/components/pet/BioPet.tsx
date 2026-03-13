import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PetState } from '@renderer/lib/types';

interface BioPetProps {
  pet: PetState;
  postureTilt: number;
  postureScore: number;
  focusScore: number;
  stressScore: number;
}

function healthColor(health: PetState['health']): number {
  if (health === 'Thriving') return 0x4a7c59;
  if (health === 'Fading') return 0xc4962c;
  return 0xc0392b;
}

export function BioPet({
  pet,
  postureTilt,
  postureScore,
  focusScore,
  stressScore,
}: BioPetProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const petGroupRef = useRef<THREE.Group | null>(null);

  const modelPath = useMemo(() => 'assets/models/pet.glb', []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101720);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / 220, 0.1, 100);
    camera.position.set(0, 1.4, 4.8);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, 220);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(3, 4, 2);
    scene.add(ambient, key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 32),
      new THREE.MeshStandardMaterial({ color: 0x1a212b }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.6;
    scene.add(floor);

    const petGroup = new THREE.Group();
    scene.add(petGroup);
    petGroupRef.current = petGroup;

    const buildFallbackPet = () => {
      petGroup.clear();
      if (pet.stage === 0) {
        const egg = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 32, 32),
          new THREE.MeshStandardMaterial({
            color: healthColor(pet.health),
            roughness: 0.35,
            metalness: 0.05,
            emissive: healthColor(pet.health),
            emissiveIntensity: 0.25,
          }),
        );
        egg.scale.set(0.78, 1, 0.78);
        petGroup.add(egg);

        // Crack rings progressively appear before hatch.
        if (pet.eggCrackProgress > 20) {
          const crack = new THREE.Mesh(
            new THREE.TorusGeometry(0.45, 0.012, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xf2e8ce }),
          );
          crack.rotation.x = Math.PI / 2.2;
          crack.position.y = 0.1;
          petGroup.add(crack);
        }
        return;
      }

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.75 + pet.stage * 0.06, 24, 24),
        new THREE.MeshStandardMaterial({
          color: healthColor(pet.health),
          emissive: healthColor(pet.health),
          emissiveIntensity: pet.health === 'Thriving' ? 0.28 : pet.health === 'Fading' ? 0.15 : 0.05,
          roughness: 0.55,
        }),
      );

      const leftEye = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
      const rightEye = leftEye.clone();
      leftEye.position.set(-0.2, 0.15, 0.58);
      rightEye.position.set(0.2, 0.15, 0.58);
      body.add(leftEye);
      body.add(rightEye);
      petGroup.add(body);
    };

    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        petGroup.clear();
        const loaded = gltf.scene;
        loaded.scale.setScalar(0.9 + pet.stage * 0.04);
        loaded.position.y = -0.1;
        petGroup.add(loaded);
      },
      undefined,
      () => buildFallbackPet(),
    );

    const onResize = () => {
      if (!mount) return;
      renderer.setSize(mount.clientWidth, 220);
      camera.aspect = mount.clientWidth / 220;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = performance.now() / 1000;
      if (petGroupRef.current) {
        const scaleY = 1 + Math.sin(t * 2) * (pet.health === 'Thriving' ? 0.04 : pet.health === 'Fading' ? 0.02 : 0.01);
        petGroupRef.current.scale.y = scaleY;
        petGroupRef.current.rotation.z = THREE.MathUtils.degToRad(postureTilt * 0.5);
        petGroupRef.current.rotation.x = THREE.MathUtils.degToRad(Math.max(-8, Math.min(8, (55 - postureScore) * 0.12)));
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      mount.innerHTML = '';
    };
  }, [modelPath, pet, postureScore, postureTilt]);

  return (
    <div className="card">
      <h3>Bio-Pet</h3>
      <div ref={mountRef} style={{ width: '100%', height: 220, borderRadius: 10, overflow: 'hidden' }} />
      <div className="pet-meta">
        <strong>
          Stage {pet.stage} · {pet.stageName} · {pet.health}
        </strong>
        <span>
          Posture {postureScore} · Focus {focusScore} · Stress {stressScore}
        </span>
        <span>Locked in {Math.round(pet.totalLockedInMinutes)} min</span>
      </div>
    </div>
  );
}
