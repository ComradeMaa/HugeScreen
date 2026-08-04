"""Shapefile → GeoJSON 转换（Natural Earth 10m 国家数据 → world_countries.geojson）

- 读 .shp 几何（Polygon/MultiPolygon）+ .dbf 属性（NAME 英文名 / NAME_ZH 中文名）
- Douglas-Peucker 抽稀控制体积（球面渲染 10m 级精度足够）
- 环分组：shoelace 正面积 = 外环，负 = 孔（挂到最近外环）→ 标准 GeoJSON MultiPolygon
"""
import shapefile
import json
import math
import sys

SRC = r'D:\Python\HugeScreen\ne_10m_admin_0_countries\ne_10m_admin_0_countries'
OUT = r'D:\Python\HugeScreen\apps\web\public\data\world_countries.geojson'
EPS = float(sys.argv[1]) if len(sys.argv) > 1 else 0.02  # 抽稀容差（经纬度度数）

def douglas_peucker(points, eps):
    """迭代 Douglas-Peucker（栈实现防深递归），保留首尾闭环点"""
    if len(points) < 3:
        return points
    def dist_to_seg(p, a, b):
        ax, ay = a; bx, by = b; px, py = p
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        max_d, idx = 0.0, -1
        for i in range(first + 1, last):
            d = dist_to_seg(points[i], points[first], points[last])
            if d > max_d:
                max_d, idx = d, i
        if max_d > eps and idx != -1:
            keep[idx] = True
            stack.append((first, idx))
            stack.append((idx, last))
    return [p for p, k in zip(points, keep) if k]

def point_in_ring(x, y, ring):
    """射线法：点是否在环内（不依赖环方向）"""
    inside = False
    n = len(ring)
    for i in range(n - 1):
        xi, yi = ring[i]
        xj, yj = ring[i + 1]
        if (yi > y) != (yj > y):
            x_int = xi + (y - yi) / (yj - yi) * (xj - xi)
            if x < x_int:
                inside = not inside
    return inside

def rings_to_multipolygon(parts, eps):
    """parts: 环列表（每环 [lng,lat] 列表）→ GeoJSON MultiPolygon coordinates（外环+孔分组）

    NE 数据所有环同方向（逆时针），无法用 shoelace 符号区分外环/孔，
    改用包含关系：孔 = 被其他环包含的环（与方向无关，稳健）。
    """
    rings = []
    for ring in parts:
        if len(ring) < 4:
            continue
        simplified = douglas_peucker(ring, eps)
        if len(simplified) < 4:
            continue
        if simplified[0] != simplified[-1]:
            simplified.append(simplified[0])  # 保持闭环
        rings.append(simplified)
    if not rings:
        return None
    # 外环 = 不被任何其他环包含；孔 = 被包含
    outs, holes = [], []
    for a in rings:
        contained = any(
            b is not a and point_in_ring(a[0][0], a[0][1], b)
            for b in rings
        )
        (holes if contained else outs).append(a)
    if not outs:
        return None
    # 孔挂到包含它且面积最小的外环
    polys = [{'outer': o, 'holes': []} for o in outs]
    for h in holes:
        best, best_area = None, float('inf')
        for pl in polys:
            if point_in_ring(h[0][0], h[0][1], pl['outer']):
                area = 0.0
                for i in range(len(pl['outer']) - 1):
                    area += pl['outer'][i][0] * pl['outer'][i + 1][1] - pl['outer'][i + 1][0] * pl['outer'][i][1]
                area = abs(area)
                if area < best_area:
                    best_area, best = area, pl
        if best:
            best['holes'].append(h)
    coords = [[pl['outer']] + pl['holes'] for pl in polys if pl['outer']]
    return coords if coords else None

def main():
    sf = shapefile.Reader(SRC)
    field_names = [f[0] for f in sf.fields[1:]]
    idx_name = field_names.index('NAME')
    idx_name_zh = field_names.index('NAME_ZH') if 'NAME_ZH' in field_names else -1

    features = []
    skipped = 0
    for shp, rec in zip(sf.shapes(), sf.records()):
        if shp.shapeType not in (5, 15):  # Polygon / PolygonZ
            skipped += 1
            continue
        # 按 parts 切分坐标环
        pts = shp.points
        parts = list(shp.parts) + [len(pts)]
        rings = [pts[parts[i]:parts[i + 1]] for i in range(len(parts) - 1)]
        coords = rings_to_multipolygon(rings, EPS)
        if not coords:
            skipped += 1
            continue
        name = str(rec[idx_name] or '').strip()
        name_zh = str(rec[idx_name_zh] or '').strip() if idx_name_zh >= 0 else ''
        if not name:
            skipped += 1
            continue
        features.append({
            'type': 'Feature',
            'properties': {'name': name, 'nameZh': name_zh},
            'geometry': {'type': 'MultiPolygon', 'coordinates': coords},
        })

    out = {'type': 'FeatureCollection', 'features': features}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    import os
    size_mb = os.path.getsize(OUT) / 1048576
    total_points = sum(len(c[0]) for ft in features for poly in ft['geometry']['coordinates'] for c in poly)
    print(f'OK: {len(features)} features, {total_points} pts, {size_mb:.1f} MB (eps={EPS}), skipped={skipped}')

if __name__ == '__main__':
    main()
