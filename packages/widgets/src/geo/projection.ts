import * as THREE from 'three';

/**
 * 等距矩形投影：经纬度 → 平面坐标 (lng, lat) → (x, z)
 * 对于城市级小区域，经纬度直接线性映射，保持原始长宽比例
 */
export function lngLatToXZ(lng: number, lat: number): [number, number] {
  return [lng, lat];
}

/**
 * 逆投影：平面坐标 → 经纬度
 */
export function xzToLngLat(x: number, z: number): [number, number] {
  return [x, z];
}

/**
 * 从 GeoJSON 特征集合计算归一化参数
 * X 和 Z 使用统一的缩放因子，保持地图真实长宽比
 */
export function computeRegionBounds(
  features: { geometry: { type: string; coordinates: unknown } }[],
): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  scale: number;
  centerX: number;
  centerZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  function walk(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lng, lat] = coords as [number, number];
      if (lng < minX) minX = lng;
      if (lng > maxX) maxX = lng;
      if (lat < minZ) minZ = lat;
      if (lat > maxZ) maxZ = lat;
      return;
    }
    for (const item of coords) walk(item);
  }

  for (const feature of features) {
    walk(feature.geometry.coordinates);
  }

  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  // 统一缩放：取较大方向计算 scale，保证地图任意方向不超出 [-50,50]
  const scale = 100 / Math.max(rangeX, rangeZ);

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    scale,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

/**
 * 将经纬度转为归一化 3D 坐标（基于 bounds）
 * 地图中心在原点 (0, 0, 0)，X=经度方向，Z=纬度方向
 */
export function lngLatToWorld(
  lng: number,
  lat: number,
  bounds: ReturnType<typeof computeRegionBounds>,
): THREE.Vector3 {
  return new THREE.Vector3(
    (lng - bounds.centerX) * bounds.scale,
    0,
    (lat - bounds.centerZ) * bounds.scale,
  );
}

/**
 * 3D 世界坐标 → 屏幕像素坐标
 */
export function worldToScreen(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number } {
  const vec = worldPos.clone().project(camera);
  return {
    x: (vec.x * 0.5 + 0.5) * containerWidth,
    y: (-vec.y * 0.5 + 0.5) * containerHeight,
  };
}

/**
 * 屏幕像素坐标 → 3D 世界坐标（射线与指定平面求交）
 * @param planeNormal 平面的法向量（默认 (0,0,1)=Z 平面，即地平面上方）
 * @param planeOffset 平面沿法向的偏移（默认 0 = 地平面）
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: THREE.Camera,
  containerWidth: number,
  containerHeight: number,
  planeNormal: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
  planeOffset = 0,
): THREE.Vector3 | null {
  const ndc = new THREE.Vector2(
    (screenX / containerWidth) * 2 - 1,
    -(screenY / containerHeight) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(planeNormal, -planeOffset);
  const intersection = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(plane, intersection);
  return hit ? intersection : null;
}
