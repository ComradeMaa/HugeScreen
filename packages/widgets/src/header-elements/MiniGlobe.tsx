import { useEffect, useRef } from 'react';
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

let cachedCoastlines: THREE.Vector3[][] | null = null;

async function getCoastlines(): Promise<THREE.Vector3[][]> {
  if (cachedCoastlines) return cachedCoastlines;
  const res = await fetch('/data/ne_110m_coastline.json');
  const json = await res.json();
  const segments: THREE.Vector3[][] = [];
  const R = 30;
  for (const geom of (json.geometries as any[])) {
    const lines = geom.type === 'MultiLineString' ? geom.coordinates : [geom.coordinates];
    for (const line of lines) {
      segments.push(line.map(([lon, lat]: number[]) => geoToSphere(lon, lat, R)));
    }
  }
  cachedCoastlines = segments;
  return segments;
}

function createGrids(radius: number): THREE.Vector3[][] {
  const lines: THREE.Vector3[][] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 3) pts.push(geoToSphere(lon, lat, radius));
    lines.push(pts);
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const pts: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 3) pts.push(geoToSphere(lon, lat, radius));
    lines.push(pts);
  }
  return lines;
}

function linesToGeom(lines: THREE.Vector3[][]): THREE.BufferGeometry {
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

export function MiniGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 200;
    const h = container.clientHeight || 56;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 5, 300);
    camera.position.set(0, 0, 80);
    camera.lookAt(0, 0, 0);

    const globeGroup = new THREE.Group();
    const R = 30; // 缩小半径适配顶栏

    // 球面
    const sphereGeo = new THREE.SphereGeometry(R, 48, 24);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x2C2C34, transparent: true, opacity: 0.25, side: THREE.FrontSide });
    globeGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

    // 线框
    const wireGeo = new THREE.SphereGeometry(R * 1.003, 48, 24);
    globeGroup.add(new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({ color: 0x00D4FF, wireframe: true, transparent: true, opacity: 0.04 })));

    // 赤道环
    const torusMesh = new THREE.Mesh(
      new THREE.TorusGeometry(R * 1.01, 0.4, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0x00D4FF, transparent: true, opacity: 0.20 }),
    );
    torusMesh.rotation.x = Math.PI / 2;
    globeGroup.add(torusMesh);

    scene.add(globeGroup);

    let running = true;
    getCoastlines().then(segments => {
      if (!running) return;
      const gridLines = createGrids(R);
      globeGroup.add(new THREE.LineSegments(linesToGeom(gridLines), new THREE.LineBasicMaterial({ color: 0x00D4FF, transparent: true, opacity: 0.10 })));
      globeGroup.add(new THREE.LineSegments(linesToGeom(segments), new THREE.LineBasicMaterial({ color: 0x00D4FF, transparent: true, opacity: 0.50 })));
    });

    function animate() {
      if (!running) return;
      globeGroup.rotation.y += 0.002;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    return () => {
      running = false;
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
