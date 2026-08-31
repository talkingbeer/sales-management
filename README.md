# CLOSER — 광고 세일즈 오퍼레이션 플랫폼

Salesforce Sales Cloud를 정면으로 벤치마크해 만든, 광고대행사용 내부 세일즈 오퍼레이션 데모.
영업사원이 실적을 직접 입력하고, 광고주를 관리하고, 첫 접점부터 계약까지 파이프라인으로 보고,
영상·기획·디자인·랜딩페이지를 티켓으로 의뢰하고, 그 공수를 승인·배정하고,
차트가 아니라 **문장으로 된 분석 의견**을 받는 24개 화면.

---

## 실행

```
Windows   실행.cmd  또는 start.cmd  더블클릭
macOS·Linux   ./start.sh
어디서나      node serve.js
```
`http://localhost:4173` 이 자동으로 열립니다. 포트를 바꾸려면 `node serve.js 8080`.

`index.html` 을 그냥 더블클릭해도 동작합니다. 다만 브라우저에 따라 `file://` 에서는
localStorage가 막혀 **변경 사항이 새로고침에 사라집니다.** 서버로 여는 쪽을 권합니다.

빌드 도구도, 런타임 의존성도 없습니다. (`jsdom` 은 검증 스크립트 전용 devDependency입니다.)

---

## 요구사항 대응

| # | 요구 | 주 화면 |
|---|---|---|
| 1 | 영업사원이 본인 실적을 직접 입력하고 모니터링 | `app/performance.html` |
| 2 | 고객사(광고주) 관리 | `app/accounts.html` · `app/account.html` |
| 3 | 분석적인 의견 도출 | `app/insights.html` (규칙 29종) · 모든 화면의 인사이트 카드 |
| 4 | 공통 인력 공수 신청·관리 | `app/resources.html` · `app/timesheet.html` |
| 5 | 최초 영업부터 계약까지 단계별 flow | `app/pipeline.html` · `app/opportunity.html` |
| 6 | Jira형 제작 의뢰 티켓 프로세스 | `app/tickets.html` · `app/ticket.html` |

그 외 Salesforce에서 가져온 것 — 리드 전환, 견적·CPQ·할인 승인, 계약·갱신, 캠페인 성과,
매출 예측(Pipeline/Best Case/Commit 롤업), 리포트 빌더, 승인 프로세스, 활동 타임라인·캘린더,
전역 검색 ⌘K 팔레트, 권한 매트릭스, 감사 로그, 휴지통, CSV 내보내기, 키보드 단축키.
전체 대응표는 `landing.html` 의 “Salesforce에서 가져온 것” 섹션에 있습니다.

---

## 구조

```
index.html              첫 화면 — app/dashboard.html 로 즉시 이동 (meta refresh)
landing.html            제품 소개 — 설명 + 라이브 컴포넌트 (Workbench 매크로구조)
실행.cmd·start.cmd·start.sh  런처 (Windows / macOS·Linux)
serve.js                의존성 없는 로컬 정적 서버
tokens.css              디자인 토큰 (색·타이포·간격·모션) — 유일한 색상 원본
assets/css/             base · components · app · landing
assets/js/
  seed.js               생성된 데모 데이터 (약 3,000 레코드)
  util.js               DOM·포맷·날짜 헬퍼
  store.js              레코드 계층 (CRUD · 감사 로그 · 휴지통 · 세션)
  domain.js             업무 규칙 (파이프라인 8단계 · 티켓 전이표 · SLA · 권한 · 캐파)
  metrics.js            모든 지표의 단일 정의
  insights.js           규칙 29종 — 조건 → 근거 → 한국어 문장
  charts.js             손으로 그린 SVG 차트 (라이브러리 없음)
  ui.js                 토스트·모달·드로어·메뉴·테이블·CSV·단축키
  shell.js              사이드 레일 · 상단바 · ⌘K 팔레트 · 알림 · 역할 전환
app/*.html              24개 화면
tools/gen-seed.js       결정론적 시드 생성기
tools/verify.js         jsdom 기반 전 페이지 검증
tools/role-check.js     역할별 렌더링 확인
docs/SPEC.md            빌드 사양서 (2,091줄)
docs/GAPS.md            Salesforce 갭 분석 26항목
```

---

## 검증

```
node tools/verify.js                       모든 페이지 렌더 검증
node tools/verify.js app/tickets.html      한 페이지만
node tools/interact.js                     주요 동작이 실제로 데이터를 바꾸는지
node tools/role-check.js app/dashboard.html u11 u14 u13 u02
node tools/gen-seed.js                     시드 재생성 (결정론적 — 항상 같은 결과)
```

`verify.js` 는 각 페이지를 실제 스크립트와 함께 jsdom에서 렌더한 뒤
JS 오류 · 빈 패널 · 깨진 링크 · 중복 id · 화면에 노출된 `undefined`/`NaN` ·
이름 없는 버튼 · 이탤릭 제목 · 토큰 밖 색상 값을 검사합니다.

`interact.js` 는 렌더가 아니라 **동작**을 봅니다 — 파이프라인 카드를 실제로
드래그해 단계가 바뀌는지, 생성·수정·삭제·휴지통 복원이 왕복하는지,
⌘K 팔레트가 레코드를 찾는지, 인사이트 29종이 전부 근거 수치를 갖는지,
권한 매트릭스가 역할을 막는지, CSV가 화면의 표를 그대로 내보내는지,
중복 병합이 자식 레코드를 이관하는지, 티켓 전이표가 지켜지는지, SLA 판정이
신호를 만드는지 — 9가지를 실행해 확인합니다.

---

## 데이터에 대한 고지

**모든 회사·인물·연락처는 가상입니다.** 전화번호는 `010-****-0000` 형태로 마스킹되어 있고,
이메일은 존재하지 않는 도메인을 씁니다. 실제 개인정보를 이 데모에 입력하지 마세요.
내보내기(CSV/JSON)에도 마스킹된 값이 그대로 나갑니다.

기준 시각은 **2026-08-24** 로 고정되어 있어, 언제 열어도 화면이 같은 이야기를 합니다.

### 상표 및 관계 고지

이 저장소는 Salesforce, Inc. 및 그 계열사와 **아무런 제휴·후원·승인 관계가 없는 독립적인 학습용 구현물**입니다.
Salesforce · Sales Cloud · Service Cloud · Lightning · Einstein 은 Salesforce, Inc. 의 상표이며,
이 문서에서는 어떤 제품 동작을 벤치마크했는지 **가리키기 위한 목적으로만** 사용합니다.
Salesforce의 코드·디자인 자산·문서 원문은 포함되어 있지 않습니다.
Jira 는 Atlassian 의 상표이며, 티켓 워크플로 설계를 비교 설명할 때에만 언급합니다.

---

## 다른 컴퓨터에서 이어서 작업하기

```bash
git clone https://github.com/talkingbeer/sales-management.git
cd sales-management
npm install          # jsdom 하나뿐 — 검증 스크립트 전용입니다
node serve.js        # http://localhost:4173
```

Node 18 이상이면 동작합니다(개발은 Node 25에서 했습니다). 런타임 의존성은 없고,
`npm install` 은 `tools/verify.js` · `tools/interact.js` · `tools/role-check.js` 를 돌리기 위한 것입니다.
데모만 보려면 설치 없이 `node serve.js` 만으로 충분합니다.

### 어디부터 읽어야 하나

읽는 순서가 중요합니다. 화면부터 열면 길을 잃습니다.

1. `docs/SPEC.md` — 2,091줄 빌드 사양서. 데이터 모델·파이프라인·티켓 워크플로·권한·인사이트 규칙의 원본.
2. `assets/js/domain.js` — 업무 규칙이 전부 여기에 있습니다. 파이프라인 8단계, 티켓 전이표, SLA, 권한 매트릭스, 캐파 산식.
3. `assets/js/metrics.js` — 모든 지표의 **단일 정의**. 두 화면이 같은 숫자를 다르게 계산하면 그건 버그입니다.
4. `assets/js/insights.js` — 규칙 29종. 조건 → 근거 → 문장 구조를 그대로 따라 새 규칙을 추가하면 됩니다.
5. `app/dashboard.html` — 화면을 만드는 방식의 기준점. 새 화면은 이 파일의 `<head>`·스크립트 순서·코딩 어투를 복사해서 시작합니다.

### 손대면 안 되는 규칙

- **ES 모듈·`fetch()`·번들러 금지.** `file://` 더블클릭으로 열려야 하기 때문입니다. 전부 클래식 스크립트에 전역 `window.CLOSER` 네임스페이스입니다.
- **색은 `tokens.css` 밖에서 만들지 않습니다.** 페이지 안 `<style>` 에도 `var(--token)` 만 씁니다. `tools/verify.js` 가 잡아냅니다.
- **지어낸 숫자 금지.** 화면의 모든 수치는 `db`/`metrics`/`domain` 에서 계산돼야 합니다.
- **되돌릴 수 있는 동작에는 확인 모달을 띄우지 않습니다.** 낙관적 반영 + `ui.toast({undo})`. 확인 모달은 되돌릴 수 없는 것에만.

### 데이터를 바꾸려면

`assets/js/seed.js` 는 **생성물이니 직접 고치지 마세요.** `tools/gen-seed.js` 를 고치고 다시 생성합니다.

```bash
node tools/gen-seed.js     # 결정론적 — 같은 코드면 항상 같은 데이터
node tools/verify.js       # 25개 페이지 재검증
node tools/interact.js     # 9개 동작 재검증
```

실제 운영 데이터를 붙이려면 `assets/js/store.js` 의 `C.today` 를 `new Date()` 로 바꾸고,
`window.CLOSER_SEED` 와 같은 형태로 데이터를 주입하면 됩니다.
그 아래 계층(`domain` · `metrics` · `insights`)은 데이터 출처를 모릅니다.

### 아직 안 만든 것

`docs/GAPS.md` 의 26개 항목 중 이번 빌드 범위 밖으로 남긴 것들입니다.
우선순위는 `docs/SPEC.md` 12장에 있습니다.

| 남은 것 | 왜 필요한가 |
|---|---|
| CSV 가져오기 (컬럼 매핑 · 인코딩 선택) | 내보내기만 있고 들여오기가 없습니다. 실 데이터 이관의 첫 관문입니다. |
| 초성 검색 | ⌘K 팔레트가 `indexOf` 부분일치만 합니다. 한국어 CRM에서 "ㄴㅂㅋㅁㅅ"로 노바커머스를 못 찾으면 검색이 아닙니다. |
| 예측 제출 이력 (주차별 Commit 스냅샷) | 리포트의 weekly는 현재 상태에서 역산합니다. 관리자의 예측 정확도를 재려면 제출 시점을 적재해야 합니다. |
| 담당자 다중 소속 (AccountContactRelation) | 한 담당자가 계열사 여러 곳을 담당하는 경우를 지금은 표현하지 못합니다. |
| 다중 통화 · 일자별 환율 | 해외 매체(USD) 집행 시 마진이 재현되지 않습니다. |
| 견적서 인쇄/PDF 레이아웃 | 인쇄 CSS는 있지만 견적서 전용 지면 설계는 없습니다. |
| 수신 동의(마케팅) 계층 | 지금은 마스킹만 합니다. 채널×목적별 동의 기록이 없습니다. |

---

## 디자인

Hallmark 디자인 스킬의 규칙을 따랐습니다 —
genre `modern-minimal` · theme `Cobalt` · macrostructure `Workbench` ·
nav `N13 인라인 ⌘K` + `N3 사이드 레일` · footer `Ft2`.
색은 전부 OKLCH 토큰이고, 페이지 어디에도 토큰 밖의 색상 리터럴이 없습니다.
살아 있는 스타일 가이드는 `app/design.html` 에 있습니다.

### 지켜야 하는 네 가지

`tools/verify.js` 가 매 페이지에서 검사하므로 어기면 빌드가 실패합니다.

| 규칙 | 이유 |
|---|---|
| **모든 면은 직각** (`--radius-*` 전부 0) | 둥근 것은 아바타 · 상태 도트 · 스피너뿐. 그래서 “둥글면 사람이거나 상태”가 성립합니다. |
| **카드에 색 띠 금지** | 색만으로 심각도를 말하면 무엇이 위험한지 전달되지 않고, 색각 이상 사용자에게는 아무것도 남지 않습니다. 첫 줄의 `위험·주의·조치·양호` 낱말이 대신합니다. |
| **`font-size` 는 `var(--text-*)` 로만** | px 를 직접 쓰면 스케일 밖으로 나갑니다. 본문 15px · 표 14px · 모노 라벨 12px 이 하한입니다. |
| **한글 줄바꿈은 `keep-all`** | 기본값은 “메이플에듀”를 음절 단위로 쪼갭니다. 컨트롤 높이도 `height` 로 고정하지 않습니다 — 받침이 잘립니다. |

### 화면을 직접 보기

```
node tools/shots.js                     # 주요 화면을 .shots/ 에 PNG 로
node tools/shots.js app/tickets.html    # 한 화면만
node tools/shots.js --width 390         # 모바일 폭
```

시스템에 설치된 Chrome/Edge 를 그대로 씁니다(브라우저를 내려받지 않습니다).
가로 넘침 · 남은 라운드 · 12px 미만 글자를 함께 보고합니다.
