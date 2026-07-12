import type { LayerCategory } from '../types/game';
import { LAYER_LABELS } from '../engine/gameState';

interface LayerTrayProps {
  visibleLayers: LayerCategory[];
  showDefenseRanges: boolean;
  onToggleLayer: (layer: LayerCategory) => void;
  onToggleDefenseRanges: () => void;
}

const ALL_LAYERS: LayerCategory[] = [
  'military', 'airDefense', 'drones', 'alliances', 'events', 'economic',
];

export function LayerTray({ visibleLayers, showDefenseRanges, onToggleLayer, onToggleDefenseRanges }: LayerTrayProps) {
  return (
    <div className="layer-tray">
      <span className="layer-tray-label">Layers</span>
      {ALL_LAYERS.map(layer => (
        <button
          key={layer}
          className={`layer-btn ${visibleLayers.includes(layer) ? 'active' : ''}`}
          onClick={() => onToggleLayer(layer)}
        >
          {LAYER_LABELS[layer]}
        </button>
      ))}
      {visibleLayers.includes('airDefense') && (
        <button
          className={`layer-btn sub ${showDefenseRanges ? 'active' : ''}`}
          onClick={onToggleDefenseRanges}
        >
          Range Rings
        </button>
      )}
    </div>
  );
}
