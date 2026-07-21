import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * MiniWireSphere — 微型线框球（二十面体）+ 扫描线
 * 3D 二十面体线框缓慢自转 + CSS 扫描线从上方掠过
 */
export function MiniWireSphere() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 80;
    const h = container.clientHeight || 56;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 5, 200);
    camera.position.set(0, 0, 65);
    camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    const R = 16;

    // 二十面体线框 — EdgesGeometry 提取边缘，比 wireframe 更干净
    const icoGeo = new THREE.IcosahedronGeometry(R, 0);
    const edgeGeo = new THREE.EdgesGeometry(icoGeo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x00D4FF,
      transparent: true,
      opacity: 0.5,
    });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // 第二层更大一点的弱线框（增加层次感）
    const edgeGeo2 = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R * 1.08, 0));
    group.add(new THREE.LineSegments(edgeGeo2, new THREE.LineBasicMaterial({
      color: 0x00D4FF,
      transparent: true,
      opacity: 0.15,
    })));

    // 顶点光点（从 IcosahedronGeometry 提取顶点）
    const posAttr = icoGeo.getAttribute('position');
    const seen = new Set<string>();
    const dots: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        dots.push(x, y, z);
      }
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    const dotMat = new THREE.PointsMaterial({
      color: 0x00D4FF,
      size: 1.2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    group.add(new THREE.Points(dotGeo, dotMat));

    scene.add(group);

    let running = true;
    function animate() {
      if (!running) return;
      group.rotation.y += 0.008;
      group.rotation.x += 0.003;
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

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <style>{`
        @keyframes scanDown {
          0% { top: -2px; }
          100% { top: calc(100% + 2px); }
        }
      `}</style>
      {/* 扫描线覆盖层 */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* 背景暗纹 */}
        <div className="absolute inset-0 flex flex-col" style={{ gap: '15%', padding: '10% 0' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-full h-px"
              style={{ background: 'linear-gradient(to right, transparent, rgba(0,212,255,0.06), transparent)' }} />
          ))}
        </div>
        {/* 移动扫描线 */}
        <div
          className="absolute left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(to right, transparent 10%, rgba(0,212,255,0.6) 30%, rgba(0,212,255,0.8) 50%, rgba(0,212,255,0.6) 70%, transparent 90%)',
            boxShadow: '0 0 6px rgba(0,212,255,0.5)',
            animation: 'scanDown 3s linear infinite',
          }}
        />
      </div>
    </div>
  );
}
