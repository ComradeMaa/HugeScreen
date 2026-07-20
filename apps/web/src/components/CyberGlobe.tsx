import { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';

function geoToSphere(lon: number, lat: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 90);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

async function loadCoastlineData(): Promise<THREE.Vector3[][]> {
  const res = await fetch('/data/ne_110m_coastline.json');
  if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
  const json = await res.json();
  const segments: THREE.Vector3[][] = [];
  const R = 1000;
  for (const geom of json.geometries) {
    if (geom.type === 'LineString') {
      segments.push(geom.coordinates.map(([lon, lat]: number[]) => geoToSphere(lon, lat, R)));
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        segments.push(line.map(([lon, lat]: number[]) => geoToSphere(lon, lat, R)));
      }
    }
  }
  return segments;
}

function createGrids(radius: number): THREE.Vector3[][] {
  const lines: THREE.Vector3[][] = [];
  for (let lat = -75; lat <= 75; lat += 15) {
    const pts: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 2) pts.push(geoToSphere(lon, lat, radius));
    lines.push(pts);
  }
  for (let lon = -180; lon < 180; lon += 15) {
    const pts: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 2) pts.push(geoToSphere(lon, lat, radius));
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

interface CyberGlobeProps {
  canvasW: number;
  canvasH: number;
  variant?: 'top-down' | 'oblique';
}

export function CyberGlobe({ canvasW, canvasH, variant = 'top-down' }: CyberGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [segments, setSegments] = useState<THREE.Vector3[][] | null>(null);
  const gridLines = useMemo(() => createGrids(1000), []);
  const isOblique = variant === 'oblique';

  useEffect(() => {
    loadCoastlineData().then(setSegments).catch(console.error);
  }, []);

  useEffect(() => {
    if (!segments || !containerRef.current) return;

    const container = containerRef.current;

    // ── 渲染器 ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    // ★ 先设 CSS，再 setSize，避免 cssText 覆盖 width/height 导致 canvas 尺寸丢失
    Object.assign(renderer.domElement.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
    });
    renderer.setSize(canvasW, canvasH);
    container.appendChild(renderer.domElement);

    // ── 场景 ──
    const scene = new THREE.Scene();

    // ── 球体组（先创建，oblique 需要 scale 放大） ──
    const globeGroup = new THREE.Group();

    // ── 相机 ──
    let camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
    if (isOblique) {
      // 近地轨道临边侧视 — 地平线横贯画面中央，上方太空留白，下方地球曲面
      const SCALE = 7.5; // 有效半径 7500
      // Y 轴压缩 0.7× → 扁椭球畸变，地平线弧线更平缓宽阔；球心上移补偿压缩
      const Y_SQUASH = 0.7;
      globeGroup.scale.set(SCALE, SCALE * Y_SQUASH, SCALE);
      globeGroup.position.set(0, -6000, -6000);
      camera = new THREE.PerspectiveCamera(50, canvasW / canvasH, 100, 30000);
      camera.position.set(0, 0, 0);
      // 望向扁椭球切线点，使地平线位于画面中央
      camera.lookAt(0, -1800, -6000);
    } else {
      // 极点俯视 — 原始正交投影，偏移至右下角 + 放大
      globeGroup.scale.set(1.3, 1.3, 1.3);
      globeGroup.position.set(480, -1050, 0);
      const frustumSize = canvasW;
      const aspect = canvasW / canvasH;
      camera = new THREE.OrthographicCamera(
        frustumSize / -2, frustumSize / 2,
        frustumSize / aspect / 2, -frustumSize / aspect / 2,
        100, 5000,
      );
      camera.position.set(0, 700, 0);
      camera.lookAt(0, 0, 0);
    }

    // 不透明球面（阻止背面穿透）
    const sphereGeo = new THREE.SphereGeometry(1000, 64, 32);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x2C2C34, transparent: false, side: THREE.FrontSide });
    globeGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

    // 背面遮罩（双重保障）
    const backGeo = new THREE.SphereGeometry(990, 64, 32);
    const backMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.BackSide, depthWrite: true });
    globeGroup.add(new THREE.Mesh(backGeo, backMat));

    // 线框
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00D4FF, wireframe: true, transparent: true, opacity: 0.03 });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1000.5, 64, 32), wireMat));

    // 大陆海岸线
    const coastGeo = linesToGeometry(segments);
    const coastLine = new THREE.LineSegments(coastGeo, new THREE.LineBasicMaterial({ color: 0x00D4FF, transparent: true, opacity: 0.50 }));
    globeGroup.add(coastLine);

    // 经纬网格
    const gridGeo = linesToGeometry(gridLines);
    globeGroup.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x00D4FF, transparent: true, opacity: 0.10 })));

    // 赤道环
    const torusGeo = new THREE.TorusGeometry(1004, 1.2, 16, 200);
    const torusMesh = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: 0x00D4FF, transparent: true, opacity: 0.22 }));
    torusMesh.rotation.x = Math.PI / 2;
    globeGroup.add(torusMesh);

    // ═══ 边缘光晕（Fresnel glow） ═══
    const glowGeo = new THREE.SphereGeometry(1006, 64, 32);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#00D4FF') },
        uIntensity: { value: 0.14 },
        uFalloff: { value: 3.5 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uFalloff;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = 1.0 - abs(dot(viewDir, vNormal));
          fresnel = pow(fresnel, uFalloff);
          gl_FragColor = vec4(uColor, fresnel * uIntensity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    globeGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // ═══ 外层暗色晕（柔化边缘融入背景） ═══
    const darkGlowGeo = new THREE.SphereGeometry(1012, 64, 32);
    const darkGlowMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#1A1A20') },
        uIntensity: { value: 0.18 },
        uFalloff: { value: 2.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uFalloff;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = 1.0 - abs(dot(viewDir, vNormal));
          fresnel = pow(fresnel, uFalloff);
          gl_FragColor = vec4(uColor, fresnel * uIntensity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    globeGroup.add(new THREE.Mesh(darkGlowGeo, darkGlowMat));

    scene.add(globeGroup);

    // ── 动画循环 ──
    let running = true;
    const rotationSpeed = 0.06; // 弧度/秒，≈ 0.001 * 60fps
    let lastTime = performance.now();
    function animate() {
      if (!running) return;
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1); // 上限 100ms 防跳帧
      lastTime = now;
      globeGroup.rotation.y += rotationSpeed * delta;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    return () => {
      running = false;
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [segments, gridLines, canvasW, canvasH]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
