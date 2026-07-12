import { useCallback, useRef, useState } from 'react';

export interface PanZoomTransform {
  x: number;
  y: number;
  scale: number;
}

interface UsePanZoomOptions {
  minScale?: number;
  maxScale?: number;
  enabled?: boolean;
}

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

export function usePanZoom({
  minScale = 1,
  maxScale = 4,
  enabled = true,
}: UsePanZoomOptions = {}) {
  const [transform, setTransform] = useState<PanZoomTransform>({ x: 0, y: 0, scale: 1 });
  const blockClickRef = useRef(false);

  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const movedRef = useRef(false);

  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [minScale, maxScale]
  );

  const reset = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      setTransform(t => ({ ...t, scale: clampScale(t.scale * factor) }));
    },
    [clampScale]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button > 0) return;
      movedRef.current = false;
      blockClickRef.current = false;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [enabled, transform.x, transform.y]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !panStart.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        movedRef.current = true;
        blockClickRef.current = true;
      }
      setTransform(t => ({
        ...t,
        x: panStart.current!.tx + dx,
        y: panStart.current!.ty + dy,
      }));
    },
    [enabled]
  );

  const onPointerUp = useCallback(() => {
    panStart.current = null;
    if (movedRef.current) {
      blockClickRef.current = true;
      window.setTimeout(() => {
        blockClickRef.current = false;
      }, 80);
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 2) return;
      pinchStart.current = {
        distance: touchDistance(e.touches[0], e.touches[1]),
        scale: transform.scale,
      };
      panStart.current = null;
    },
    [enabled, transform.scale]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 2 || !pinchStart.current) return;
      e.preventDefault();
      const distance = touchDistance(e.touches[0], e.touches[1]);
      const ratio = distance / pinchStart.current.distance;
      blockClickRef.current = true;
      movedRef.current = true;
      setTransform(t => ({
        ...t,
        scale: clampScale(pinchStart.current!.scale * ratio),
      }));
    },
    [enabled, clampScale]
  );

  const onTouchEnd = useCallback(() => {
    if (pinchStart.current) {
      pinchStart.current = null;
      window.setTimeout(() => {
        blockClickRef.current = false;
      }, 80);
    }
  }, []);

  return {
    transform,
    blockClickRef,
    reset,
    zoomIn: () => zoomBy(1.3),
    zoomOut: () => zoomBy(1 / 1.3),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
