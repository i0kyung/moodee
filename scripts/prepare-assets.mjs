// 원본 참고 이미지(2026글로벌해커톤)를 앱 규격 경로/이름으로 정리하는 스크립트
// - 캐릭터 시트·장소 아이콘: 테두리에서 flood fill로 단색 배경(회색/흰색)을 투명 처리
// - 교실 배경: 그대로 복사(용량만 최적화)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// 원본 참고자료는 프로젝트 상위 폴더(2026글로벌해커톤)에 있음
const SRC = path.resolve('..');
const OUT = path.resolve('public/assets');

// 캐릭터 발밑의 회색 그림자(원본 회색 배경에 붙어 있던 것) → 앱에서 부드러운 그림자로 대체
const CHAR_SHADOW = { minLum: 52, maxLum: 106, maxSat: 16, yMin: 0.752 }; // 바지 밑단(≈0.745) 아래만: 회색 바지 보존
// 흰 배경 아이콘 아래 연회색 그림자 → 어두운 휠 위에서 흰 얼룩으로 보여서 제거
const ICON_SHADOW = { minLum: 150, maxLum: 256, maxSat: 14, yMin: 0 };

const jobs = [
  // [원본, 결과, 배경제거 여부, 투명 임계값(near), 부분투명 임계값(far), 교실 인형 지우기, 바닥 그림자 제거]
  // 바닥 그림자: 배경과 이어진 무채색 픽셀 중 밝기가 [min, max]이고 이미지 높이 비율 yMin 아래인 것
  ['캐릭터/2.민경.png', 'characters/char-ponytail.png', true, 22, 44, null, CHAR_SHADOW],
  ['캐릭터/1.김다현.png', 'characters/char-bob.png', true, 22, 44, null, CHAR_SHADOW],
  ['캐릭터/3.niersora.png', 'characters/char-wavy.png', true, 22, 44, null, CHAR_SHADOW],
  ['캐릭터/4. Nazan.png', 'characters/char-curly-glasses.png', true, 22, 44, null, CHAR_SHADOW],
  // 교실 배경: 캐릭터 자리의 흰색 임시 인형을 지움 → 머리 원·몸통 사각형·복사해 올 바닥 오프셋
  ['classroom/image 22.png', 'places/classroom-topdown.png', false, 0, 0, { head: [477, 1037, 46], body: [428, 1050, 528, 1130], from: [0, 150] }],
  ['classroom/image 17.png', 'places/classroom-backview.png', false, 0, 0, { head: [476, 1024, 74], body: [394, 1028, 556, 1196], from: [0, 250] }],
  ['아이콘/image 29.png', 'places/icon-classroom.png', true, 20, 40],
  ['아이콘/image 23.png', 'places/icon-my-room.png', true, 10, 22, null, ICON_SHADOW],
  ['아이콘/image 24.png', 'places/icon-library.png', true, 10, 22, null, ICON_SHADOW],
  ['아이콘/image 28.png', 'places/icon-museum.png', true, 20, 40],
  ['아이콘/image 31.png', 'places/icon-cafe.png', true, 10, 22, null, ICON_SHADOW],
];

// 테두리와 연결된 배경색 픽셀만 지워서 캐릭터 내부의 비슷한 색은 보존
function removeBackground(data, w, h, near, far, shadow) {
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  // 네 모서리 평균을 배경색으로 사용
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map(px);
  const bg = [0, 1, 2].map((c) => corners.reduce((s, p) => s + p[c], 0) / 4);
  const dist = (i) => {
    const [r, g, b] = px(i);
    return Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i]) continue;
    seen[i] = 1;
    let d = dist(i);
    if (shadow) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const lum = (r + g + b) / 3;
      // 무채색 그림자 픽셀은 배경과 같게 취급(완전 투명 + 계속 번짐)
      if (Math.max(r, g, b) - Math.min(r, g, b) <= shadow.maxSat && lum >= shadow.minLum && lum < shadow.maxLum && i / w >= shadow.yMin * h) d = 0;
    }
    if (d > far) continue;
    // near 이하는 완전 투명, near~far 구간은 가장자리 부드럽게
    const a = d <= near ? 0 : Math.round(((d - near) / (far - near)) * 255);
    data[i * 4 + 3] = Math.min(data[i * 4 + 3], a);
    if (d > near) continue; // 가장자리 픽셀에서는 더 번지지 않음
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
}

// 임시 인형 모양(머리 원 + 몸통 둥근 사각형) 마스크를 만들고,
// 같은 통로의 아래쪽 바닥 패치를 복사해 덮은 뒤 가장자리를 부드럽게 섞음
function erasePlaceholder(data, w, { head, body, from }) {
  const [hx, hy, hr] = head;
  const [bx0, by0, bx1, by1] = body;
  const x0 = Math.min(hx - hr, bx0) - 20, x1 = Math.max(hx + hr, bx1) + 20;
  const y0 = Math.min(hy - hr, by0) - 20, y1 = Math.max(hy + hr, by1) + 20;
  const bw = x1 - x0, bh = y1 - y0;
  const hard = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const X = x + x0, Y = y + y0;
      const inHead = (X - hx) ** 2 + (Y - hy) ** 2 <= hr * hr;
      const inBody = X >= bx0 && X <= bx1 && Y >= by0 && Y <= by1;
      hard[y * bw + x] = inHead || inBody ? 1 : 0;
    }
  // 박스 블러로 부드러운 알파(반경 9)
  const R = 9, soft = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      let sum = 0, n = 0;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
          sum += hard[yy * bw + xx]; n++;
        }
      // 인형 경계선까지 확실히 덮도록 가중
      soft[y * bw + x] = Math.min(1, (sum / n) * 1.8);
    }
  const [dx, dy] = from;
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const a = soft[y * bw + x];
      if (!a) continue;
      const i = ((y + y0) * w + x + x0) * 4;
      const j = ((y + y0 + dy) * w + x + x0 + dx) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - a) + data[j + c] * a);
    }
}

// 원본 시트는 머리카락이 컷 경계를 넘는 경우가 있어서(예: curly 앞모습),
// 경계 근처에서 가장 비어 있는 세로줄로 4등분한 뒤 각 인물을 넓은 컷(CELL_W) 가운데에 다시 배치
const CELL_W = 400;
function reslice(data, w, h) {
  const occ = new Array(w).fill(0);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (data[(y * w + x) * 4 + 3] > 40) occ[x]++;
  const cuts = [0];
  for (let k = 1; k < 4; k++) {
    const b = Math.round((w * k) / 4);
    let best = b;
    for (let x = b - 45; x <= b + 45; x++) if (occ[x] < occ[best]) best = x;
    cuts.push(best);
  }
  cuts.push(w);
  const out = Buffer.alloc(CELL_W * 4 * h * 4);
  for (let k = 0; k < 4; k++) {
    let l = cuts[k], r = cuts[k + 1];
    while (l < r && !occ[l]) l++;
    while (r > l && !occ[r - 1]) r--;
    const off = k * CELL_W + Math.round((CELL_W - (r - l)) / 2) - l;
    for (let y = 0; y < h; y++)
      for (let x = l; x < r; x++) {
        const nx = x + off;
        if (nx < k * CELL_W || nx >= (k + 1) * CELL_W) continue;
        data.copy(out, (y * CELL_W * 4 + nx) * 4, (y * w + x) * 4, (y * w + x) * 4 + 4);
      }
  }
  return { data: out, width: CELL_W * 4 };
}

for (const [src, out, cutout, near, far, erase, shadow] of jobs) {
  const dest = path.join(OUT, out);
  mkdirSync(path.dirname(dest), { recursive: true });
  let img = sharp(path.join(SRC, src)).ensureAlpha();
  if (erase) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    erasePlaceholder(data, info.width, erase);
    img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  if (cutout) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    removeBackground(data, info.width, info.height, near, far, shadow);
    if (out.startsWith('characters/')) {
      const r = reslice(data, info.width, info.height);
      img = sharp(r.data, { raw: { width: r.width, height: info.height, channels: 4 } });
    } else img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  // 아이콘은 카드용으로 축소, 전부 팔레트 양자화로 용량 절감
  if (out.includes('icon-')) img = sharp(await img.png().toBuffer()).resize({ width: 480 });
  await img.png({ compressionLevel: 9, palette: true, quality: 92, dither: 0.6 }).toFile(dest);
  console.log('✓', out);
}

// 눈높이 교실 사진에서 앉을 의자(3번째 줄 좌/우) 등받이만 떼어낸 오버레이.
// 캐릭터를 이 레이어 아래에 두면 등받이가 몸을 가려 앉은 것처럼 보인다.
// 의자는 붉은 갈색이라 R/G 비율로 나무 책상·바닥과 구분(그늘진 의자도 잡힘)
{
  const src = path.join(OUT, 'places/classroom-backview.png');
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const out = Buffer.alloc(W * H * 4);
  for (const [x0, y0, x1, y1] of [[70, 850, 285, 965], [680, 850, 895, 965]])
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        const a = Math.max(0, Math.min(1, (data[i] / (data[i + 1] + 1) - 1.42) / 0.22));
        if (a > 0) {
          data.copy(out, i, i, i + 3);
          out[i + 3] = Math.round(a * 255);
        }
      }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toFile(path.join(OUT, 'places/classroom-backview-chairs.png'));
  console.log('✓ places/classroom-backview-chairs.png');
}

// 교실 소품(투명 PNG) → 소리 설정 아이콘. 가장자리의 옅은 색 번짐(알파 낮은 픽셀)을 지우고 여백을 잘라 축소
{
  const props = [
    ['ChatGPT 이미지 2026년 9월 29일 오후 05_52_59-1.png', 'prop-desk.png'],
    ['ChatGPT 이미지 2026년 9월 29일 오후 05_53_00-2.png', 'prop-teacher-desk.png'],
    ['ChatGPT 이미지 2026년 9월 29일 오후 05_53_00-3.png', 'prop-blackboard.png'],
    ['ChatGPT 이미지 2026년 9월 29일 오후 05_53_02-4.png', 'prop-bookshelf.png'],
    ['ChatGPT 이미지 2026년 9월 29일 오후 05_53_03-5.png', 'prop-door.png'],
    ['ChatGPT 이미지 2026년 9월 29일 오후 05_53_04-6.png', 'prop-clock.png'],
  ];
  mkdirSync(path.join(OUT, 'places/props'), { recursive: true });
  for (const [src, out] of props) {
    const { data, info } = await sharp(path.join(SRC, 'classroom', src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) if (data[i] < 64) data[i] = 0;
    const trimmed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    await sharp(trimmed)
      .trim({ threshold: 0 })
      .resize({ width: 240, height: 240, fit: 'inside' })
      .png({ compressionLevel: 9, palette: true, quality: 92 })
      .toFile(path.join(OUT, 'places/props', out));
    console.log('✓ places/props/' + out);
  }
}
