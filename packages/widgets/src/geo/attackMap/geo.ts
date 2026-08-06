import * as THREE from 'three';

// 平面世界地图（等距圆柱投影，参照 CyberMap 的归一化量级）：
// 360° 经度 → x ∈ [-100, 100]，180° 纬度 → z ∈ [-50, 50]（2:1 等比）
// 地图位于 XZ 平面（y=0），北 = +z（与 CyberMap lngLatToWorld 约定一致，相机 +z 俯视北在上）
export const MAP_SCALE = 100 / 360;
/** 地图宽度（世界单位） */
export const MAP_W = 200;
/** 地图高度（世界单位） */
export const MAP_H = 100;

/** 经纬度 → 平面坐标（等距圆柱投影，参照 CyberMap lngLatToWorld 的全局归一化） */
export function geoToPlane(lon: number, lat: number): THREE.Vector3 {
  return new THREE.Vector3(lon * MAP_SCALE, 0, lat * MAP_SCALE);
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

// ─── 国家多边形 → 经纬度纹理 + 平面网格（替代三角剖分） ───

/**
 * 生成世界地图经纬度纹理（canvas 2D）。
 * ★ 为什么不用三角剖分：NE 数据部分国家外环自交（unwrap 后仍 107 处，俄罗斯 16/智利 7/巴西 4），
 *   earcut 对自交多边形产生不规则中间空洞（大国空洞大、小国无——与用户观察完全一致）。
 *   canvas 2D 的 evenodd 填充规则原生处理自交/孔洞，无空洞。
 * ★ 跨 180° 的环（俄罗斯等）在 ±180 处切开成两段绘制——平面地图左右边缘就是 ±180 切缝，
 *   等距圆柱投影下俄罗斯跨两边绘制，语义正确。
 */
export function buildCountryTexture(features: CountryFeature[], width = 4096, height = 2048): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 海洋底色
  ctx.fillStyle = '#141c26';
  ctx.fillRect(0, 0, width, height);

  const px = (lon: number) => ((lon + 180) / 360) * width;
  const py = (lat: number) => ((90 - lat) / 180) * height;

  // 环按 ±180 切开（跨 180 的环分成两段绘制）
  const splitRings = (ring: number[][]): number[][][] => {
    const segments: number[][][] = [];
    let current: number[][] = [];
    let shifted = 0;  // 当前段的经度偏移
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      if (i > 0) {
        const prev = ring[i - 1][0] + shifted;
        if (Math.abs(lon - prev) > 180) {
          // 跨 180：当前段结束，新段从对侧开始
          if (current.length >= 2) segments.push(current);
          current = [];
          shifted = lon > prev ? -360 : 360;
        }
      }
      current.push([lon + shifted, lat]);
    }
    if (current.length >= 2) segments.push(current);
    return segments;
  };

  const traceRing = (ring: number[][]) => {
    for (const seg of splitRings(ring)) {
      seg.forEach(([lon, lat], i) => {
        if (i === 0) ctx.moveTo(px(lon), py(lat));
        else ctx.lineTo(px(lon), py(lat));
      });
      ctx.closePath();
    }
  };

  // 大陆填充（evenodd：孔自动挖除）
  ctx.fillStyle = '#3a3a48';
  for (const c of features) {
    ctx.beginPath();
    for (const rg of c.rings) {
      traceRing(rg.outer);
      for (const h of rg.holes) traceRing(h);
    }
    ctx.fill('evenodd');
  }

  // 国家边界线
  ctx.strokeStyle = 'rgba(0,212,255,0.85)';
  ctx.lineWidth = 1.2;
  for (const c of features) {
    for (const rg of c.rings) {
      ctx.beginPath();
      traceRing(rg.outer);
      for (const h of rg.holes) traceRing(h);
      ctx.stroke();
    }
  }

  return canvas;
}

/**
 * 国家边界线框（叠加在纹理平面之上，保证地图轮廓清晰可辨）：
 * 所有外环 + 孔环 → 折线坐标（跨 ±180 切开，与纹理 splitRings 同一语义）。
 * 只画线不填充 → 无 earcut 自交空洞问题。
 */
export function buildCountryLines(features: CountryFeature[], y = 0.5): THREE.Vector3[][] {
  const lines: THREE.Vector3[][] = [];
  const splitRings = (ring: number[][]): number[][][] => {
    const segments: number[][][] = [];
    let current: number[][] = [];
    let shifted = 0;
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      if (i > 0) {
        const prev = ring[i - 1][0] + shifted;
        if (Math.abs(lon - prev) > 180) {
          if (current.length >= 2) segments.push(current);
          current = [];
          shifted = lon > prev ? -360 : 360;
        }
      }
      current.push([lon + shifted, lat]);
    }
    if (current.length >= 2) segments.push(current);
    return segments;
  };
  for (const c of features) {
    for (const rg of c.rings) {
      for (const seg of splitRings(rg.outer)) {
        lines.push(seg.map(([lon, lat]) => {
          const v = geoToPlane(lon, lat);
          return new THREE.Vector3(v.x, y, v.z);
        }));
      }
      for (const h of rg.holes) {
        for (const seg of splitRings(h)) {
          lines.push(seg.map(([lon, lat]) => {
            const v = geoToPlane(lon, lat);
            return new THREE.Vector3(v.x, y, v.z);
          }));
        }
      }
    }
  }
  return lines;
}

/**
 * 经纬度 UV 对齐的平面网格（照抄 buildLonLatGlobe 的 UV 公式，只换坐标函数）：
 * 顶点 = geoToPlane(lon, lat)，UV = ((lon+180)/360, (90+lat)/180)。
 * ★ v 用 (90+lat)/180：CanvasTexture 默认 flipY=true（UNPACK_FLIP_Y 翻转上传），
 *   v=0 采样 canvas 底部（南极）、v=1 采样 canvas 顶部（北极）——
 *   故 lat=90（北极）→ v=1，与 buildCountryTexture 的 py(lat)=(90-lat)/180（canvas 顶部=北）对齐。
 */
export function buildLonLatPlane(width = MAP_W, height = MAP_H, lonSegs = 360, latSegs = 180): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vtx = (lon: number, lat: number) => {
    const v = geoToPlane(lon, lat);
    // 平面几何体 y=0 与 buildCountryTexture 一致（北 = -z，见 geoToPlane）
    positions.push(v.x, v.y, v.z);
    uvs.push((lon + 180) / 360, (90 + lat) / 180);
  };
  for (let j = 0; j <= latSegs; j++) {
    const lat = -90 + (180 * j) / latSegs;
    for (let i = 0; i <= lonSegs; i++) {
      const lon = -180 + (360 * i) / lonSegs;
      vtx(lon, lat);
    }
  }
  const row = lonSegs + 1;
  for (let j = 0; j < latSegs; j++) {
    for (let i = 0; i < lonSegs; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}

/** 平面经纬网格线（直线；y=1 略抬离地面防与纹理平面 z-fighting） */
export function createPlaneGrids(): THREE.Vector3[][] {
  const lines: THREE.Vector3[][] = [];
  // 纬线：lat ∈ [-75, 75] step 15，x ∈ [-1000, 1000]
  for (let lat = -75; lat <= 75; lat += 15) {
    const pts: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      const v = geoToPlane(lon, lat);
      pts.push(new THREE.Vector3(v.x, 1, v.z));
    }
    lines.push(pts);
  }
  // 经线：lon ∈ [-180, 180) step 15，z ∈ [-500, 500]
  for (let lon = -180; lon < 180; lon += 15) {
    const pts: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 2) {
      const v = geoToPlane(lon, lat);
      pts.push(new THREE.Vector3(v.x, 1, v.z));
    }
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
