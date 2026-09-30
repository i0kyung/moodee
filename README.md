# MOODEE

A cozy world for distracted minds.

흐름: (첫 실행) 캐릭터 선택 → 홈 장소 휠(돌리면 캐릭터가 옆모습으로 걸음, "Going to …") → 교실 탑뷰에서 걸어서 자리 고르기(조이스틱·방향키·바닥 탭) → 눈높이 뷰로 앉기 → 소리 설정 → 집중 타이머

```bash
npm install
npm run dev
```

## 에셋

`public/assets/`는 `npm run assets`(scripts/prepare-assets.mjs)가 상위 폴더(`2026글로벌해커톤`)의 원본에서 생성한다.

- 캐릭터 시트: 회색 배경 투명화 + 4컷을 각 400px 폭으로 재배치(원본은 머리카락이 컷 경계를 넘음) → `CELL_ASPECT = 400/1086`
- 교실 배경: 캐릭터 자리의 흰색 임시 인형을 바닥 패치로 지움, 눈높이 사진에서 앉을 의자 등받이만 떼어 `classroom-backview-chairs.png` 생성(캐릭터를 그 아래에 두어 앉은 모습)
- 장소 아이콘: 배경 투명화 + 480px 축소

파일이 없으면 파스텔 플레이스홀더로 대체된다.

## 소리

음원 파일 없이 Web Audio API로 합성(시계·연필·창문 바람/새·룸톤). 채널별 GainNode → master GainNode.
