import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getItemDef } from '../game/catalog.ts';
import type { FishingCastState, FiscoreProgress, FishFightPattern, InventorySlot } from '../game/network.ts';
import { getRodUpgradeGemCost } from '../game/expansion.ts';
import type { GameConfig } from '../game/config.ts';

interface Fishing3dOverlayProps {
  gems: number;
  inventory: InventorySlot[];
  fiscore: FiscoreProgress;
  gameConfig: GameConfig;
  activeCast: FishingCastState | null;
  biting: boolean;
  progress: number;
  lineTension: number;
  fightPattern: FishFightPattern;
  lastCatchName: string | null;
  onClose: () => void;
  onCastFishing: (rodInstanceId: string, depthLevel: number) => void;
  onReelFishing: () => void;
  onUpgradeFishingRod: (rodInstanceId: string) => void;
}

export const Fishing3dOverlay: React.FC<Fishing3dOverlayProps> = ({
  gems,
  inventory,
  fiscore,
  gameConfig,
  activeCast,
  biting,
  progress,
  lineTension,
  fightPattern,
  lastCatchName,
  onClose,
  onCastFishing,
  onReelFishing,
  onUpgradeFishingRod,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const knobElRef = useRef<HTMLDivElement | null>(null);
  const keyboardRef = useRef(new Set<string>());
  const joystickRef = useRef({ x: 0, y: 0 });
  const stickPointerIdRef = useRef<number | null>(null);
  const positionRef = useRef({ x: 0.5, y: 0.5, yaw: 0 });
  const encounterRef = useRef({ active: false, biting: false, tension: 0.15 });

  const [selectedRodInstanceId, setSelectedRodInstanceId] = useState('');
  const [selectedDepth, setSelectedDepth] = useState(1);

  const rods = useMemo(
    () => inventory.filter((slot) => slot.qty > 0 && Boolean(slot.rodInstanceId) && getItemDef(slot.itemId)?.toolKind === 'rod'),
    [inventory]
  );
  const selectedRod = rods.find((slot) => slot.rodInstanceId === selectedRodInstanceId) ?? rods[0];
  const rodDef = selectedRod ? getItemDef(selectedRod.itemId) : undefined;
  const rodType = rodDef?.rodType ?? 0;
  const upgradeLevel = selectedRod?.rodUpgradeLevel ?? 1;
  const upgradeCost = rodType > 0 && upgradeLevel < 3
    ? getRodUpgradeGemCost(rodType, upgradeLevel + 1, gameConfig.fishing)
    : 0;
  const isCasted = Boolean(activeCast);

  useEffect(() => {
    if (!rods.some((slot) => slot.rodInstanceId === selectedRodInstanceId)) {
      setSelectedRodInstanceId(rods[0]?.rodInstanceId ?? '');
    }
  }, [rods, selectedRodInstanceId]);

  useEffect(() => {
    if (selectedDepth > Math.max(1, rodType)) setSelectedDepth(Math.max(1, rodType));
  }, [selectedDepth, rodType]);

  useEffect(() => {
    encounterRef.current = { active: isCasted, biting, tension: lineTension };
  }, [isCasted, biting, lineTension]);

  const castOrReel = useCallback(() => {
    if (activeCast) {
      if (biting) onReelFishing();
      return;
    }
    if (!selectedRod?.rodInstanceId || selectedDepth > rodType) return;
    onCastFishing(selectedRod.rodInstanceId, selectedDepth);
  }, [activeCast, biting, onReelFishing, onCastFishing, selectedRod, selectedDepth, rodType]);

  const setKnobOffset = useCallback((pxX: number, pxY: number) => {
    if (knobElRef.current) {
      knobElRef.current.style.transform = `translate(calc(-50% + ${Math.round(pxX)}px), calc(-50% + ${Math.round(pxY)}px))`;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        keyboardRef.current.add(key);
      } else if (!event.repeat && (key === ' ' || key === 'j')) {
        event.preventDefault();
        castOrReel();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keyboardRef.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keyboardRef.current.clear();
    };
  }, [castOrReel]);

  // Real-time low-poly third-person island scene. Fishing encounters remain server-authoritative.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch {
      const fallback = canvas.getContext('2d');
      if (fallback) {
        fallback.fillStyle = '#0b4263';
        fallback.fillRect(0, 0, canvas.width = 640, canvas.height = 360);
        fallback.fillStyle = '#d9b96b';
        fallback.beginPath();
        fallback.ellipse(320, 280, 190, 55, 0, 0, Math.PI * 2);
        fallback.fill();
        fallback.fillStyle = '#3d9a58';
        fallback.beginPath();
        fallback.ellipse(320, 270, 135, 40, 0, 0, Math.PI * 2);
        fallback.fill();
        fallback.fillStyle = '#ffffff';
        fallback.font = '16px sans-serif';
        fallback.fillText('3D graphics unavailable on this device', 185, 40);
      }
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#8ac9e8');
    scene.fog = new THREE.Fog('#8ac9e8', 28, 78);

    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 130);
    camera.position.set(0, 5.5, 8);
    const ambient = new THREE.HemisphereLight(0xdaf4ff, 0x45634b, 2.05);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffedc7, 2.1);
    sun.position.set(-12, 24, 10);
    scene.add(sun);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const waterGeometry = new THREE.PlaneGeometry(180, 180, 64, 64);
    waterGeometry.rotateX(-Math.PI / 2);
    const waterPositions = waterGeometry.attributes.position as THREE.BufferAttribute;
    const waterBase = Float32Array.from(waterPositions.array as ArrayLike<number>);
    const water = new THREE.Mesh(
      waterGeometry,
      new THREE.MeshPhongMaterial({ color: 0x087fa7, shininess: 90, specular: 0x72dfff, flatShading: true })
    );
    water.position.y = -0.18;
    scene.add(water);

    const createIslandTop = () => {
      const vertices: number[] = [0, 1.15, 0];
      const colors: number[] = [0.23, 0.53, 0.25];
      const indices: number[] = [];
      const rings = 9;
      const segments = 56;
      for (let ring = 1; ring <= rings; ring++) {
        const ratio = ring / rings;
        for (let segment = 0; segment < segments; segment++) {
          const angle = (segment / segments) * Math.PI * 2;
          const rough = 1 + Math.sin(angle * 5 + ring) * 0.035 + Math.cos(angle * 9 - ring) * 0.018;
          const radius = 10.35 * ratio * rough;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = 0.42 + Math.pow(1 - ratio, 1.35) * 0.82 + Math.sin(angle * 3 + ring * 0.8) * 0.08 * ratio;
          vertices.push(x, y, z);
          const green = 0.36 + (1 - ratio) * 0.14 + Math.sin(angle * 4 + ring) * 0.025;
          colors.push(0.18, green, 0.2);
        }
      }
      for (let segment = 0; segment < segments; segment++) {
        const next = (segment + 1) % segments;
        indices.push(0, 1 + segment, 1 + next);
      }
      for (let ring = 1; ring < rings; ring++) {
        const inner = 1 + (ring - 1) * segments;
        const outer = 1 + ring * segments;
        for (let segment = 0; segment < segments; segment++) {
          const next = (segment + 1) % segments;
          indices.push(inner + segment, outer + segment, outer + next);
          indices.push(inner + segment, outer + next, inner + next);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
      mesh.position.y = 0.02;
      scene.add(mesh);
    };
    createIslandTop();

    const makeAnnulus = (innerRadius: number, outerRadius: number, y: number, color: number) => {
      const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64, 2);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
      mesh.position.y = y;
      scene.add(mesh);
      return mesh;
    };
    makeAnnulus(10.05, 11.65, 0.12, 0xd8bd79);

    const trunkGeometry = new THREE.CylinderGeometry(0.12, 0.2, 2.1, 5);
    const leafGeometry = new THREE.ConeGeometry(0.34, 2.5, 5);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x81512e, flatShading: true });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x267346, flatShading: true });
    const palmPositions = [[-5.4, -2.8], [-2.8, 4.4], [3.8, 2.5], [6.0, -1.2], [-6.3, 2.1], [1.0, 6.1], [-1.4, -6.2]];
    for (const [x, z] of palmPositions) {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 1.1;
      trunk.rotation.z = -0.12;
      palm.add(trunk);
      for (let leaf = 0; leaf < 6; leaf++) {
        const angle = (leaf / 6) * Math.PI * 2;
        const frond = new THREE.Mesh(leafGeometry, leafMaterial);
        frond.position.set(Math.cos(angle) * 0.7, 2.15, Math.sin(angle) * 0.7);
        frond.rotation.z = Math.cos(angle) * 1.05;
        frond.rotation.x = Math.sin(angle) * 1.05;
        palm.add(frond);
      }
      palm.position.set(x, 0.42, z);
      palm.scale.setScalar(0.85 + ((Math.abs(x * 7 + z * 3) % 4) * 0.08));
      scene.add(palm);
    }

    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const rockMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x687b7d, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x52666d, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x8b8b78, flatShading: true }),
    ];
    const rockPositions = [[-8.2, -3.5], [-8.8, 0.4], [7.8, 4.3], [8.7, -2.2], [4.5, 8.1], [-4.3, 8.2], [0.2, -9.1], [-7.1, -6.5]];
    rockPositions.forEach(([x, z], index) => {
      const rock = new THREE.Mesh(rockGeometry, rockMaterials[index % rockMaterials.length]);
      rock.position.set(x, 0.6, z);
      rock.scale.set(0.7 + (index % 3) * 0.28, 0.55 + (index % 2) * 0.3, 0.65 + (index % 4) * 0.12);
      rock.rotation.set(index * 0.4, index * 0.8, index * 0.2);
      scene.add(rock);
    });

    // Timber pier, fishing hut and a small moored skiff establish the shore hub.
    const wood = new THREE.MeshStandardMaterial({ color: 0x91633e, roughness: 0.9 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x543a2c, roughness: 1 });
    const dock = new THREE.Group();
    for (let plank = 0; plank < 8; plank++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.55), wood);
      board.position.set(4.2, 0.28, -8.2 - plank * 0.62);
      dock.add(board);
    }
    for (const x of [3.65, 4.75]) {
      for (const z of [-8.3, -10.2, -12.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.35, 5), darkWood);
        post.position.set(x, -0.15, z);
        dock.add(post);
      }
    }
    scene.add(dock);

    const hut = new THREE.Group();
    const hutBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 1.8), new THREE.MeshStandardMaterial({ color: 0xb97945, flatShading: true }));
    hutBody.position.y = 1.2;
    hut.add(hutBody);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.15, 4), new THREE.MeshStandardMaterial({ color: 0x70432f, flatShading: true }));
    roof.position.y = 2.45;
    roof.rotation.y = Math.PI / 4;
    hut.add(roof);
    hut.position.set(-3.4, 0.4, -5.2);
    scene.add(hut);

    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.3, 3, 7), new THREE.MeshStandardMaterial({ color: 0x8b5434, flatShading: true }));
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(0.8, 0.5, 1);
    boat.add(hull);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.8), darkWood);
    seat.position.y = 0.22;
    boat.add(seat);
    boat.position.set(5.0, -0.02, -13.4);
    boat.rotation.y = -0.25;
    scene.add(boat);

    // Distant rocky islets add a horizon and make the fishing waters feel open.
    for (let island = 0; island < 5; island++) {
      const angle = island * (Math.PI * 2 / 5) + 0.35;
      const radius = 24 + (island % 2) * 4;
      const rockIsland = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1, 1),
        new THREE.MeshStandardMaterial({ color: 0x637d78, flatShading: true })
      );
      rockIsland.position.set(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
      rockIsland.scale.set(3.2, 1.3, 2.5);
      scene.add(rockIsland);
    }

    // Simple stylized third-person avatar with visible facing direction.
    const player = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 3, 6), new THREE.MeshStandardMaterial({ color: 0x1c4058, flatShading: true }));
    body.position.y = 0.86;
    player.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe5b68d, flatShading: true }));
    head.position.y = 1.58;
    player.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x30251f, flatShading: true }));
    hair.position.y = 1.69;
    player.add(hair);
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.38), new THREE.MeshStandardMaterial({ color: 0x38bfc1, flatShading: true }));
    shirt.position.y = 1.02;
    player.add(shirt);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x172435, flatShading: true });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 0.24), legMaterial);
      leg.position.set(side * 0.16, 0.27, 0);
      player.add(leg);
    }
    player.position.set(0, 0.48, 0);
    scene.add(player);

    const encounterMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.06, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0xffd46a })
    );
    encounterMarker.rotation.x = Math.PI / 2;
    encounterMarker.position.set(4.9, 0.03, -14.7);
    scene.add(encounterMarker);

    positionRef.current = { x: 0, y: 0, yaw: 0 };
    let rafId = 0;
    let lastMs = performance.now();
    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', resize);
    resize();

    const frame = (nowMs: number) => {
      const dt = Math.min(0.04, Math.max(0.001, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      const keys = keyboardRef.current;
      const pos = positionRef.current;
      let turn = joystickRef.current.x;
      let forward = -joystickRef.current.y;
      if (keys.has('arrowleft') || keys.has('a')) turn -= 1;
      if (keys.has('arrowright') || keys.has('d')) turn += 1;
      if (keys.has('arrowup') || keys.has('w')) forward += 1;
      if (keys.has('arrowdown') || keys.has('s')) forward -= 1;
      pos.yaw += turn * dt * 2.25;
      const stride = forward * dt * 4.1;
      pos.x += Math.sin(pos.yaw) * stride;
      pos.y -= Math.cos(pos.yaw) * stride;
      const distance = Math.hypot(pos.x, pos.y);
      if (distance > 9.2) {
        pos.x = (pos.x / distance) * 9.2;
        pos.y = (pos.y / distance) * 9.2;
      }

      player.position.set(pos.x, 0.48 + Math.abs(Math.sin(nowMs * 0.009)) * (Math.abs(forward) > 0.05 ? 0.055 : 0.012), pos.y);
      player.rotation.y = pos.yaw;
      const cameraOffset = new THREE.Vector3(Math.sin(pos.yaw) * 6.2, 4.2, Math.cos(pos.yaw) * 6.2);
      const cameraTarget = new THREE.Vector3(pos.x, 1.25, pos.y);
      const desiredCamera = cameraTarget.clone().add(cameraOffset);
      camera.position.lerp(desiredCamera, 1 - Math.pow(0.001, dt));
      camera.lookAt(cameraTarget);

      const positions = waterGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const x = waterBase[i * 3];
        const z = waterBase[i * 3 + 1];
        positions.setZ(i, Math.sin(x * 0.12 + nowMs * 0.0007) * 0.11 + Math.cos(z * 0.15 + nowMs * 0.0009) * 0.07);
      }
      positions.needsUpdate = true;
      waterGeometry.computeVertexNormals();
      boat.position.y = -0.02 + Math.sin(nowMs * 0.0018) * 0.08;
      boat.rotation.z = Math.sin(nowMs * 0.0012) * 0.035;
      encounterMarker.rotation.z += dt * 0.65;
      encounterMarker.visible = encounterRef.current.active;
      encounterMarker.material = encounterRef.current.biting
        ? new THREE.MeshBasicMaterial({ color: 0xff655d })
        : new THREE.MeshBasicMaterial({ color: 0xffd46a });

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const maxRadius = Math.max(18, rect.width * 0.34);
    let x = (event.clientX - (rect.left + rect.width / 2)) / maxRadius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / maxRadius;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    joystickRef.current = { x, y };
    setKnobOffset(x * maxRadius, y * maxRadius);
  };

  const resetJoystick = () => {
    stickPointerIdRef.current = null;
    joystickRef.current = { x: 0, y: 0 };
    setKnobOffset(0, 0);
  };

  const durability = selectedRod
    ? Math.max(0, Math.min(100, Math.round(((selectedRod.durability ?? selectedRod.maxDurability ?? 0) / Math.max(1, selectedRod.maxDurability ?? 1)) * 100)))
    : 0;

  return (
    <div data-testid="fishing-3d-modal" className="fixed inset-0 z-[70] bg-[#060c14] overflow-hidden select-none flex flex-col">
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#0f1d2c] border-b-2 border-[#3b5978] text-[#eaf2fa]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border-2 border-[#38e8d8] bg-[#144c52] flex items-center justify-center font-pixel text-[11px] text-[#e8ffff]">3D</div>
          <div>
            <div className="font-pixel text-xs text-[#38e8d8]">FISCORE · OCEAN EXPEDITION</div>
            <div className="text-[11px] text-[#9cb5cc] font-mono-num">
              FISCORE LVL {fiscore.level} · {fiscore.catches} CATCHES · DEEPEST {fiscore.deepestDepth}/6 · {Math.round(gems)} GEMS
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded border border-[#46678a] bg-[#16283c] hover:bg-[#213c57] font-pixel text-[10px] text-[#fff8e8] cursor-pointer">
          RETURN TO REALMS
        </button>
      </header>

      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} data-testid="fishing-3d-canvas" className="absolute inset-0 w-full h-full touch-none" />

        <div className="absolute top-3 left-3 z-20 rounded-lg border border-[#37617c] bg-[#081725]/90 px-3 py-2 text-[11px] text-[#d6edf8]">
          <div className="font-pixel text-[9px] text-[#8de8ff]">ISLAND SHORE</div>
          <div>Explore the island · Cast into the selected depth zone</div>
          <div className="mt-1 text-[#9cb5cc]">Movement: WASD / Arrow Keys / Joystick</div>
        </div>

        {lastCatchName && (
          <div className="absolute inset-x-0 top-16 z-20 flex justify-center px-3">
            <div className="rounded-lg border-2 border-[#f2b738] bg-[#0f1d2c]/96 px-6 py-3 shadow-2xl text-center">
              <span className="font-pixel text-xs text-[#ffe18c] block">SERVER CONFIRMED CATCH</span>
              <span className="text-sm font-bold text-[#e8ffff] mt-1 block">{lastCatchName}</span>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 flex flex-wrap items-end justify-between gap-3 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <div
              data-testid="fishing-joystick"
              className="relative w-24 h-24 rounded-full border-2 border-[#38e8d8] bg-[#0f1d2c]/90 shadow-xl touch-none select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
              onPointerDown={(event) => {
                stickPointerIdRef.current = event.pointerId;
                try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
                updateJoystick(event);
              }}
              onPointerMove={(event) => {
                if (stickPointerIdRef.current === event.pointerId) updateJoystick(event);
              }}
              onPointerUp={(event) => {
                if (stickPointerIdRef.current === event.pointerId) resetJoystick();
              }}
              onPointerCancel={resetJoystick}
            >
              <div ref={knobElRef} className="absolute w-11 h-11 rounded-full border-2 border-[#f2b738] bg-[#144c52] shadow-lg" style={{ transform: 'translate(-50%, -50%)' }} />
            </div>
            <span className="font-pixel text-[8px] text-[#9cb5cc] bg-[#09131d]/90 px-2 py-0.5 rounded border border-[#314e6b]">WASD / STICK</span>
          </div>

          <div className="pointer-events-auto w-full sm:w-[min(440px,calc(100%-120px))] rounded-xl border border-[#314e6b] bg-[#0f1d2c]/95 p-3 sm:p-4 shadow-2xl">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-[#9cb5cc]">
                EQUIPPED ROD
                <select
                  value={selectedRod?.rodInstanceId ?? ''}
                  onChange={(event) => setSelectedRodInstanceId(event.target.value)}
                  disabled={isCasted || rods.length === 0}
                  className="mt-1 w-full rounded border border-[#46678a] bg-[#091725] px-2 py-2 text-xs text-white"
                >
                  {rods.map((slot) => {
                    const def = getItemDef(slot.itemId);
                    return <option key={slot.rodInstanceId} value={slot.rodInstanceId}>{def?.name ?? 'Fishing Rod'} · Lv {slot.rodUpgradeLevel ?? 1}</option>;
                  })}
                </select>
              </label>
              <label className="text-[10px] text-[#9cb5cc]">
                FISHING DEPTH
                <select
                  value={selectedDepth}
                  onChange={(event) => setSelectedDepth(Number(event.target.value))}
                  disabled={isCasted || !selectedRod}
                  className="mt-1 w-full rounded border border-[#46678a] bg-[#091725] px-2 py-2 text-xs text-white"
                >
                  {[1, 2, 3, 4, 5, 6].map((depth) => <option key={depth} value={depth} disabled={depth > rodType}>Depth {depth}{depth > rodType ? ' · Rod required' : ''}</option>)}
                </select>
              </label>
            </div>

            {selectedRod && (
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#b9d2e8]">
                <span>{rodDef?.name} · Type {rodType} · Upgrade {upgradeLevel}/3</span>
                <span>Durability {durability}%</span>
              </div>
            )}
            {selectedRod && upgradeLevel < 3 && (
              <button
                type="button"
                disabled={isCasted || gems < upgradeCost}
                onClick={() => onUpgradeFishingRod(selectedRod.rodInstanceId!)}
                className="mt-2 w-full rounded border border-[#a87b2b] bg-[#4d3917] px-3 py-2 text-[10px] font-bold text-[#ffe18c] disabled:opacity-40"
              >
                UPGRADE ROD · {upgradeCost} GEMS
              </button>
            )}

            {isCasted ? (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-[10px] text-[#ffe18c]">{biting ? 'FISH ON THE LINE!' : 'WAITING FOR A BITE...'}</span>
                  <span className="text-[10px] text-[#9cb5cc]">Depth {activeCast?.depthLevel ?? selectedDepth}</span>
                </div>
                <div className="mt-2 h-3 rounded bg-[#08101a] overflow-hidden border border-[#243c54]">
                  <div className="h-full bg-[#38e8d8] transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-[#9cb5cc]">
                  <span>Line tension: {Math.round(lineTension * 100)}%</span>
                  <span>Fish movement: {fightPattern.replace('_', ' ')}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-[#08101a] overflow-hidden">
                  <div className={lineTension > 0.82 ? 'h-full bg-[#ef4444]' : 'h-full bg-[#f2b738]'} style={{ width: `${Math.max(0, Math.min(100, lineTension * 100))}%` }} />
                </div>
                <button
                  type="button"
                  disabled={!biting}
                  onClick={onReelFishing}
                  className="mt-3 w-full rounded-lg border-2 border-[#f2b738] bg-[#b8862d] px-5 py-3 text-[#171005] font-pixel text-xs shadow-lg disabled:opacity-40"
                >
                  REEL IN! (SPACE)
                </button>
                {!biting && <p className="mt-2 text-center text-[10px] text-[#9cb5cc]">The server will signal when a fish bites. Reeling early is not allowed.</p>}
              </div>
            ) : (
              <div className="mt-3">
                {!selectedRod ? (
                  <p className="rounded bg-[#311d1d] px-3 py-2 text-center text-xs text-[#ffc6c6]">Preparing starter rod… If it does not appear, reconnect and reopen Fiscore.</p>
                ) : (
                  <button
                    type="button"
                    disabled={selectedDepth > rodType}
                    onClick={castOrReel}
                    className="w-full rounded-xl border-2 border-[#38e8d8] bg-[#144c52] px-6 py-4 text-[#e8ffff] font-pixel text-xs shadow-xl disabled:opacity-40"
                  >
                    CAST LINE · DEPTH {selectedDepth} (SPACE)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
