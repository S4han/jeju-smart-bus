// 지도 위 아래 패널(TASK-022). 손잡이를 끌거나 눌러 접기(peek)·펼치기(full)를 오간다.
// 접힌 높이만큼은 지도를 덮지 않는다 — 지도 영역이 패널 위에서 끝나 NAVER 로고가 가려지지 않는다(Maps 약관, AGENTS 규칙 6)
import { useRef, useState, type ReactNode } from "react";

export type SheetSnap = "peek" | "full";

interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  label: string;
  children: ReactNode;
}

export function BottomSheet({ snap, onSnapChange, label, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!sheetRef.current) return;
    drag.current = { startY: e.clientY, startHeight: sheetRef.current.getBoundingClientRect().height };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const next = drag.current.startHeight + (drag.current.startY - e.clientY);
    setDragHeight(Math.max(120, Math.min(next, window.innerHeight - 56)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const moved = Math.abs(e.clientY - drag.current.startY);
    const height = dragHeight ?? drag.current.startHeight;
    drag.current = null;
    setDragHeight(null);
    // 거의 움직이지 않았으면 누른 것으로 보고 전환, 끌었으면 화면 절반을 기준으로 가까운 쪽
    if (moved < 6) onSnapChange(snap === "full" ? "peek" : "full");
    else onSnapChange(height > window.innerHeight * 0.6 ? "full" : "peek");
  };

  return (
    <section
      ref={sheetRef}
      className={`sheet is-${snap}${dragHeight !== null ? " is-dragging" : ""}`}
      style={dragHeight !== null ? { height: dragHeight } : undefined}
      aria-label={label}
    >
      <button
        type="button"
        className="sheet-handle"
        aria-expanded={snap === "full"}
        aria-label={snap === "full" ? "패널 접기(지도 보기)" : "패널 펼치기"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragHeight(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSnapChange(snap === "full" ? "peek" : "full");
          }
        }}
      >
        <span className="sheet-grip" aria-hidden="true" />
      </button>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
