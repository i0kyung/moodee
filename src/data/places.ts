// 장소 목록: 이번 단계에서는 Classroom만 열림, 나머지는 Coming soon
export type PlaceId = 'classroom' | 'my-room' | 'library' | 'museum' | 'cafe';

export interface Place {
  id: PlaceId;
  name: string;
  blurb: string;
  icon: string;
  available: boolean;
  tint: string;
}

const base = import.meta.env.BASE_URL;

// 홈 휠에 도는 순서(시계 방향)
export const PLACES: Place[] = [
  { id: 'classroom', name: 'Classroom', blurb: 'Clock ticks, pencil scratches, a breeze through the window.', icon: `${base}assets/places/icon-classroom.png`, available: true, tint: '#C9B8E0' },
  { id: 'cafe', name: 'Café', blurb: 'Cups and chatter.', icon: `${base}assets/places/icon-cafe.png`, available: false, tint: '#F2C46B' },
  { id: 'library', name: 'Library', blurb: 'Quiet pages.', icon: `${base}assets/places/icon-library.png`, available: false, tint: '#B79BD6' },
  { id: 'museum', name: 'Museum', blurb: 'Echoing halls.', icon: `${base}assets/places/icon-museum.png`, available: false, tint: '#E9A3B0' },
  { id: 'my-room', name: 'My Room', blurb: 'Soft and familiar.', icon: `${base}assets/places/icon-my-room.png`, available: false, tint: '#E8955A' },
];

// ───────── 교실 ─────────
// 모든 좌표는 원본 교실 이미지(941×1672) 픽셀 기준

export type Rect = [x0: number, y0: number, x1: number, y1: number];
export interface Seat {
  id: string;
  x: number; // 의자 중심(캐릭터 발 위치)
  y: number;
  side: 'left' | 'right';
}

const SEAT_ROWS: [y: number, xs: number[]][] = [
  [540, [235, 340, 610, 715]],
  [715, [218, 330, 620, 735]],
  [925, [200, 320, 625, 750]],
  [1165, [185, 315, 640, 770]],
];

export const CLASSROOM = {
  width: 941,
  height: 1672,
  // 위에서 본 교실: 걸어 다니며 자리 고르기
  top: {
    src: `${base}assets/places/classroom-topdown.png`,
    charH: 0.16, // 캐릭터 한 컷 높이(이미지 높이 대비)
    start: { x: 470, y: 1390 }, // 뒷문 앞에서 시작
    bounds: [70, 300, 872, 1440] as Rect,
    // 걸어서 통과할 수 없는 곳(책상 상판, 교탁)
    blockers: [
      [370, 285, 575, 410],
      [170, 430, 400, 500], [545, 430, 780, 500],
      [148, 595, 400, 670], [550, 595, 805, 670],
      [125, 795, 395, 880], [555, 795, 830, 880],
      [100, 1025, 390, 1120], [560, 1025, 855, 1120],
    ] as Rect[],
    seats: SEAT_ROWS.flatMap(([y, xs], r) =>
      xs.map((x, c): Seat => ({ id: `${r + 1}${'ABCD'[c]}`, x, y, side: c < 2 ? 'left' : 'right' })),
    ),
  },
  // 캐릭터 뒤 눈높이 교실: 앉은 모습
  back: {
    src: `${base}assets/places/classroom-backview.png`,
    chairs: `${base}assets/places/classroom-backview-chairs.png`,
    // 앉는 의자(3번째 줄 통로 쪽). hipY에서 캐릭터 컷을 잘라 등받이 뒤로 숨김
    seat: {
      left: { x: 175, hipY: 935 },
      right: { x: 790, hipY: 935 },
    },
    charH: 0.32,
    hipCut: 0.66, // 캐릭터 컷에서 엉덩이 높이(이 아래는 잘라냄)
  },
} as const;
