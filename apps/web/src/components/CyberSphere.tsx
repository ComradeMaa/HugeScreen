import { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════
   CyberSphere — 赛博镂空球体（地球-3）
   电光蓝原点球面 + 琥珀橙大陆原点 + Fresnel 辉光
   ═══════════════════════════════════════════════════ */

const RADIUS = 1000;
const GRID_LAT_STEP = 15;
const GRID_LON_STEP = 15;

/** 球面坐标 → 3D */
function geoToSphere(lon: number, lat: number, r: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 90);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/** 加载海岸线 → 闭合多边形环（用于点-多边形测试） */
async function loadLandPolygons(): Promise<{ lon: number; lat: number }[][][]> {
  const res = await fetch('/data/ne_110m_coastline.json');
  if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
  const json = await res.json();
  const polygons: { lon: number; lat: number }[][][] = [];

  const processCoords = (coords: number[][]) => {
    // 只保留足够大的环（过滤小岛/湖泊）
    if (coords.length < 6) return;
    const ring = coords.map(([lon, lat]) => ({ lon, lat }));
    polygons.push([ring]);
  };

  for (const geom of json.geometries) {
    if (geom.type === 'LineString') {
      processCoords(geom.coordinates);
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) processCoords(line);
    } else if (geom.type === 'Polygon') {
      const rings = geom.coordinates.map((ring: number[][]) =>
        ring.map(([lon, lat]) => ({ lon, lat })));
      if (rings[0]?.length >= 6) polygons.push(rings);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        const rings = poly.map((ring: number[][]) =>
          ring.map(([lon, lat]) => ({ lon, lat })));
        if (rings[0]?.length >= 6) polygons.push(rings);
      }
    }
  }
  return polygons;
}

/** 射线法：点是否在多边形内（2D lon/lat 空间） */
function pointInPolygon(lon: number, lat: number, ring: { lon: number; lat: number }[]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = ring[i].lat, yj = ring[j].lat;
    if ((yi > lat) !== (yj > lat)) {
      const xInt = ring[i].lon + ((lat - yi) / (yj - yi)) * (ring[j].lon - ring[i].lon);
      if (lon < xInt) inside = !inside;
    }
  }
  return inside;
}

function pointInLand(lon: number, lat: number, polygons: { lon: number; lat: number }[][][]): boolean {
  for (const rings of polygons) {
    if (pointInPolygon(lon, lat, rings[0])) {
      // Check if inside any hole (ring 1+)
      let inHole = false;
      for (let h = 1; h < rings.length; h++) {
        if (pointInPolygon(lon, lat, rings[h])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

/** 多边形包围盒 */
interface BBox { minLon: number; maxLon: number; minLat: number; maxLat: number; rings: { lon: number; lat: number }[][]; }

/** 为每个大陆预计算包围盒，加速后续点-多边形测试 */
function buildBBoxes(polygons: { lon: number; lat: number }[][][]): BBox[] {
  return polygons.map(rings => {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const p of rings[0]) {
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
    }
    return { minLon, maxLon, minLat, maxLat, rings };
  });
}

/** 异步分块采样大陆原点，不阻塞主线程 */
async function sampleLandDots(
  bboxes: BBox[], r: number,
): Promise<Float32Array> {
  const positions: number[] = [];
  const step = 0.9;
  const lonVals: number[] = [];
  for (let lon = -180; lon <= 180; lon += step) lonVals.push(lon);

  // 分块处理，每块之间让出主线程
  const CHUNK = 40; // 每次处理 40 个经度
  for (let ci = 0; ci < lonVals.length; ci += CHUNK) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const end = Math.min(ci + CHUNK, lonVals.length);
    for (let li = ci; li < end; li++) {
      const lon = lonVals[li];
      for (let lat = -80; lat <= 80; lat += step) {
        // 包围盒快速剔除
        let inLand = false;
        for (const bb of bboxes) {
          if (lon < bb.minLon || lon > bb.maxLon || lat < bb.minLat || lat > bb.maxLat) continue;
          if (pointInPolygon(lon, lat, bb.rings[0])) {
            let inHole = false;
            for (let h = 1; h < bb.rings.length; h++) {
              if (pointInPolygon(lon, lat, bb.rings[h])) { inHole = true; break; }
            }
            if (!inHole) { inLand = true; break; }
          }
        }
        if (inLand) {
          const jLon = lon + (Math.random() - 0.5) * step * 0.5;
          const jLat = lat + (Math.random() - 0.5) * step * 0.5;
          const v = geoToSphere(jLon, jLat, r + 1.8);
          positions.push(v.x, v.y, v.z);
        }
      }
    }
  }
  return new Float32Array(positions);
}

/** 生成经纬线网格 */
function createGrids(r: number): THREE.Vector3[][] {
  const lines: THREE.Vector3[][] = [];
  for (let lat = -75; lat <= 75; lat += GRID_LAT_STEP) {
    const pts: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 2) pts.push(geoToSphere(lon, lat, r));
    lines.push(pts);
  }
  for (let lon = -180; lon < 180; lon += GRID_LON_STEP) {
    const pts: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 2) pts.push(geoToSphere(lon, lat, r));
    lines.push(pts);
  }
  return lines;
}

function linesToGeometry(lines: THREE.Vector3[][]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      positions.push(line[i].x, line[i].y, line[i].z, line[i + 1].x, line[i + 1].y, line[i + 1].z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

interface CyberSphereProps {
  canvasW: number;
  canvasH: number;
}

export function CyberSphere({ canvasW, canvasH }: CyberSphereProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridLines = useMemo(() => createGrids(RADIUS), []);
  const [landDots, setLandDots] = useState<Float32Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const polygons = await loadLandPolygons();
      if (cancelled) return;
      const bboxes = buildBBoxes(polygons);
      const positions = await sampleLandDots(bboxes, RADIUS);
      if (cancelled) return;
      setLandDots(positions);
    })().catch(console.error);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // ── 渲染器 ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    Object.assign(renderer.domElement.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
    });
    renderer.setSize(canvasW, canvasH);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const globeGroup = new THREE.Group();

    // ── 透视相机 ──
    const aspect = canvasW / canvasH;
    const fov = 35;
    const camera = new THREE.PerspectiveCamera(fov, aspect, 100, 12000);
    const camDist = 3800;
    camera.position.set(0, camDist * 0.2, camDist);
    camera.lookAt(0, 0, 0);

    // ── 暗色衬底球面 ──
    const baseGeo = new THREE.SphereGeometry(RADIUS, 64, 32);
    const baseMat = new THREE.MeshBasicMaterial({
      color: 0x2C2C34, transparent: false, side: THREE.FrontSide,
    });
    globeGroup.add(new THREE.Mesh(baseGeo, baseMat));

    // ── 背面遮挡球（渲染顺序靠后，阻止背面元素穿透）──
    const backGeo = new THREE.SphereGeometry(RADIUS - 10, 64, 32);
    const backMat = new THREE.MeshBasicMaterial({
      color: 0x1a1a22, side: THREE.BackSide, depthWrite: true,
    });
    globeGroup.add(new THREE.Mesh(backGeo, backMat));

    // ── 电光蓝海洋原点（均匀分布）──
    const OCEAN_DOTS = 4500;
    const oceanPositions = new Float32Array(OCEAN_DOTS * 3);
    const oceanSizes = new Float32Array(OCEAN_DOTS);
    for (let i = 0; i < OCEAN_DOTS; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      oceanPositions[i * 3] = (RADIUS + 1.5) * Math.sin(phi) * Math.cos(theta);
      oceanPositions[i * 3 + 1] = (RADIUS + 1.5) * Math.cos(phi);
      oceanPositions[i * 3 + 2] = (RADIUS + 1.5) * Math.sin(phi) * Math.sin(theta);
      oceanSizes[i] = 1.5 + Math.random() * 4.0;
    }
    const oceanGeo = new THREE.BufferGeometry();
    oceanGeo.setAttribute('position', new THREE.BufferAttribute(oceanPositions, 3));
    oceanGeo.setAttribute('size', new THREE.BufferAttribute(oceanSizes, 1));
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#00D4FF') },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        varying float vRandom;
        varying float vSize;
        uniform float uTime;
        void main() {
          vSize = size;
          vRandom = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (180.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vRandom;
        varying float vSize;
        uniform vec3 uColor;
        uniform float uTime;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float alpha = 1.0 - smoothstep(0.0, 1.0, d);
          float flicker = 0.65 + 0.35 * sin(uTime * 1.5 + vRandom * 62.8);
          gl_FragColor = vec4(uColor, alpha * flicker * 0.55);
        }
      `,
      transparent: true, depthWrite: false,
    });
    globeGroup.add(new THREE.Points(oceanGeo, oceanMat));

    // ── 琥珀橙大陆原点（海岸线轮廓内密集填充）──
    if (landDots) {
      const landGeo = new THREE.BufferGeometry();
      landGeo.setAttribute('position', new THREE.BufferAttribute(landDots, 3));
      globeGroup.add(new THREE.Points(landGeo, new THREE.PointsMaterial({
        color: 0xFF8C42,
        size: 6.0,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })));
    }

    // ── 经纬网格（弱蓝）──
    const gridGeo = linesToGeometry(gridLines);
    globeGroup.add(new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({ color: 0x00D4FF, transparent: true, opacity: 0.08 }),
    ));

    // ── 赤道环 ──
    const torusGeo = new THREE.TorusGeometry(RADIUS + 3, 1.5, 16, 200);
    const torus = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: 0x00D4FF, transparent: true, opacity: 0.28 }));
    torus.rotation.x = Math.PI / 2;
    globeGroup.add(torus);

    // ── Fresnel 辉光（双层）──
    const makeGlow = (extraR: number, intensity: number, falloff: number) => {
      const gGeo = new THREE.SphereGeometry(RADIUS + extraR, 64, 32);
      const gMat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color('#00D4FF') },
          uIntensity: { value: intensity },
          uFalloff: { value: falloff },
        },
        vertexShader: `varying vec3 vN; varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vN; varying vec3 vW; uniform vec3 uColor; uniform float uIntensity; uniform float uFalloff; void main() { float f=1.0-abs(dot(normalize(cameraPosition-vW),vN)); f=pow(f,uFalloff); gl_FragColor=vec4(uColor,f*uIntensity); }`,
        transparent: true, depthWrite: false,
      });
      return new THREE.Mesh(gGeo, gMat);
    };
    globeGroup.add(makeGlow(8, 0.10, 3.0));
    globeGroup.add(makeGlow(25, 0.05, 5.0));

    scene.add(globeGroup);

    // ── 动画 ──
    let raf = 0;
    const animate = () => {
      globeGroup.rotation.y += 0.0008;
      oceanMat.uniforms.uTime.value += 0.016;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [canvasW, canvasH, gridLines, landDots]);

  return <div ref={containerRef} className="absolute inset-0 pointer-events-none" />;
}
