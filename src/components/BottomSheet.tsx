import { useEffect, useCallback, type ReactNode, type MouseEvent } from 'react';
import { useMobileLayout } from '../hooks/useMobileLayout';

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ onClose, children, className = '' }: BottomSheetProps) {
  const isMobile = useMobileLayout();

  useEffect(() => {
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile]);

  const handleBackdropClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleSheetClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  if (!isMobile) {
    return <div className={`panel ${className}`}>{children}</div>;
  }

  return (
    <div className="bottom-sheet-overlay" onClick={handleBackdropClick}>
      <div
        className={`bottom-sheet ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={handleSheetClick}
      >
        <button
          type="button"
          className="bottom-sheet-handle"
          aria-label="Close panel"
          onClick={onClose}
        />
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </div>
  );
}
