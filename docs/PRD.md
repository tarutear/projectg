# [PRD] Marker-Based Motion Analysis Web App (v1.1)

> 변경 이력
> - v1.0: 초안
> - v1.1: 개인정보 처리 방침 추가, 마커 할당 UX 보완, 정확도 수치 오류 수정, 측정 구간 정의 추가

---

## 1. 프로젝트 개요

### 목적

물리적 마커(20mm 노란색 원형 마커)를 활용하여 관절의 움직임, 거리, 각도를 정량적으로 측정하는 웹 기반 분석 도구 개발.

### 타겟 유저

- 물리치료사
- 재활 연구자
- 운동 기능 평가가 필요한 임상 사용자
- 홈 재활 모니터링 사용자

### 핵심 가치

고가의 모션캡처 장비 없이 스마트폰/노트북 카메라와 저가형 마커만으로 임상적 활용이 가능한 정량 데이터를 제공.

---

## 2. 시스템 범위 및 제한 사항

### 2.1 MVP 범위

- 단안(monocular) RGB 카메라 기반
- 2D 평면 움직임 분석 중심
- 카메라 고정 환경 권장
- 실시간 분석 및 CSV 저장 지원

### 2.2 제한 사항

- 카메라 흔들림 / 마커 가림 / 조명 변화 / 마커 기울어짐
- 3차원 움직임: **카메라 기울기 5° 당 약 0.4% 거리 오차**
- 광각 렌즈 왜곡 / 마커 경계 흐림

### 2.3 최소 지원 환경

| 항목 | 최소 사양 |
|---|---|
| 브라우저 | Chrome 90+, Safari 15+, Firefox 90+ |
| 카메라 해상도 | 720p 이상 |
| CPU | 모바일: Apple A12 / Snapdragon 730 급 이상 |
| 메모리 | 3GB 이상 |

---

## 3. 개인정보 및 데이터 처리 방침

- **서버 전송 없음**: 모든 처리는 브라우저 내에서만 수행
- **환자 식별 정보 미수집**
- **세션 데이터 로컬 저장**: IndexedDB에만 저장, 외부 전송 없음
- **영상 미저장**: 카메라 스트림은 실시간 분석에만 사용
- 이 앱은 **참고용 측정 보조 도구**로 포지셔닝 (SaMD 규제 범위 밖)

---

## 4. 마커 사양

- 형태: 원형 / 직경: 20mm / 색상: 고채도 노란색 / 표면: 무광 권장

---

## 5. 주요 기능

### 5.1 실시간 마커 트래킹
- HSV 색 공간 기반 검출
- Contour 기반 centroid + sub-pixel refinement
- `minEnclosingCircle()` 기반 지름 추출 → mm/px 변환계수 계산
- 최대 8개 마커 동시 추적

### 5.2 마커 할당 UX
- 자동 검출 → 임시 ID(M1~M8) 부여
- 라벨 클릭 → 인라인 편집 (예: `shoulder`, `elbow`, `wrist`)
- 각도 그룹: 3개 마커 순서 지정 (근위 → **정점** → 원위)
- 마커 이탈 후 복귀 시 거리 기반 ID 재매핑

### 5.3 관절 각도 분석
- `atan2()` 벡터 각도 계산
- 실시간 각도, 최대/최소, ROM, 각속도

### 5.4 데이터 안정화
- Moving Average / Kalman Filter
- Jitter suppression / Outlier rejection
- 가림 시 Linear interpolation

---

## 6. 캘리브레이션
- 카메라 선택 (전면/후면/외부 웹캠)
- HSV threshold auto tuning
- mm/px 품질 검증

---

## 7. 데이터 저장

| 저장 대상 | 저장소 |
|---|---|
| 측정 세션 데이터 | IndexedDB |
| 캘리브레이션 설정 | LocalStorage |
| 영상 원본 | 저장 안 함 |

CSV Export: 환자 식별 정보 없이 sessionId + 타임스탬프만 포함

---

## 8. 기술 스택

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Vision: OpenCV.js, WebAssembly
- State: Zustand
- Visualization: Recharts
- Storage: IndexedDB, LocalStorage, CSV Export

---

## 9. 로드맵

### Phase 1 — MVP
- 다중 마커 추적, 각도/거리 계산, 세션 저장, CSV 출력
- 목표: 20 FPS 이상, ±5~10mm / ±3~5°

### Phase 2 — 정밀도
- 렌즈 왜곡 보정, Optical flow, 고니오미터 검증
- 목표: ±2mm / ±2°

### Phase 3 — 고급 분석
- Python 파이프라인 (REST API), ROM 자동 리포트, SPSS/R 연동

---

## 10. 성공 지표

| 지표 | 목표 |
|---|---|
| 정확도 (MVP) | ±5~10mm / ±3~5° |
| 정확도 (고도화) | ±2mm / ±2° |
| 성능 | 20 FPS 이상 |
| 안정성 | 95% 이상 프레임 마커 유지 |
| 사용성 | 캘리브레이션 60초 미만 |
| 개인정보 | 서버 전송 0건 (Phase 2까지) |
