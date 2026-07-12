import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { usePanZoom } from '../hooks/usePanZoom';

interface MapInteractionContextValue {
  blockClickRef: RefObject<boolean>;
}

const MapInteractionContext = createContext<MapInteractionContextValue>({
  blockClickRef: { current: false },
});

export function useMapInteraction(): MapInteractionContextValue {
  return useContext(MapInteractionContext);
}

interface PanZoomMapProps {
  children: ReactNode;
  enabled?: boolean;
  className?: string;
  showHint?: boolean;
}

function PanZoomViewport({ children, className, showHint }: { children: ReactNode; className: string; showHint: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { transform, blockClickRef, isOffCenter, reset, zoomIn, zoomOut, handlers } = usePanZoom({
    containerRef: viewportRef,
    enabled: true,
  });

  return (
    <MapInteractionContext.Provider value={{ blockClickRef }}>
      <div ref={viewportRef} className={`map-stage pan-zoom-viewport ${className}`} {...handlers}>
        <div
          className="pan-zoom-content"
          style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
        >
          {children}
        </div>

        <div className="map-zoom-controls" onPointerDown={e => e.stopPropagation()}>
          <button type="button" className="map-zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
          <button type="button" className="map-zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
          <button type="button" className="map-zoom-btn map-zoom-reset" onClick={reset} aria-label="Reset view">⟲</button>
        </div>

        {showHint && !isOffCenter && (
          <div className="map-pan-hint">Pinch or drag to explore</div>
        )}

        {isOffCenter && (
          <button type="button" className="map-recenter-btn" onClick={reset} onPointerDown={e => e.stopPropagation()}>
            Recenter map
          </button>
        )}
      </div>
    </MapInteractionContext.Provider>
  );
}

export function PanZoomMap({ children, enabled = true, className = '', showHint = true }: PanZoomMapProps) {
  const noopRef = useRef(false);

  if (!enabled) {
    return (
      <MapInteractionContext.Provider value={{ blockClickRef: noopRef }}>
        <div className={`map-stage ${className}`}>{children}</div>
      </MapInteractionContext.Provider>
    );
  }

  return (
    <PanZoomViewport className={className} showHint={showHint}>
      {children}
    </PanZoomViewport>
  );
}
