import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface PanZoomTransform {
  x: number;
  y: number;
  scale: number;
}

interface UsePanZoomOptions {
  containerRef: RefObject<HTMLElement | null>;
  minScale?: number;
  maxScale?: number;
  enabled?: boolean;
}

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function clampTransform(
  t: PanZoomTransform,
  viewportW: number,
  viewportH: number
): PanZoomTransform {
  if (viewportW <= 0 || viewportH <= 0) return t;

  // At 1× or below, content fits the frame — no panning (prevents blank margins)
  if (t.scale <= 1) {
    return { x: 0, y: 0, scale: t.scale };
  }

  // Scaled content extends beyond viewport; limit pan to keep map on screen
  const maxX = (viewportW * (t.scale - 1)) / 2;
  const maxY = (viewportH * (t.scale - 1)) / 2;

  return {
    scale: t.scale,
    x: Math.max(-maxX, Math.min(maxX, t.x)),
    y: Math.max(-maxY, Math.min(maxY, t.y)),
  };
}

export function usePanZoom({
  containerRef,
  minScale = 1,
  maxScale = 4,
  enabled = true,
}: UsePanZoomOptions) {
  const [transform, setTransform] = useState<PanZoomTransform>({ x: 0, y: 0, scale: 1 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const blockClickRef = useRef(false);

  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number; tx: number; ty: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const applyTransform = useCallback(
    (next: PanZoomTransform | ((prev: PanZoomTransform) => PanZoomTransform)) => {
      setTransform(prev => {
        const raw = typeof next === 'function' ? next(prev) : next;
        return clampTransform(raw, viewportSize.w, viewportSize.h);
      });
    },
    [viewportSize.w, viewportSize.h]
  );

  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [minScale, maxScale]
  );

  const reset = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const isOffCenter =
    transform.scale !== 1 || Math.abs(transform.x) > 2 || Math.abs(transform.y) > 2;

  const zoomBy = useCallback(
    (factor: number) => {
      applyTransform(t => {
        const scale = clampScale(t.scale * factor);
        return clampTransform({ ...t, scale }, viewportSize.w, viewportSize.h);
      });
    },
    [applyTransform, clampScale, viewportSize.w, viewportSize.h]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
      zoomBy(factor);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, enabled, zoomBy]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button > 0) return;
      movedRef.current = false;
      blockClickRef.current = false;
      // At fit scale, keep clicks clean — pan only once zoomed in
      if (transform.scale <= 1) {
        panStart.current = null;
        return;
      }
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [enabled, transform.x, transform.y, transform.scale]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !panStart.current || transform.scale <= 1) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        movedRef.current = true;
        blockClickRef.current = true;
      }
      applyTransform({
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
        scale: transform.scale,
      });
    },
    [enabled, applyTransform, transform.scale]
  );

  const onPointerUp = useCallback(() => {
    panStart.current = null;
    applyTransform(t => t);
    if (movedRef.current) {
      blockClickRef.current = true;
      window.setTimeout(() => {
        blockClickRef.current = false;
      }, 80);
    }
  }, [applyTransform]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 2) return;
      pinchStart.current = {
        distance: touchDistance(e.touches[0], e.touches[1]),
        scale: transform.scale,
        tx: transform.x,
        ty: transform.y,
      };
      panStart.current = null;
    },
    [enabled, transform.scale, transform.x, transform.y]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 2 || !pinchStart.current) return;
      e.preventDefault();
      const distance = touchDistance(e.touches[0], e.touches[1]);
      const ratio = distance / pinchStart.current.distance;
      blockClickRef.current = true;
      movedRef.current = true;
      applyTransform({
        x: pinchStart.current.tx,
        y: pinchStart.current.ty,
        scale: clampScale(pinchStart.current.scale * ratio),
      });
    },
    [enabled, applyTransform, clampScale]
  );

  const onTouchEnd = useCallback(() => {
    if (pinchStart.current) {
      pinchStart.current = null;
      applyTransform(t => t);
      window.setTimeout(() => {
        blockClickRef.current = false;
      }, 80);
    }
  }, [applyTransform]);

  return {
    transform,
    blockClickRef,
    isOffCenter,
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
