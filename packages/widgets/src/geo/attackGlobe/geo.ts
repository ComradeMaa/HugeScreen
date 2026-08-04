import * as THREE from 'three';

export const GLOBE_R = 1000;

/** 经纬度 → 球面坐标（复制自 CyberGlobe，坐标约定一致） */
export function geoToSphere(lon: number, lat: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 90);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// ─── 国家多边形数据 ───

export interface CountryRing { outer: number[][]; holes: number[][][]; }
export interface CountryFeature {
  name: string;
  nameZh: string;
  rings: CountryRing[];           // 经纬度环（反查用）
  bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number };
}

/** 加载 world_countries.geojson → 国家特征列表（保留经纬度 + 预计算包围盒） */
export async function loadCountries(): Promise<CountryFeature[]> {
  const res = await fetch('/data/world_countries.geojson');
  if (!res.ok) throw new Error(`Failed to load countries: ${res.status}`);
  const json = await res.json();
  return (json.features ?? []).map((f: any): CountryFeature => {
    const rings: CountryRing[] = (f.geometry?.coordinates ?? []).map((poly: number[][][]) => ({
      outer: poly[0] ?? [],
      holes: poly.slice(1),
    })).filter((r: CountryRing) => r.outer.length >= 4);
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const r of rings) {
      for (const [lon, lat] of r.outer) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
    return {
      name: String(f.properties?.name ?? ''),
      nameZh: String(f.properties?.nameZh ?? ''),
      rings,
      bbox: { minLon, maxLon, minLat, maxLat },
    };
  }).filter((c: CountryFeature) => c.name && c.rings.length > 0);
}

/** 射线法：点是否在环内（经纬度空间，复制 CyberSphere 实现） */
export function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = ring[i][1], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat)) {
      const xInt = ring[i][0] + ((lat - yi) / (yj - yi)) * (ring[j][0] - ring[i][0]);
      if (lon < xInt) inside = !inside;
    }
  }
  return inside;
}

/** 坐标反查国家（包围盒加速 + 射线法）→ {name, nameZh} | null */
export function lookupCountry(features: CountryFeature[], lat: number, lng: number): { name: string; nameZh: string } | null {
  for (const c of features) {
    const b = c.bbox;
    if (lng < b.minLon || lng > b.maxLon || lat < b.minLat || lat > b.maxLat) continue;
    for (const r of c.rings) {
      if (!pointInRing(lng, lat, r.outer)) continue;
      let inHole = false;
      for (const h of r.holes) {
        if (pointInRing(lng, lat, h)) { inHole = true; break; }
      }
      if (!inHole) return { name: c.name, nameZh: c.nameZh };
    }
  }
  return null;
}

// ─── 国家多边形 → 球面面片 + 边界线 ───

export interface CountryMeshes {
  fill: THREE.BufferGeometry;       // 三角化面片（半透明填充）
  borders: THREE.BufferGeometry;    // 外环+孔轮廓线（无内部三角边）
}

/**
 * 球面三角化：顶点放球面，剖分在"该国中心为法线的切线平面"做（THREE.ShapeUtils.triangulateShape），
 * 索引映射回球面 3D 顶点。孔环同法投影。所有 polygon 合并进一个 BufferGeometry。
 */
export function buildCountryMeshes(features: CountryFeature[], radius: number): CountryMeshes {
  const fillPos: number[] = [];
  const fillIdx: number[] = [];
  const borderPos: number[] = [];

  for (const c of features) {
    for (const ringGroup of c.rings) {
      // 收集本 poly 全部顶点（外环 + 孔）的 3D 球面坐标与 2D 切线投影
      const all3D: THREE.Vector3[] = [];
      const all2D: number[][] = [];
      // 中心 = 外环顶点平均方向
      let cx = 0, cy = 0, cz = 0;
      const outer3D = ringGroup.outer.map(([lon, lat]) => geoToSphere(lon, lat, radius));
      for (const v of outer3D) { cx += v.x; cy += v.y; cz += v.z; }
      const center = new THREE.Vector3(cx, cy, cz).normalize();
      // 局部基：z=center，x 取与 center 不共线的轴叉乘
      const ref = Math.abs(center.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const xAxis = new THREE.Vector3().crossVectors(ref, center).normalize();
      const yAxis = new THREE.Vector3().crossVectors(center, xAxis).normalize();

      const holes: { x: number; y: number }[][] = [];
      // 外环先
      for (const [lon, lat] of ringGroup.outer) {
        const v = geoToSphere(lon, lat, radius);
        all3D.push(v);
        all2D.push([v.dot(xAxis), v.dot(yAxis)]);
      }
      for (const h of ringGroup.holes) {
        const start = all2D.length;
        for (const [lon, lat] of h) {
          const v = geoToSphere(lon, lat, radius);
          all3D.push(v);
          all2D.push([v.dot(xAxis), v.dot(yAxis)]);
        }
        holes.push(all2D.slice(start).map((p) => ({ x: p[0], y: p[1] })));
      }

      if (all2D.length < 3) continue;

      // 三角剖分（外环 + 孔）— ShapeUtils.triangulateShape 需要 {x,y} 结构
      let tris: number[][] = [];
      try {
        tris = THREE.ShapeUtils.triangulateShape(
          all2D.slice(0, outer3D.length).map((p) => ({ x: p[0], y: p[1] })),
          holes,
        );
      } catch {
        continue;
      }
      if (!tris.length) continue;

      // 顶点去重（同一球面点在 fill/边界 间共享无必要——直接累积）
      const base = fillPos.length / 3;
      for (const v of all3D) fillPos.push(v.x, v.y, v.z);
      for (const t of tris) fillIdx.push(base + t[0], base + t[1], base + t[2]);

      // 边界线：外环 + 孔轮廓（LineSegments 点对）
      const pushBorderRing = (ring: number[][]) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const a = geoToSphere(ring[i][0], ring[i][1], radius + 2);
          const b = geoToSphere(ring[i + 1][0], ring[i + 1][1], radius + 2);
          borderPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      };
      pushBorderRing(ringGroup.outer);
      for (const h of ringGroup.holes) pushBorderRing(h);
    }
  }

  const fill = new THREE.BufferGeometry();
  fill.setAttribute('position', new THREE.Float32BufferAttribute(fillPos, 3));
  fill.setIndex(fillIdx);
  const borders = new THREE.BufferGeometry();
  borders.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
  return { fill, borders };
}

/** 经纬网格线（复制 CyberGlobe） */
export function createGrids(radius: number): THREE.Vector3[][] {
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

export function linesToGeometry(lines: THREE.Vector3[][]): THREE.BufferGeometry {
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

/** Fresnel 辉光（复制 CyberGlobe，颜色/强度可调） */
export function makeGlow(radius: number, intensity: number, falloff: number, color = '#00D4FF'): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 64, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uFalloff: { value: falloff },
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
  return new THREE.Mesh(geo, mat);
}
