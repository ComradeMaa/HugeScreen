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
}

export function CyberGlobe({ canvasW, canvasH }: CyberGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [segments, setSegments] = useState<THREE.Vector3[][] | null>(null);
  const gridLines = useMemo(() => createGrids(1000), []);

  useEffect(() => {
    loadCoastlineData().then(setSegments).catch(console.error);
  }, []);

  useEffect(() => {
    if (!segments || !containerRef.current) return;

    const container = containerRef.current;
    const sphereY = -350;

    // ── 渲染器 ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvasW, canvasH);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    container.appendChild(renderer.domElement);

    // ── 场景 ──
    const scene = new THREE.Scene();

    // ── 正交相机 ──
    const frustumSize = canvasW;
    const aspect = canvasW / canvasH;
    const camera = new THREE.OrthographicCamera(
      frustumSize / -2, frustumSize / 2,
      frustumSize / aspect / 2, -frustumSize / aspect / 2,
      100, 5000,
    );
    camera.position.set(0, 700, 0);
    camera.lookAt(0, 0, 0);

    // ── 球体组 ──
    const globeGroup = new THREE.Group();
    globeGroup.position.set(0, sphereY, 0);

    // 半透明球面
    const sphereGeo = new THREE.SphereGeometry(1000, 64, 32);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x2C2C34, transparent: true, opacity: 0.30, side: THREE.FrontSide });
    globeGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

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

    scene.add(globeGroup);

    // ── 动画循环 ──
    let running = true;
    function animate() {
      if (!running) return;
      globeGroup.rotation.y += 0.001;
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
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasW, height: canvasH, zIndex: 3 }}
    />
  );
}
