import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════
   LowPolyBg — 低多边形线框晶格漂浮背景
   大量低面几何单元缓慢下飘 + 轻微自转，柔和不干扰前景。
   ═══════════════════════════════════════════════════ */

const CELL_COUNT = 42;       // 稀疏均匀
const MAX_RADIUS = 42;       // 晶格单元最大半径
const MIN_RADIUS = 18;
const MAX_VERTICES = 3;
const MIN_VERTICES = 3;
const DRIFT_SPEED = 0.15;    // px/frame（缓慢）
const ROTATE_SPEED = 0.003;  // rad/frame
const FILL_ALPHA = 0.08;     // 填充半透明
const STROKE_ALPHA = 0.14;
const LINE_WIDTH = 0.6;

interface Cell {
  x: number;
  y: number;
  vertices: { x: number; y: number }[];
  radius: number;
  speed: number;
  angle: number;
  rotateSpeed: number;
  hueShift: number;  // 色相微调
}

function createCell(canvasW: number, canvasH: number): Cell {
  const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
  const n = MIN_VERTICES + Math.floor(Math.random() * (MAX_VERTICES - MIN_VERTICES + 1));
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.6;
    const r = radius * (0.7 + Math.random() * 0.3);
    vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return {
    x: Math.random() * canvasW,
    y: -radius - Math.random() * canvasH, // 从上方随机起始位置
    vertices,
    radius,
    speed: DRIFT_SPEED * (0.6 + Math.random() * 1.2),
    angle: Math.random() * Math.PI * 2,
    rotateSpeed: (ROTATE_SPEED * (0.5 + Math.random())) * (Math.random() > 0.5 ? 1 : -1),
    hueShift: Math.random() * 30,
  };
}

function rotateVertices(verts: { x: number; y: number }[], angle: number): { x: number; y: number }[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return verts.map(v => ({
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  }));
}

interface LowPolyBgProps {
  canvasW: number;
  canvasH: number;
}

export function LowPolyBg({ canvasW, canvasH }: LowPolyBgProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<Cell[]>([]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d')!;

    // Init cells
    if (cellsRef.current.length === 0) {
      cellsRef.current = Array.from({ length: CELL_COUNT }, () => createCell(canvasW, canvasH));
    }

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvasW, canvasH);

      for (const cell of cellsRef.current) {
        // Move
        cell.y += cell.speed;
        cell.angle += cell.rotateSpeed;

        // Recycle: exit bottom → respawn at top
        if (cell.y - cell.radius > canvasH) {
          Object.assign(cell, createCell(canvasW, canvasH));
          cell.y = -cell.radius;
        }

        const rotated = rotateVertices(cell.vertices, cell.angle);

        // Draw fill
        ctx.beginPath();
        ctx.moveTo(cell.x + rotated[0].x, cell.y + rotated[0].y);
        for (let i = 1; i < rotated.length; i++) {
          ctx.lineTo(cell.x + rotated[i].x, cell.y + rotated[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = `hsla(192, 100%, ${48 + cell.hueShift * 0.3}%, ${FILL_ALPHA})`;
        ctx.fill();

        // Draw wireframe
        ctx.strokeStyle = `rgba(0,212,255,${STROKE_ALPHA})`;
        ctx.lineWidth = LINE_WIDTH;
        ctx.stroke();

        // Draw nodes（小亮点）
        for (const v of rotated) {
          ctx.beginPath();
          ctx.arc(cell.x + v.x, cell.y + v.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,212,255,0.22)`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [canvasW, canvasH]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasW}
      height={canvasH}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.85 }}
    />
  );
}
