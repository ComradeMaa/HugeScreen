import * as THREE from 'three';

// 平面世界地图（等距圆柱投影，完全参照 CyberMap 的归一化方案）：
// 全球 bounds（±180 经度 / ±90 纬度）→ scale = 100/360 → 地图 x ∈ [-100, 100], z ∈ [-50, 50]
export const GLOBAL_BOUNDS = {
  minX: -180, maxX: 180, minZ: -90, maxZ: 90,
  scale: 100 / 360,
  centerX: 0, centerZ: 0,
} as const;

/** 地图挤出厚度（CyberMap 风格 3D 感） */
export const MAP_THICKNESS = 2;

/** 经纬度 → Shape 平面坐标 (x=lng, y=lat)；rotX(-π/2) 平放后世界 z = -y（北 = -z） */
export function geoToShape(lng: number, lat: number): THREE.Vector2 {
  return new THREE.Vector2(
    (lng - GLOBAL_BOUNDS.centerX) * GLOBAL_BOUNDS.scale,
    (lat - GLOBAL_BOUNDS.centerZ) * GLOBAL_BOUNDS.scale,
  );
}

/** 经纬度 → 3D 世界坐标（地图几何体空间：rotX 平放后 z 取反，北 = -z，相机 +z 俯视北在上） */
export function geoToPlane(lng: number, lat: number): THREE.Vector3 {
  const s = geoToShape(lng, lat);
  return new THREE.Vector3(s.x, 0, -s.y);
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

// ─── 国家 → 挤出几何体（参照 CyberMap：Shape → ExtrudeGeometry → rotX 平放） ───

/** Shape(XY) → ExtrudeGeometry(Z) → applyMatrix4(rotX) → 平放 XZ 面 */
const ROT_X_M4 = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

/**
 * 构建一个国家多边形（外环 + 孔洞）的挤出几何体（已平放到 XZ 面）。
 * ★ 跨 ±180 的环（俄罗斯等）：geoToPlane 会把西侧点映射到 x≈+100、东侧点 x≈-100，
 *   多边形横跨地图左右边缘——等距圆柱投影下这是正确表现（俄罗斯跨两边）。
 */
function buildRegionGeometry(ring: CountryRing, thickness: number): THREE.BufferGeometry | null {
  const outer = ring.outer.map(([lng, lat]) => geoToShape(lng, lat));
  if (outer.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
  shape.closePath();
  for (const h of ring.holes) {
    const hp = new THREE.Path();
    h.forEach(([lng, lat], i) => {
      const v = geoToShape(lng, lat);
      if (i === 0) hp.moveTo(v.x, v.y);
      else hp.lineTo(v.x, v.y);
    });
    hp.closePath();
    shape.holes.push(hp);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: thickness, bevelEnabled: false });
  geo.applyMatrix4(ROT_X_M4);
  return geo;
}

/** 构建世界地图挤出网格组：底体（半透明灰）+ 电光蓝边线（EdgesGeometry） */
export function buildRegionGroup(
  features: CountryFeature[],
  thickness = MAP_THICKNESS,
  bodyColor = 0x2c2c34,
  bodyOpacity = 0.35,
  lineColor = 0x00d4ff,
  lineOpacity = 0.7,
): THREE.Group {
  const group = new THREE.Group();
  for (const c of features) {
    for (const rg of c.rings) {
      const geo = buildRegionGeometry(rg, thickness);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: bodyColor, transparent: true, opacity: bodyOpacity,
        side: THREE.DoubleSide, depthWrite: true,
      }));
      mesh.userData.name = c.name;
      group.add(mesh);
      group.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 15),
        new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: lineOpacity }),
      ));
    }
  }
  return group;
}

/** 地图外框线（视觉收边） */
export function buildMapFrame(y: number): THREE.LineSegments {
  const halfW = 100, halfH = 50;
  const pts = [
    new THREE.Vector3(-halfW, y, -halfH), new THREE.Vector3(halfW, y, -halfH),
    new THREE.Vector3(halfW, y, halfH), new THREE.Vector3(-halfW, y, halfH),
    new THREE.Vector3(-halfW, y, -halfH),
  ];
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending }),
  );
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
