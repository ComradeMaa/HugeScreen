import * as THREE from 'three';

// 平面世界地图（等距圆柱投影，参照 CyberMap 的归一化量级）：
// 全球 bounds（±180 经度 / ±90 纬度）→ scale = 100/360 → 地图 x ∈ [-100, 100], z ∈ [-50, 50]
// 地图是单面纹理平面（y=0，厚度 0）——3543 个国家的挤出几何 ≈7000 draw calls 会卡死，
// 一张经纬度纹理 + 一个平面 = 1 draw call（边界线框再 1 个），流畅且无 earcut 自交空洞。
export const MAP_SCALE = 100 / 360;
/** 地图宽度（世界单位） */
export const MAP_W = 200;
/** 地图高度（世界单位） */
export const MAP_H = 100;
/** pin 贴地高度（略高于平面防 z-fighting） */
export const PIN_Y = 0.3;

/** 经纬度 → Shape 平面坐标 (x=lng, y=lat)；rotX(-π/2) 平放后世界 z = -y（北 = -z） */
export function geoToShape(lng: number, lat: number): THREE.Vector2 {
  return new THREE.Vector2(lng * MAP_SCALE, lat * MAP_SCALE);
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

// ─── 国家多边形 → 经纬度纹理 + 平面网格（单面，无三角剖分空洞） ───

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
 * 经纬度 UV 对齐的平面网格（照抄 buildLonLatGlobe 的 UV 公式）：
 * 顶点 = geoToPlane(lon, lat)（北 = -z），UV = ((lon+180)/360, (90+lat)/180)。
 * ★ v 用 (90+lat)/180：CanvasTexture 默认 flipY=true（UNPACK_FLIP_Y 翻转上传），
 *   v=0 采样 canvas 底部（南极）、v=1 采样 canvas 顶部（北极）——
 *   故 lat=90（北极）→ v=1，与 buildCountryTexture 的 py(lat)=(90-lat)/180（canvas 顶部=北）对齐。
 */
export function buildLonLatPlane(lonSegs = 360, latSegs = 180): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vtx = (lon: number, lat: number) => {
    const v = geoToPlane(lon, lat);
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

/**
 * 国家边界线框（叠加在纹理平面之上，保证地图轮廓清晰可辨）：
 * 所有外环 + 孔环 → 折线坐标（跨 ±180 切开，与纹理 splitRings 同一语义）。
 * 只画线不填充 → 无 earcut 自交空洞问题。
 */
export function buildCountryLines(features: CountryFeature[], y = 0.2): THREE.Vector3[][] {
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
  const toLine = (ring: number[][]): THREE.Vector3[] => ring.map(([lon, lat]) => {
    const v = geoToPlane(lon, lat);
    return new THREE.Vector3(v.x, y, v.z);
  });
  for (const c of features) {
    for (const rg of c.rings) {
      for (const seg of splitRings(rg.outer)) lines.push(toLine(seg));
      for (const h of rg.holes) {
        for (const seg of splitRings(h)) lines.push(toLine(seg));
      }
    }
  }
  return lines;
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
