// 기기 화면에 맞춘 배치 선택(TASK-023). 화면 크기만 보고 정한다 — 기기 종류·사용자 정보는 쓰지 않는다
import { useEffect, useState } from "react";

// 지도 + 왼쪽 패널(태블릿·PC, 가로로 눕힌 휴대폰) / 지도 + 아래 패널(세로 휴대폰)
export type MapLayout = "side" | "sheet";

export const SIDE_MIN_WIDTH = 768;
// 가로로 눕힌 휴대폰: 아래 패널은 높이가 모자라 왼쪽 패널이 낫다
export const LANDSCAPE_SIDE_MIN_WIDTH = 560;

export function mapLayoutFor(width: number, height: number): MapLayout {
  if (width >= SIDE_MIN_WIDTH) return "side";
  if (width > height && width >= LANDSCAPE_SIDE_MIN_WIDTH) return "side";
  return "sheet";
}

const current = (): MapLayout =>
  typeof window === "undefined" ? "sheet" : mapLayoutFor(window.innerWidth, window.innerHeight);

export function useMapLayout(): MapLayout {
  const [layout, setLayout] = useState<MapLayout>(current);
  useEffect(() => {
    const update = () => setLayout(current());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return layout;
}
