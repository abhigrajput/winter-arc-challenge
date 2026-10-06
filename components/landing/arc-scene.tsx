'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { ProgressSource } from '@/components/landing/scroll-progress';

/**
 * Landing hero: falling snow + the glowing 90-day arc from the app icon.
 * Geometry and shaders only — no models, no textures. Loaded with
 * next/dynamic (ssr: false) after first paint; see hero-backdrop.tsx.
 */

const ARC_RADIUS = 1.55;
const ARC_SWEEP = Math.PI * 1.5; // 270°, gap at the bottom like the icon
const ICE = new THREE.Color('#26aff3');

/** Small seeded PRNG (mulberry32): same flake layout every visit, and pure. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Snow: one InstancedMesh, motion entirely in the vertex shader.
// ---------------------------------------------------------------------------
const snowVertex = /* glsl */ `
  uniform float uTime;
  uniform vec3 uArea;
  uniform vec2 uParallax;
  attribute vec4 aSeed;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = (aSeed.xyz - 0.5) * uArea;
    float speed = 0.18 + aSeed.w * 0.5;
    p.y = mod(aSeed.y * uArea.y - uTime * speed, uArea.y) - uArea.y * 0.5;
    p.x += sin(uTime * 0.5 + aSeed.w * 31.0) * 0.22;
    p.z += cos(uTime * 0.35 + aSeed.x * 17.0) * 0.12;
    // Nearer flakes move more: depth-scaled parallax.
    float depth = (p.z + uArea.z * 0.5) / uArea.z;
    p.xy += uParallax * depth * 0.35;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = mix(0.010, 0.040, fract(aSeed.w * 7.13)) * (0.6 + depth);
    mv.xy += position.xy * size; // camera-facing billboard
    vAlpha = mix(0.15, 0.9, depth);
    gl_Position = projectionMatrix * mv;
  }
`;

const snowFragment = /* glsl */ `
  varying float vAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.86, 0.94, 1.0, a);
  }
`;

function Snow({ count, parallax }: { count: number; parallax: React.RefObject<THREE.Vector2> }) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const seeds = new Float32Array(count * 4);
    const random = seeded(90);
    for (let i = 0; i < seeds.length; i += 1) seeds[i] = random();
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    return {
      geometry: geo,
      uniforms: {
        uTime: { value: 0 },
        uArea: { value: new THREE.Vector3(9, 7, 6) },
        uParallax: { value: new THREE.Vector2() },
      },
    };
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uTime!.value += Math.min(delta, 0.05);
    (m.uniforms.uParallax!.value as THREE.Vector2).lerp(parallax.current, 0.05);
  });

  return (
    <instancedMesh args={[geometry, undefined, count]} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={snowVertex}
        fragmentShader={snowFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// The arc: a torus segment that fills by discarding fragments past progress.
// ---------------------------------------------------------------------------
const arcVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const arcFragment = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uGlow;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    if (vUv.x > uProgress) discard;
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 2.0);
    float head = smoothstep(uProgress - 0.05, uProgress, vUv.x);
    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 - vUv.x * 18.0);
    if (uGlow > 0.5) {
      // Soft additive halo around the solid tube.
      float a = pow(facing, 3.0) * 0.22 * pulse + head * 0.12;
      gl_FragColor = vec4(uColor, a);
      return;
    }
    vec3 col = uColor * (0.55 + 0.45 * rim) * pulse + vec3(0.85, 0.96, 1.0) * (rim * 0.5 + head * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Arc({
  progress,
  parallax,
}: {
  progress: ProgressSource;
  parallax: React.RefObject<THREE.Vector2>;
}) {
  const group = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const solid = useRef<THREE.ShaderMaterial>(null);
  const current = useRef(0);
  const { viewport } = useThree();

  const { tube, halo, solidUniforms, glowUniforms } = useMemo(() => {
    const shared = { uProgress: { value: 0 }, uTime: { value: 0 }, uColor: { value: ICE } };
    return {
      tube: new THREE.TorusGeometry(ARC_RADIUS, 0.07, 24, 320, ARC_SWEEP),
      halo: new THREE.TorusGeometry(ARC_RADIUS, 0.2, 16, 220, ARC_SWEEP),
      solidUniforms: { ...shared, uGlow: { value: 0 } },
      glowUniforms: { ...shared, uGlow: { value: 1 } },
    };
  }, []);

  useEffect(
    () => () => {
      tube.dispose();
      halo.dispose();
    },
    [tube, halo],
  );

  useFrame((state, delta) => {
    // Ease toward the scroll position so the fill glides rather than jumps.
    current.current += (progress.get() - current.current) * Math.min(1, delta * 6);
    const p = current.current;
    // The glow material shares these uniform objects, so one write updates both.
    const uniforms = solid.current?.uniforms;
    if (uniforms) {
      uniforms.uProgress!.value = p;
      uniforms.uTime!.value = state.clock.elapsedTime;
    }

    if (head.current) {
      const t = p * ARC_SWEEP;
      head.current.position.set(ARC_RADIUS * Math.cos(t), ARC_RADIUS * Math.sin(t), 0);
      head.current.scale.setScalar(p > 0.002 ? 1 : 0.6);
    }

    const g = group.current;
    if (g) {
      const target = parallax.current;
      g.rotation.x += (-target.y * 0.25 - g.rotation.x) * 0.05;
      g.rotation.y += (target.x * 0.35 - g.rotation.y) * 0.05;
    }
  });

  // Keep the whole ring on screen in portrait: shrink to fit the width.
  const fit = Math.min(1, viewport.width / (ARC_RADIUS * 2 + 0.9));

  return (
    <group ref={group} scale={fit}>
      {/* Mirror + rotate so the fill runs clockwise from bottom-left, like the icon. */}
      <group scale={[-1, 1, 1]} rotation={[0, 0, Math.PI / 4]}>
        <mesh geometry={tube}>
          <meshBasicMaterial color={ICE} transparent opacity={0.1} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={tube}>
          <shaderMaterial
            ref={solid}
            vertexShader={arcVertex}
            fragmentShader={arcFragment}
            uniforms={solidUniforms}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={halo}>
          <shaderMaterial
            vertexShader={arcVertex}
            fragmentShader={arcFragment}
            uniforms={glowUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh ref={head}>
          <sphereGeometry args={[0.13, 24, 24]} />
          <meshBasicMaterial color="#e6f6fe" />
        </mesh>
      </group>
    </group>
  );
}

/** Mouse (desktop) and device tilt (phones) as -1..1 on both axes. */
function useParallax(): React.RefObject<THREE.Vector2> {
  const value = useRef(new THREE.Vector2());
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      value.current.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      value.current.set(
        Math.max(-1, Math.min(1, e.gamma / 30)),
        Math.max(-1, Math.min(1, (e.beta - 45) / 30)),
      );
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    // iOS needs a permission prompt for this; it simply never fires there.
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);
  return value;
}

export default function ArcScene({
  progress,
  active,
  snow,
  onReady,
}: {
  progress: ProgressSource;
  /** False when the hero is off-screen or the tab is hidden: rendering stops. */
  active: boolean;
  snow: number;
  onReady?: () => void;
}) {
  const parallax = useParallax();
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      dpr={[1, dpr]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={() => onReady?.()}
      aria-hidden
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <Snow count={snow} parallax={parallax} />
      <Arc progress={progress} parallax={parallax} />
    </Canvas>
  );
}
