# CLOSER — 빌드 사양서 (BUILD SPEC)

> **문서 지위**: 이 문서는 CLOSER의 단일 진실 공급원(Single Source of Truth)입니다.
> 구현 에이전트는 이 문서에 적힌 필드명·상태값·수식·라우트를 **문자 그대로** 따릅니다.
> 이 문서와 코드가 다르면 코드가 defect입니다. 이 문서에 없는 것을 임의로 만들지 않습니다.
>
> **버전**: 1.0 · **기준일(데모 오늘)**: 2026-08-24 · **통화**: KRW(원, 소수점 없음) · **로케일**: ko-KR · **타임존**: Asia/Seoul
>
> **보안 원칙(필수 준수)**
> - 모든 데모 데이터는 **가상**입니다. 실존 기업·인물·연락처를 쓰지 않습니다.
> - 전화번호는 `010-****-1234`, `02-****-9192` 형태로 **마스킹**해 저장·표시합니다.
> - 이메일은 `*-demo.co.kr` 등 가상 도메인만 사용합니다.
> - API 키·토큰·비밀번호를 코드나 시드에 **하드코딩하지 않습니다**. 외부 연동은 주입식 자격증명(Named Credential 패턴)만 정의하고, 값은 비워 둡니다.
> - 사용자 입력을 DOM에 넣을 때 반드시 `textContent` 또는 이스케이프를 사용합니다(XSS 방지). `innerHTML` 직접 대입 금지.

---

## 목차

1. [제품 정의](#1-제품-정의)
2. [역할(Persona) 5종](#2-역할persona-5종)
3. [데이터 모델](#3-데이터-모델)
4. [파이프라인 정의](#4-파이프라인-정의)
5. [화면 목록 (IA)](#5-화면-목록-ia)
6. [화면별 상세](#6-화면별-상세)
7. [분석 엔진 사양](#7-분석-엔진-사양)
8. [티켓 워크플로우](#8-티켓-워크플로우)
9. [공수(리소스) 워크플로우](#9-공수리소스-워크플로우)
10. [권한 매트릭스](#10-권한-매트릭스)
11. [시드 데이터 계획](#11-시드-데이터-계획)
12. [추가 클론 기능 목록](#12-추가-클론-기능-목록)

---

## 1. 제품 정의

**CLOSER**는 한국 디지털 광고대행사의 영업 조직과 제작 조직을 하나의 레코드 위에서 돌리는 **영업운영(Sales Operations) 플랫폼**입니다. 영업사원(AE)이 자기 실적을 직접 입력하고 목표 대비 진척을 실시간으로 보며, 광고주(거래처)와 담당자를 관리하고, 최초 문의부터 계약 체결까지 8단계 파이프라인을 눈으로 확인하고, 영상·광고기획·디자인·랜딩페이지 개발을 Jira 티켓처럼 사내 제작 인력에게 의뢰하고, 그 제작에 필요한 공수(man-hour)를 신청·승인·배정·기록하며, 이 모든 데이터에서 차트가 아니라 **한국어 문장으로 된 분석 의견**을 자동으로 도출합니다. 제품의 계보는 명시적으로 **Salesforce Sales Cloud**(Account/Contact/Lead/Opportunity/Quote/Contract 레코드 모델, Sales Process와 Path, Forecast Category, 승인 프로세스, 리포트/대시보드), **Salesforce Service Cloud**(Case 기반 큐·SLA·에스컬레이션을 제작 의뢰 티켓으로 재해석), **Certinia PSA**(Resource Request → Assignment → Timecard → Utilization 공수 체인), 그리고 **Atlassian Jira**(타입별 워크플로, 명시적 상태 전이, 보드, 워처, 공수 추정)입니다. UI는 Salesforce Lightning Experience의 해부학 — 고정 헤더, 앱 레일, 하이라이트 패널, Path 셰브론, 탭 스트립, 관련 목록 카드, 칸반, 인라인 편집, 토스트 — 을 따르되, 색·타이포·간격은 프로젝트의 `tokens.css` 디자인 토큰만 사용합니다. 사용자는 **영업사원 · 영업관리자 · 제작 인력 · 리소스 매니저 · 관리자** 5종이며, 각자 다른 홈 화면과 다른 권한을 갖습니다.

### 1.1 6대 필수 요구사항 → 구현 매핑

| # | 요구사항 | 구현 위치 |
|---|---|---|
| 1 | 영업사원이 본인 실적을 직접 입력·모니터링 | `performance.html` (내 실적) · `Actual` 엔티티 · `Target` 대비 게이지 · `dashboard.html` KPI 타일 |
| 2 | 고객사(광고주) 관리 | `accounts.html` · `account-detail` · `contacts.html` · `Account`/`Contact` 엔티티 · 광고주 건강도 |
| 3 | 분석적 의견 도출(내러티브) | `insights.html` · §7 인사이트 규칙 35종 · 모든 화면 상단 인사이트 배너 |
| 4 | 공통 인력 공수 신청·관리 | `resources.html` · `ResourceRequest` → `Assignment` → `Timesheet` → 가동률 · §9 |
| 5 | 최초 영업~계약 단계별 flow | `pipeline.html` 칸반 · Path 셰브론 · §4 8단계 정의 |
| 6 | Jira형 제작 의뢰 프로세스 | `tickets.html` 보드/목록 · `ticket-detail` · §8 워크플로우 |

### 1.2 아키텍처 전제

- **정적 SPA-less 멀티페이지**: 화면 1개 = HTML 파일 1개(`app/*.html`). 라우팅은 파일 링크. 상태는 `localStorage`.
- **레이어**: `util.js`(포맷·날짜) → `store.js`(객체 DB) → `domain.js`(비즈니스 규칙) → `metrics.js`(지표) → `insights.js`(문장 생성) → `charts.js`(SVG 차트) → `ui.js`(컴포넌트) → `shell.js`(앱 셸) → 화면.
- **메타데이터 구동**: 단계·상태·전이·권한·SLA는 전부 `domain.js`의 **테이블**입니다. 화면은 단계명을 하드코딩하지 않습니다.
- **지표 단일 정의**: 두 화면이 같은 이름의 숫자를 다르게 계산하면 버그입니다. 모든 지표는 `metrics.js`에만 있습니다.

---

## 2. 역할(Persona) 5종

각 페르소나는 `User.role` 값과 1:1 대응합니다. 값: `영업사원` `영업관리자` `제작인력` `리소스매니저` `관리자`.

### 2.1 영업사원 (AE) — `영업사원`

- **대표 인물(가상)**: 백유진 대리, 미디어세일즈 1팀. 담당 광고주 8~12개.
- **하루 일과**
  1. 홈에서 오늘 할 일 · 이번 분기 목표 대비 달성률 · 위험 딜 3건을 확인한다.
  2. 파이프라인 칸반에서 정체된 딜을 드래그해 단계를 올리고, 올리면서 필수 필드를 채운다.
  3. 광고주 상세에서 최근 활동을 남기고 다음 액션 날짜를 잡는다.
  4. 제안이 필요한 건은 견적을 만들고, 할인율이 20%를 넘으면 승인을 상신한다.
  5. 제안용 시안이 필요하면 **제작 의뢰 티켓**을 올리고, 공수가 큰 건은 **공수 신청**을 함께 낸다.
  6. 월말에 확정된 수주를 **내 실적**에 입력하고 제출한다.
- **홈 화면**: `dashboard.html` — 좌: 목표 게이지 + 파이프라인 커버리지 + 이번 달 수주, 중앙: 오늘/기한초과 할 일 + 위험 딜 리스트, 우: 인사이트 카드 3장 + 내 제작 의뢰 상태.
- **가장 자주 누르는 버튼**: `단계 변경`, `활동 기록`, `제작 의뢰`, `실적 입력`.
- **KPI**: 목표 달성률, 신규 광고주 수, 파이프라인 커버리지, 평균 영업 사이클.

### 2.2 영업관리자 (팀장/본부장) — `영업관리자`

- **대표 인물(가상)**: 서도현 팀장, 미디어세일즈 2팀. 팀원 5~7명.
- **하루 일과**
  1. 팀 대시보드에서 팀 목표 대비 갭과 팀원별 달성률 리더보드를 본다.
  2. 매출 예측 그리드에서 Commit/Best Case를 검토하고, 필요하면 조정(adjustment)한다.
  3. 승인함에서 할인 승인·공수 승인을 처리한다(반려 시 사유 필수).
  4. 정체 딜·마감일 경과 딜을 팀원에게 코칭한다.
  5. 광고주 집중도(상위 5개 비중)와 이탈 위험 광고주를 점검한다.
- **홈 화면**: `dashboard.html`(팀 스코프로 자동 전환) — 상단 팀 KPI 6타일, 팀원 리더보드 테이블, 단계별 병목 차트, 승인 대기 큐.
- **권한 특징**: 팀원 전원의 레코드를 조회(역할 계층 롤업), 목표(Target) 설정 권한 보유, 실적 확정 권한 보유.
- **KPI**: 팀 목표 달성률, 예측 정확도, 성사율, 팀 파이프라인 커버리지, 이탈 광고주 수.

### 2.3 제작 인력 — `제작인력`

- **대표 인물(가상)**: 임하람 영상편집자, 크리에이티브 제작본부.
- **하루 일과**
  1. 홈에서 **내게 배정된 티켓**을 마감일 순으로 확인한다. SLA D-day 배지를 본다.
  2. 티켓을 `진행중`으로 올리고, 작업 후 `검수`로 넘긴다.
  3. 의뢰자가 `수정요청`을 걸면 재작업 회차가 올라간다(무상 2회 한도 경고).
  4. 하루 끝에 **타임시트**에 오늘 투입 시간을 입력한다.
  5. 정보가 부족한 티켓은 코멘트로 의뢰자를 @멘션한다.
- **홈 화면**: `tickets.html`(보드 뷰, 스윔레인=나) — 상단 내 부하율 바 + SLA 임박 카드, 본문 칸반.
- **권한 특징**: 영업기회·광고주는 **읽기 전용**. 견적·계약·실적·목표는 **접근 불가**. 티켓은 배정된 건만 수정.
- **KPI**: SLA 준수율, 평균 처리 리드타임, 재작업률, 주간 가동률.

### 2.4 리소스 매니저 — `리소스매니저`

- **대표 인물(가상)**: 남태경 PM, 크리에이티브 제작본부 운영.
- **하루 일과**
  1. 미배정 티켓 큐를 보고 스킬·부하 기준으로 담당자를 배정한다.
  2. 공수 신청(ResourceRequest)을 승인/반려한다. 반려 시 사유 필수.
  3. 가동률 히트맵에서 과부하(>100%)·유휴(<60%) 인원을 찾아 재배분한다.
  4. SLA 초과 티켓을 에스컬레이션한다.
  5. 주간 제작 계획을 확정한다.
- **홈 화면**: `resources.html` — 상단 경보 카드 4장(미배정 / 승인 대기 / 과부하 / SLA 초과), 본문 인력×주 가동률 히트맵, 하단 공수 신청 큐.
- **권한 특징**: 티켓 전권(CRUD), 공수 신청 전권, 사용자 조회·수정, 영업 데이터는 읽기 전용.
- **KPI**: 팀 평균 가동률, 미배정 대기시간, SLA 준수율, 공수 승인 리드타임.

### 2.5 관리자 — `관리자`

- **대표 인물(가상)**: 한수아 세일즈 본부장 겸 시스템 관리자.
- **하루 일과**
  1. 전사 대시보드로 전 팀 실적·예측을 본다.
  2. 사용자·팀·권한을 관리하고, 목표를 배정한다.
  3. 광고상품·단가표·수수료율 마스터를 갱신한다.
  4. 감사 로그로 누가 무엇을 바꿨는지 확인한다.
  5. 최종 결재선(3차)에서 고액 할인·마진 예외를 승인한다.
- **홈 화면**: `dashboard.html`(전사 스코프) + `admin.html` 바로가기.
- **권한 특징**: 전 객체 CRUD, 설정 화면 접근, 감사 로그 조회, 데이터 리셋.
- **KPI**: 전사 취급고/순매출, 마진율, 예측 정확도, 시스템 데이터 품질(필수 필드 누락률).

### 2.6 페르소나 × 화면 매핑 요약

| 화면 | 영업사원 | 영업관리자 | 제작인력 | 리소스매니저 | 관리자 |
|---|:--:|:--:|:--:|:--:|:--:|
| dashboard | ● 홈 | ● 홈 | ○ | ○ | ● 홈 |
| pipeline / opportunities | ● | ● | ○(읽기) | ○(읽기) | ● |
| accounts / contacts / leads | ● | ● | ○(읽기) | ○(읽기) | ● |
| quotes / contracts | ● | ● | ✕ | ✕ | ● |
| performance / forecast | ● | ● | ✕ | ○ | ● |
| tickets | ● 의뢰 | ● | ● 홈 | ● | ● |
| resources / timesheet | ● 신청 | ○ | ● 입력 | ● 홈 | ● |
| approvals | ● 상신 | ● 결재 | ✕ | ● 결재 | ● 결재 |
| insights / reports | ● | ● | ○ | ○ | ● |
| admin | ✕ | ✕ | ✕ | ✕ | ● |

● 주 사용 · ○ 제한 사용 · ✕ 접근 불가

---

## 3. 데이터 모델

### 3.0 공통 규약

- **ID**: 문자열. 접두사로 타입을 식별합니다 — `u`(User) `t`(Team) `a`(Account) `c`(Contact) `l`(Lead) `o`(Opportunity) `ol`(OpportunityLine) `p`(Product) `pb`(PriceBook) `pe`(PriceBookEntry) `q`(Quote) `ql`(QuoteLine) `ct`(Contract) `cp`(Campaign) `ac`(Activity) `tk`(Ticket) `tc`(TicketComment) `th`(TicketHistory) `rr`(ResourceRequest) `as`(Assignment) `ts`(Timesheet) `tg`(Target) `at`(Actual) `nt`(Note) `ap`(Approval) `nf`(Notification) `al`(AuditLog) `cm`(Competitor) `mc`(MediaChannel) `lv`(ListView).
- **표시용 번호**: 사람이 부르는 번호는 별도 필드입니다 — 티켓 `PRD-101`, 견적 `Q-2026-102`, 계약 `C-2026-202`. 연도 리셋 채번.
- **날짜 타입**: `date` = `YYYY-MM-DD` 문자열. `datetime` = `YYYY-MM-DDTHH:mm:ss` 문자열.
- **금액**: `int`(원 단위, 소수점 없음). 표시 시 `1,234,000원` 또는 `12.3억`.
- **소프트 삭제**: 삭제는 `deletedAt` 스탬프 + 휴지통 15일 보관. 물리 삭제는 관리자만.
- **감사 필드**: 모든 최상위 엔티티는 `createdAt` / `updatedAt` / `createdById` / `updatedById`를 갖습니다(시드에서는 일부 생략, 런타임에서 채움).

### 3.1 Team — 조직

컬렉션: `teams`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 팀 ID | `id` | string(PK) | `t1` |
| 팀명 | `name` | string | `미디어세일즈 1팀` |
| 조직 구분 | `kind` | enum | `영업` \| `제작` \| `운영` |
| 팀장 | `leaderId` | FK→User | 승인 1차 결재자 기본값 |
| 상위 조직 | `parentId` | FK→Team \| null | 본부 → 팀 계층. 역할 계층 롤업의 근거 |
| 주간 캐파 | `weeklyCapacity` | int | 제작팀만. 팀 합계 가용 공수(h). 없으면 인원×34 |
| 활성 | `active` | bool | |

**관계**: Team 1:N User · Team 1:N Target(팀 목표) · Team 1:N Ticket(큐로서의 팀)

### 3.2 User — 사용자

컬렉션: `users`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 사용자 ID | `id` | string(PK) | `u01` |
| 성명 | `name` | string | 가상 인물명 |
| 이니셜 | `initials` | string | 아바타 표시용 2자 |
| 역할 | `role` | enum | `영업사원` `영업관리자` `제작인력` `리소스매니저` `관리자` |
| 소속 팀 | `teamId` | FK→Team | |
| 직책 | `title` | string | `세일즈 본부장`, `영상편집자` |
| 이메일 | `email` | string | 가상 도메인만 |
| 연락처 | `phone` | string | **마스킹 저장** `010-****-7077` |
| 입사일 | `hireDate` | date | 램프업 계산 |
| 활성 | `active` | bool | 비활성 시 배정 대상에서 제외, 레코드는 유지 |
| 직무(제작) | `craft` | enum \| null | 제작인력만: `영상편집자` `모션디자이너` `그래픽디자이너` `퍼블리셔` `프론트엔드개발자` `광고기획자` `카피라이터` `데이터분석가` |
| 스킬 | `skills` | string[] | `["프리미어","애프터이펙트"]` 매칭용 |
| 주간 가용 공수 | `weeklyCapacity` | int | 기본 34h(회의·버퍼 15% 제외) |
| 상위 관리자 | `managerId` | FK→User \| null | 승인 계층 |

**관계**: User N:1 Team · User 1:N Opportunity(owner) · User 1:N Account(owner) · User 1:N Ticket(requester/assignee) · User 1:N Timesheet · User 1:N Target · User 1:N Actual

**규칙**: 사용자는 삭제하지 않고 `active=false`로 비활성화합니다. 비활성화 시 소유 레코드 이관 마법사가 뜹니다(§12 참조).

### 3.3 Account — 광고주(거래처)

컬렉션: `accounts`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 광고주 ID | `id` | string(PK) | `a01` |
| 광고주명 | `name` | string | 가상 기업명 |
| 업종 | `industry` | enum | 이커머스/뷰티/헬스케어/금융/교육/게임/식음료/패션/여행/모빌리티/B2B SaaS/유통 |
| 등급 | `tier` | enum | `Key` `Major` `Growth` `Long-tail` |
| 담당 AE | `ownerId` | FK→User | 레코드 소유자. 공유 계산의 뿌리 |
| 웹사이트 | `website` | string | |
| 대표번호 | `phone` | string | **마스킹** `02-****-9192` |
| 주소 | `address` | string | 시/구 수준까지만 |
| 임직원 수 | `employees` | int | |
| 연간 예산 | `annualBudget` | int | 광고주가 밝힌 연 집행 예산(원) |
| 거래 상태 | `status` | enum | `잠재` `거래중` `휴면` `이탈` |
| 최초 거래일 | `firstDealDate` | date \| null | 신규/기존 판정 기준 |
| 최근 접촉일 | `lastActivityDate` | date \| null | 활동 기록 시 자동 갱신 |
| 상위 광고주 | `parentId` | FK→Account \| null | 그룹사↔계열사 계층 |
| 사업자등록번호 | `bizNo` | string | **마스킹** `123-**-*****`. 중복 판정 키 |
| 결제 조건 | `paymentTerms` | enum | `선입금` `익월 말일` `NET 30` `NET 60` |
| 여신 한도 | `creditLimit` | int | 선집행 승인 기준 |
| 메모 | `memo` | text | |

**관계**: Account 1:N Contact · 1:N Opportunity · 1:N Contract · 1:N Campaign · 1:N Ticket · 1:N Note · N:1 User(owner) · 자기참조 `parentId`

**파생값(저장 안 함, 계산)**: `건강도 점수`(§7.7), `누적 취급고`, `누적 순매출`, `진행 딜 수`, `미완료 티켓 수`.

### 3.4 Contact — 광고주 담당자

컬렉션: `contacts`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 담당자 ID | `id` | string(PK) | `c001` |
| 소속 광고주 | `accountId` | FK→Account | |
| 성명 | `name` | string | |
| 직함 | `title` | string | `이커머스 팀장` |
| 부서 | `dept` | string | |
| 이메일 | `email` | string | 가상 도메인 |
| 연락처 | `phone` | string | **마스킹** `010-****-4848` |
| 담당 AE | `ownerId` | FK→User | |
| 대표 담당자 | `isPrimary` | bool | 광고주당 1명만 true |
| 의사결정 역할 | `decisionRole` | enum | `의사결정자` `실무 담당` `구매·재무` `대행 검토` `기타` |
| 최근 접촉일 | `lastActivityDate` | date \| null | |
| 마케팅 수신동의 | `optInMarketing` | bool | 기본 false. 개인정보 준수 |

**관계**: Contact N:1 Account · 1:N Activity · N:1 User(owner) · N:M Opportunity(대표 담당자 `Opportunity.contactId`)

### 3.5 Lead — 리드(가망 광고주)

컬렉션: `leads`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 리드 ID | `id` | string(PK) | `l01` |
| 성명 | `name` | string | |
| 회사명 | `company` | string | 아직 Account가 아님(비정규화) |
| 직함 | `title` | string | |
| 이메일 | `email` | string | |
| 연락처 | `phone` | string | **마스킹** |
| 유입 경로 | `source` | enum | 인바운드 문의/전시·세미나/기존 광고주 소개/콜드 아웃바운드/파트너 소개/웹사이트/리타게팅 캠페인 |
| 상태 | `status` | enum | `신규` `접촉 시도` `접촉 완료` `적격` `부적격` `전환됨` |
| 점수 | `score` | int(0~100) | 규칙 기반 스코어(§7.7) |
| 업종 | `industry` | enum | |
| 예상 예산 | `estBudget` | int | 월 집행 예상액 |
| 담당 AE | `ownerId` | FK→User | |
| 등록일시 | `createdAt` | datetime | |
| 전환된 영업기회 | `convertedOppId` | FK→Opportunity \| null | 전환 후 읽기전용 |
| 전환된 광고주 | `convertedAccountId` | FK→Account \| null | |
| 전환된 담당자 | `convertedContactId` | FK→Contact \| null | |
| 전환일 | `convertedAt` | date \| null | |
| 메모 | `memo` | text | |

**관계**: Lead → (전환) → Account + Contact + Opportunity 3건 동시 생성. 전환 후 Lead는 **읽기 전용**으로 남습니다(삭제 금지).

**리드 전환 규칙**: 트랜잭션 1건으로 처리. ① 사업자등록번호/회사명 유사도로 기존 Account 매칭 제안 → ② Account 생성 또는 연결 → ③ Contact 생성 → ④ Opportunity 생성(선택 해제 가능) → ⑤ Lead에 3개 역참조 + `status='전환됨'` → ⑥ 후속 할 일 "제안서 작성" 자동 생성.

### 3.6 Opportunity — 영업기회

컬렉션: `opportunities`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 영업기회 ID | `id` | string(PK) | `o01` |
| 기회명 | `name` | string | `노바커머스 · 신규 가입 확보` |
| 광고주 | `accountId` | FK→Account | 필수 |
| 담당 AE | `ownerId` | FK→User | 필수 |
| 단계 | `stage` | enum | §4의 8단계 중 하나. 필수 |
| 금액(취급고) | `amount` | int | 라인이 있으면 **읽기전용 롤업** |
| 순매출 | `netRevenue` | int | 대행 수수료 기준. 라인 있으면 롤업 |
| 확률 | `probability` | int(0~100) | 단계에서 자동 세팅, 수동 override 가능 |
| 예측 카테고리 | `forecastCategory` | enum | `Pipeline` `Best Case` `Commit` `Closed` `Omitted` |
| 마감 예정일 | `closeDate` | date | 필수. 캠페인 집행 시작 예정일 |
| 생성일시 | `createdAt` | datetime | 사이클 계산 시작점 |
| 단계 진입일시 | `stageEnteredAt` | datetime | 체류일/정체 판정 기준 |
| 유형 | `type` | enum | `신규` `기존 확대` `갱신` `재계약` |
| 유입 경로 | `source` | enum | Lead.source와 동일 값 집합 |
| 경쟁사 | `competitorId` | FK→Competitor \| null | |
| 다음 액션 | `nextStep` | string(255) | `제안·PT` 단계 필수 |
| 실주 사유 | `lossReason` | enum \| null | `실주` 단계 필수 |
| 대표 담당자 | `contactId` | FK→Contact \| null | `제안준비` 단계 필수 |
| 연결 캠페인 | `campaignId` | FK→Campaign \| null | 수주 후 생성 |
| 팀원 | `teamIds` | FK→User[] | 영업기회 팀. 티켓 기본 워처 |
| 비공개 | `isPrivate` | bool | true면 소유자+관리자만 |

**관계**: Opportunity N:1 Account · N:1 User · 1:N OpportunityLine · 1:N Quote · 1:1 Contract · 1:N Ticket · 1:N Activity · 1:N Approval · 1:N Actual

**계산 규칙**
- `amount` = 라인 없으면 직접 입력값, 라인 있으면 `Σ(qty × unitPrice × (1 − discountPct/100) × months)`.
- `netRevenue` = 라인 없으면 `amount × 0.15`(기본 수수료율), 라인 있으면 `Σ(라인 금액 × 상품 commissionRate/100)`.
- `가중 파이프라인` = `amount × probability / 100`.

### 3.7 OpportunityLine — 영업기회 상품(품목)

컬렉션: `opportunityLines`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 라인 ID | `id` | string(PK) | `ol001` |
| 영업기회 | `oppId` | FK→Opportunity | Master-Detail(부모 삭제 시 연쇄 삭제) |
| 광고상품 | `productId` | FK→Product | |
| 단가표 항목 | `priceBookEntryId` | FK→PriceBookEntry | 단가의 출처. 없으면 Product.listPrice |
| 수량 | `qty` | number | 1 이상 |
| 단가 | `unitPrice` | int | PriceBookEntry에서 기본값, 수정 가능 |
| 할인율 | `discountPct` | number(0~100) | 승인 임계 판단 대상 |
| 집행 개월 | `months` | int | 기간형 상품의 안분 계수 |
| 금액 | `amount` | int | 계산값 `qty×unitPrice×(1−d/100)×months` |
| 집행 시작일 | `startDate` | date \| null | 월별 안분·정산 근거 |
| 집행 종료일 | `endDate` | date \| null | |
| 매체사 | `channelId` | FK→MediaChannel | 상품에서 상속 |
| 수수료율 | `commissionRate` | number | 상품 기본값에서 상속, 라인별 override |
| 제작 필요 | `needsProduction` | bool | true면 수주 시 티켓 자동 생성 대상 |
| 정렬 순서 | `sortOrder` | int | |

**관계**: OpportunityLine N:1 Opportunity(M-D) · N:1 Product · N:1 PriceBookEntry

### 3.8 Product — 광고상품

컬렉션: `products`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 상품 ID | `id` | string(PK) | `p01` |
| 상품명 | `name` | string | `통합검색 키워드 운영` |
| 카테고리 | `category` | enum | `검색` `디스플레이` `동영상` `SNS` `커머스` `제작` |
| 매체사 | `channelId` | FK→MediaChannel | |
| 단위 | `unit` | enum | `월` `건` `편` `캠페인` `1,000노출` `클릭` |
| 과금 방식 | `pricingModel` | enum | `CPM` `CPC` `CPA` `CPV` `정액` `구좌제` `공수` |
| 기준 단가 | `listPrice` | int | 표준 단가표 값 |
| 수수료율 | `commissionRate` | number | 기본 15. 순매출 인식 기준 |
| 원가율 | `costRate` | number | 제작 상품의 내부 원가 비율(%) |
| 최소 집행액 | `minSpend` | int | |
| 제작 동반 | `producesTicket` | enum \| null | 이 상품 판매 시 자동 생성할 티켓 타입 |
| 활성 | `active` | bool | 비활성 상품은 신규 라인에 추가 불가 |
| 비고 | `note` | text | |

**관계**: Product 1:N PriceBookEntry · 1:N OpportunityLine · 1:N QuoteLine · N:1 MediaChannel

### 3.9 PriceBook / PriceBookEntry — 단가표 / 상품 단가

컬렉션: `priceBooks`, `priceBookEntries`

**PriceBook**

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 단가표 ID | `id` | string(PK) | `pb1` |
| 단가표명 | `name` | string | `2026 표준 단가표`, `대형광고주 단가표`, `연간계약 단가표` |
| 표준 여부 | `isStandard` | bool | 정확히 1건만 true |
| 활성 | `isActive` | bool | |
| 적용 시작일 | `validFrom` | date | |
| 적용 종료일 | `validTo` | date \| null | |
| 설명 | `description` | text | |

**PriceBookEntry**

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 항목 ID | `id` | string(PK) | `pe001` |
| 단가표 | `priceBookId` | FK→PriceBook | 생성 후 변경 불가 |
| 광고상품 | `productId` | FK→Product | 생성 후 변경 불가 |
| 단가 | `unitPrice` | int | |
| 수수료율 | `commissionRate` | number | 단가표별 수수료 차등 |
| 표준가 사용 | `useStandardPrice` | bool | true면 표준 단가표 값 상속 |
| 활성 | `isActive` | bool | |

**규칙**: 표준 단가표에 항목이 없으면 커스텀 단가표에 추가할 수 없습니다. `(priceBookId, productId)` 유니크. 영업기회는 `pricebookId`를 고정하고, 라인은 그 단가표의 항목만 참조합니다. 단가표를 바꾸면 기존 라인 삭제 경고.

### 3.10 Quote / QuoteLine — 견적서 / 견적 품목

컬렉션: `quotes`, `quoteLines`

**Quote**

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 견적 ID | `id` | string(PK) | `q01` |
| 견적번호 | `no` | string | `Q-2026-102` 연도 리셋 자동 채번 |
| 영업기회 | `oppId` | FK→Opportunity | |
| 광고주 | `accountId` | FK→Account | |
| 작성자 | `ownerId` | FK→User | |
| 버전 | `version` | int | 1부터. 같은 기회에 복수 버전 공존 |
| 상태 | `status` | enum | `작성중` `승인대기` `승인` `반려` `발송` `수락` `거절` `만료` |
| 공급가액 | `total` | int | 라인 롤업 |
| 부가세 | `vat` | int | `total × 0.1` |
| 합계금액 | `grandTotal` | int | `total + vat` |
| 총 할인액 | `discountTotal` | int | 라인 롤업 |
| 최대 할인율 | `maxDiscountPct` | number | 승인 임계 판단 대상 |
| 순매출 | `netRevenue` | int | 수수료 롤업 |
| 대표 견적 | `isPrimary` | bool | 기회당 1건. 계약 전환 대상 |
| 유효기간 | `validUntil` | date | |
| 승인자 | `approvedBy` | FK→User \| null | |
| 작성일시 | `createdAt` | datetime | |
| 거래 조건 | `terms` | text | 선금/잔금/세금계산서 발행 조건 |

**QuoteLine**

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 라인 ID | `id` | string(PK) | `ql001` |
| 견적 | `quoteId` | FK→Quote | M-D |
| 광고상품 | `productId` | FK→Product | |
| 표시명 | `name` | string | 견적서 출력용 라인명 |
| 수량 | `qty` | number | |
| 집행 개월 | `months` | int | |
| 단가 | `unitPrice` | int | |
| 할인율 | `discountPct` | number | |
| 금액 | `amount` | int | 계산값 |
| 수수료율 | `commissionRate` | number | |
| 그룹 | `groupName` | string \| null | 매체별/월별 소계 그룹 |
| 정렬 | `sortOrder` | int | |

**관계**: Quote N:1 Opportunity · 1:N QuoteLine(M-D) · 1:N Approval

**규칙**: 상태가 `승인` 이상이면 라인 편집 잠금. 수정하려면 새 버전을 만듭니다(`version+1`, 라인 복제). `isPrimary` 견적의 총액이 Opportunity.amount와 다르면 화면에 불일치 배지를 띄웁니다.

### 3.11 Contract — 계약

컬렉션: `contracts`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 계약 ID | `id` | string(PK) | `ct01` |
| 계약번호 | `no` | string | `C-2026-202` |
| 영업기회 | `oppId` | FK→Opportunity | |
| 광고주 | `accountId` | FK→Account | |
| 담당 AE | `ownerId` | FK→User | |
| 시작일 | `startDate` | date | |
| 종료일 | `endDate` | date | `startDate + termMonths` 계산값 |
| 계약기간(월) | `termMonths` | int | |
| 계약금액 | `amount` | int | |
| 대행수수료율 | `commissionRate` | number | 계약 단위 수수료율 |
| 상태 | `status` | enum | `초안` `승인대기` `유효` `만료` `해지` |
| 자동갱신 | `autoRenew` | bool | true면 만료 60일 전 갱신 기회 자동 생성 |
| 갱신 통보 기한 | `renewalNoticeDays` | int | 기본 60 |
| 날인일 | `signedAt` | date \| null | |
| 정산 주기 | `billingCycle` | enum | `월 정산` `분기 정산` `일시불` `집행 완료 후` |
| 세금계산서 조건 | `taxInvoice` | string | |
| 최소 집행 보장액 | `minCommit` | int \| null | |

**관계**: Contract N:1 Opportunity · N:1 Account · 1:N Campaign

**규칙**: `유효` 전환 시 (a) 연결 캠페인 자동 생성, (b) `needsProduction` 라인만큼 제작 의뢰 티켓 자동 생성, (c) 승인 이력 잠금.

### 3.12 Campaign — 집행 캠페인

컬렉션: `campaigns`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 캠페인 ID | `id` | string(PK) | `cp01` |
| 캠페인명 | `name` | string | |
| 광고주 | `accountId` | FK→Account | |
| 계약 | `contractId` | FK→Contract \| null | |
| 담당 AE | `ownerId` | FK→User | |
| 매체 | `channelId` | FK→MediaChannel | |
| 시작일 | `startDate` | date | |
| 종료일 | `endDate` | date | |
| 상태 | `status` | enum | `집행예정` `집행중` `일시중지` `종료` |
| 목표 | `objective` | enum | `인지` `유입` `전환` `재구매` |
| 예산 | `budget` | int | 계획 집행액 |
| 소진액 | `spend` | int | 실집행액 |
| 노출수 | `impressions` | int | |
| 클릭수 | `clicks` | int | |
| 전환수 | `conversions` | int | |
| 전환매출 | `revenue` | int | ROAS 분자 |

**관계**: Campaign N:1 Account · N:1 Contract · N:1 MediaChannel · 1:N Ticket

**파생 지표**: `CTR = clicks/impressions×100` · `CPC = spend/clicks` · `CPM = spend/impressions×1000` · `CVR = conversions/clicks×100` · `CPA = spend/conversions` · `ROAS = revenue/spend×100` · `소진율 = spend/budget×100` · `페이싱 = 소진율 ÷ 기간경과율`

### 3.13 Activity — 활동(Task/Event)

컬렉션: `activities`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 활동 ID | `id` | string(PK) | `ac001` |
| 유형 | `type` | enum | `call`(전화) `meeting`(미팅) `email`(이메일) `task`(할 일) `pt`(제안·PT) `report`(결과보고) |
| 제목 | `subject` | string | |
| 관련 객체 타입 | `relatedType` | enum | `account` `contact` `lead` `opportunity` `ticket` `campaign` |
| 관련 객체 ID | `relatedId` | string(polymorphic FK) | 활동 타임라인의 핵심 |
| 담당자 | `ownerId` | FK→User | |
| 기한 | `dueDate` | date | |
| 완료일시 | `doneAt` | datetime \| null | |
| 상태 | `status` | enum | `예정` `진행중` `완료` `취소` |
| 우선순위 | `priority` | enum | `높음` `보통` `낮음` |
| 시작일시 | `startAt` | datetime \| null | Event만 |
| 종료일시 | `endAt` | datetime \| null | Event만 |
| 장소 | `location` | string \| null | Event만 |
| 참석자 | `attendeeIds` | FK→(User\|Contact)[] | Event만 |
| 내용 | `note` | text | |

**관계**: Activity N:1 (다형성) Account/Contact/Lead/Opportunity/Ticket/Campaign · N:1 User

**규칙**: 활동 저장 시 관련 Account/Contact의 `lastActivityDate`를 자동 갱신합니다. 이것이 "접촉 공백" 인사이트의 데이터 원천입니다.

### 3.14 Ticket — 제작 의뢰

컬렉션: `tickets`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 티켓 ID | `id` | string(PK) | `tk01` |
| 티켓 번호 | `key` | string | `PRD-101` 사람이 부르는 번호 |
| 유형 | `type` | enum | `영상제작` `광고기획` `디자인` `랜딩페이지` `카피` `성과분석` |
| 제목 | `title` | string | |
| 요청 내용 | `description` | text | 유형별 템플릿으로 프리필 |
| 의뢰자 | `requesterId` | FK→User | Jira의 Reporter |
| 담당자 | `assigneeId` | FK→User \| null | null이면 큐 대기 상태 |
| 큐(팀) | `queueTeamId` | FK→Team \| null | 미배정 시 소유 큐 |
| 광고주 | `accountId` | FK→Account \| null | |
| 영업기회 | `oppId` | FK→Opportunity \| null | |
| 캠페인 | `campaignId` | FK→Campaign \| null | |
| 상태 | `status` | enum | §8의 9개 상태 |
| 우선순위 | `priority` | enum | `P1`(긴급) `P2`(높음) `P3`(보통) `P4`(낮음) |
| 예상 공수 | `estimateHours` | int | |
| 실투입 공수 | `spentHours` | int | 타임시트 롤업 |
| 마감일 | `dueDate` | date | |
| 등록일시 | `createdAt` | datetime | SLA 기산점 |
| 착수일시 | `startedAt` | datetime \| null | |
| 완료일시 | `doneAt` | datetime \| null | |
| 재작업 횟수 | `reworkCount` | int | `수정요청` 전이 시 +1 |
| 무상 수정 한도 | `freeReworkLimit` | int | 기본 2. 초과 시 추가비용 승인 필요 |
| 라벨 | `labels` | string[] | `["재작업","긴급"]` |
| 워처 | `watchers` | FK→User[] | 알림 수신자. 영업기회 팀이 기본 |
| 상위 티켓 | `parentId` | FK→Ticket \| null | 하위 작업 분해 |
| 목적 | `purpose` | enum | `제안용` `집행용` `리뉴얼` — 제안용은 미청구 원가 |
| 유형별 상세 | `typeFields` | object | §8.2의 타입별 필수 항목 |
| 산출물 링크 | `deliverables` | object[] | `{name, url, version, approved}` |
| 보류 사유 | `holdReason` | string \| null | `보류` 전이 시 필수 |

**관계**: Ticket N:1 Account/Opportunity/Campaign · N:1 User(requester/assignee) · 1:N TicketComment · 1:N TicketHistory · 1:N ResourceRequest · 1:N Assignment · 1:N Timesheet · 자기참조 `parentId`

### 3.15 TicketComment — 티켓 코멘트

컬렉션: `ticketComments`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 코멘트 ID | `id` | string(PK) | `tc001` |
| 티켓 | `ticketId` | FK→Ticket | M-D |
| 작성자 | `authorId` | FK→User | |
| 내용 | `body` | text | @멘션 파싱 대상 |
| 작성일시 | `createdAt` | datetime | |
| 내부 전용 | `isInternal` | bool | true면 광고주 공유 리포트에서 제외 |
| 멘션 | `mentions` | FK→User[] | 알림 발송 대상, 자동 워처 등록 |
| 첨부 | `attachments` | object[] | `{name, size, url}` |

### 3.16 TicketHistory — 티켓 변경 이력

컬렉션: `ticketHistory`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 이력 ID | `id` | string(PK) | `th001` |
| 티켓 | `ticketId` | FK→Ticket | |
| 변경일시 | `at` | datetime | |
| 변경자 | `actorId` | FK→User | |
| 필드 | `field` | string | `status` `assigneeId` `dueDate` `priority` |
| 이전 값 | `from` | string | |
| 이후 값 | `to` | string | |

**규칙**: **추가 전용(append-only)**. 수정·삭제 불가. 상태 체류시간과 리드타임 분석의 유일한 원천입니다.

### 3.17 ResourceRequest — 공수 신청

컬렉션: `resourceRequests`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 신청 ID | `id` | string(PK) | `rr01` |
| 연결 티켓 | `ticketId` | FK→Ticket | |
| 신청자 | `requesterId` | FK→User | |
| 요청 직무 | `roleNeeded` | enum | §3.2 `craft` 값 집합 |
| 요청 공수 | `hours` | int | 총 요청 시간 |
| 일일 투입 | `hoursPerDay` | number | 기본 `hours / 영업일수` |
| 시작 희망일 | `startDate` | date | |
| 종료 희망일 | `endDate` | date | |
| 상태 | `status` | enum | `대기` `가배정` `승인` `반려` `배정완료` `취소` |
| 승인자 | `approverId` | FK→User \| null | 리소스 매니저 |
| 가배정 인력 | `heldResourceId` | FK→User \| null | 소프트 예약. 히트맵에 수요로 표시 |
| 가배정 만료일 | `holdExpiresAt` | date \| null | 기본 7일 |
| 신청일시 | `createdAt` | datetime | |
| 결정일시 | `decidedAt` | datetime \| null | |
| 신청 사유 | `reason` | text | 신청자 작성 |
| 처리 의견 | `note` | text | 승인/반려 사유. **반려 시 필수** |
| 필요 스킬 | `skills` | string[] | 매칭 점수 계산에 사용 |

**관계**: ResourceRequest N:1 Ticket · N:1 User(requester/approver) · 1:N Assignment

### 3.18 Assignment — 투입 배정

컬렉션: `assignments`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 배정 ID | `id` | string(PK) | `as01` |
| 공수 신청 | `requestId` | FK→ResourceRequest | |
| 티켓 | `ticketId` | FK→Ticket | |
| 투입 인력 | `resourceId` | FK→User | |
| 배정 공수 | `hours` | int | |
| 시작일 | `startDate` | date | |
| 종료일 | `endDate` | date | |
| 상태 | `status` | enum | `예정` `진행중` `완료` `취소` |
| 청구 가능 | `billable` | bool | 제안용 티켓은 false |
| 일별 배분 | `dailyHours` | object | `{"2026-08-15": 4, ...}` 히트맵 셀의 원천 |
| 잠금 | `locked` | bool | true면 자동 재배분 대상 제외 |

**관계**: Assignment N:1 ResourceRequest · N:1 Ticket · N:1 User · 1:N Timesheet

### 3.19 Timesheet — 타임시트(작업 시간 기록)

컬렉션: `timesheets`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 기록 ID | `id` | string(PK) | `ts001` |
| 투입 인력 | `resourceId` | FK→User | |
| 티켓 | `ticketId` | FK→Ticket | |
| 배정 | `assignmentId` | FK→Assignment \| null | |
| 작업일 | `date` | date | |
| 시간 | `hours` | number | 0.5 단위 |
| 청구 가능 | `billable` | bool | 가동률 분자 구성 |
| 상태 | `status` | enum | `임시저장` `제출` `승인` `반려` |
| 승인자 | `approverId` | FK→User \| null | |
| 비고 | `note` | text | |

**규칙**: 주 단위(월~일) 그리드로 입력. 제출 후 잠금. 승인된 기록만 `Ticket.spentHours`와 가동률에 반영.

### 3.20 Target — 목표(쿼터)

컬렉션: `targets`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 목표 ID | `id` | string(PK) | `tg001` |
| 대상자 | `ownerId` | FK→User | |
| 대상 팀 | `teamId` | FK→Team \| null | 팀 목표일 때 |
| 기간 | `period` | string | `2026-08`(월) 또는 `2026-Q3`(분기) |
| 유형 | `type` | enum | `매출`(취급고) `순매출` `신규광고주수` `활동건수` |
| 목표값 | `amount` | int | 금액 또는 건수 |
| 설정자 | `setById` | FK→User | 영업관리자/관리자 |
| 잠금 | `locked` | bool | 기간 마감 후 true |

**규칙**: 관리자 목표 = 본인 + 팀원 합산이 아니라 **별도 값**입니다(Salesforce와 동일). 팀 합계와 팀장 목표의 차이는 화면에 갭으로 표시합니다.

### 3.21 Actual — 실적(직접 입력)

컬렉션: `actuals`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 실적 ID | `id` | string(PK) | `at001` |
| 입력자 | `ownerId` | FK→User | |
| 기간 | `period` | string | `2026-04` |
| 광고주 | `accountId` | FK→Account | |
| 영업기회 | `oppId` | FK→Opportunity \| null | |
| 취급고 | `amount` | int | 총 집행액 |
| 순매출 | `netRevenue` | int | 대행 수수료 + 제작 마진 |
| 구분 | `kind` | enum | `신규 수주` `기존 확대` `갱신` `추가 집행` |
| 상태 | `status` | enum | `임시저장` `제출` `확정` `반려` |
| 입력일시 | `enteredAt` | datetime | |
| 확정자 | `approvedById` | FK→User \| null | 영업관리자 |
| 비고 | `note` | text | |

**규칙**: `임시저장`은 본인만 보임. `제출` 후 관리자가 `확정`해야 팀 실적에 집계. 반려 시 사유 필수. **요구사항 #1의 핵심 엔티티**입니다.

### 3.22 Note — 메모

컬렉션: `notes`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 메모 ID | `id` | string(PK) | `nt01` |
| 관련 타입 | `relatedType` | enum | `account` `contact` `opportunity` `ticket` `lead` |
| 관련 ID | `relatedId` | string | 다형성 FK |
| 작성자 | `authorId` | FK→User | |
| 내용 | `body` | text | |
| 작성일시 | `createdAt` | datetime | |
| 고정 | `pinned` | bool | 상단 고정 |

### 3.23 Approval — 승인(결재)

컬렉션: `approvals`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 승인 ID | `id` | string(PK) | `ap01` |
| 대상 객체 타입 | `objectType` | enum | `quotes` `opportunities` `resourceRequests` `contracts` `tickets` |
| 대상 객체 ID | `objectId` | string | 다형성 FK |
| 관련 영업기회 | `oppId` | FK→Opportunity \| null | 화면 연결용 |
| 종류 | `kind` | enum | `할인 승인` `공수 승인` `계약 승인` `추가비용 승인` `마진 예외` |
| 단계 | `step` | string | `1차 (팀장)` `2차 (본부장)` `3차 (대표)` |
| 단계 순번 | `stepNo` | int | 1,2,3 |
| 상신자 | `requesterId` | FK→User | |
| 결재자 | `approverId` | FK→User | |
| 상태 | `status` | enum | `대기` `승인` `반려` `회수` |
| 상신일시 | `submittedAt` | datetime | |
| 처리일시 | `decidedAt` | datetime \| null | |
| 결재 의견 | `comment` | text | **반려 시 필수** |
| 상세 | `detail` | string | `할인율 28% · 견적 Q-2026-102 · 금액 375,576,000원` |

**규칙**: 상신 시 대상 레코드 **잠금**(`lockedByApprovalId`). 결재자 또는 관리자만 편집 가능. 회수(recall)는 상신자만. 순차 결재: 1차 승인 후에야 2차 대기 행이 생성됩니다.

### 3.24 Notification — 알림

컬렉션: `notifications`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 알림 ID | `id` | string(PK) | `nf01` |
| 수신자 | `userId` | FK→User | |
| 종류 | `kind` | enum | `승인` `배정` `멘션` `SLA` `상태변경` `마감임박` `실적` |
| 본문 | `text` | string | 한 문장. 누가·무엇을 |
| 링크 | `link` | string | 대상 화면 URL(`tickets.html?id=tk01`) |
| 발생일시 | `at` | datetime | |
| 읽음 | `read` | bool | |
| 중요도 | `severity` | enum | `info` `warn` `critical` |

### 3.25 AuditLog — 감사 로그

컬렉션: `auditLogs`

| 한글 라벨 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 로그 ID | `id` | string(PK) | `al011` |
| 발생일시 | `at` | datetime | |
| 행위자 | `actorId` | FK→User | |
| 행위 | `action` | enum | `생성` `변경` `삭제` `승인` `반려` `로그인` `내보내기` |
| 객체 타입 | `objectType` | string | 컬렉션명 |
| 객체 ID | `objectId` | string | |
| 상세 | `detail` | string | `stage: 견적·협상 → 계약체결` |
| IP | `ip` | string \| null | 데모에서는 null |

**규칙**: **추가 전용**. 편집·삭제 UI를 제공하지 않습니다. 개인정보(연락처) 조회도 별도 로그 항목으로 남깁니다.

### 3.26 보조 마스터

| 컬렉션 | 필드 | 설명 |
|---|---|---|
| `competitors` | `id`, `name`, `note`, `winCount`, `lossCount` | 경쟁 대행사 마스터 |
| `mediaChannels` | `id`, `name`, `group`, `commissionRate`, `settleType` | 매체 마스터. `group`: 검색/디스플레이/동영상/SNS/커머스/제작 |
| `listViews` | `id`, `object`, `name`, `filter`, `columns`, `sort`, `shared`, `ownerId` | 저장된 목록 뷰 |
| `session` | `userId`, `scope`, `theme`, `density` | 현재 로그인 사용자와 화면 설정 |

### 3.27 엔티티 관계도 (텍스트 ERD)

```
Team ──1:N── User ──1:N── Target
                │           └─(period, type)
                ├──1:N── Actual ──N:1── Account
                ├──1:N── Timesheet ──N:1── Assignment
                └──owner──┐
                          │
Lead ──convert──► Account ──1:N── Contact
                    │  │            └──1:N── Activity
                    │  ├──1:N── Opportunity ──1:N── OpportunityLine ──N:1── Product
                    │  │            │                                        └──N:1── PriceBookEntry ──N:1── PriceBook
                    │  │            ├──1:N── Quote ──1:N── QuoteLine
                    │  │            ├──1:1── Contract ──1:N── Campaign ──N:1── MediaChannel
                    │  │            ├──1:N── Activity
                    │  │            ├──1:N── Approval
                    │  │            └──1:N── Ticket
                    │  ├──1:N── Note
                    │  └──parentId──► Account (계열사)
                    │
                 Ticket ──1:N── TicketComment
                    │  ├──1:N── TicketHistory (append-only)
                    │  ├──1:N── ResourceRequest ──1:N── Assignment ──1:N── Timesheet
                    │  └──parentId──► Ticket (하위작업)

Approval ──polymorphic──► Quote | Opportunity | ResourceRequest | Contract
Notification ──N:1── User
AuditLog ──polymorphic──► (모든 객체)
```

---

## 4. 파이프라인 정의

Salesforce의 **Sales Process + Path**를 그대로 재현합니다. 단계는 `domain.js`의 `D.STAGES` 테이블이며, 화면은 단계명을 하드코딩하지 않습니다.

### 4.1 단계 마스터

| # | 단계 | 확률 | 예측 카테고리 | 진입 조건 | 종료 조건(Exit) | 이 단계 필수 필드 | 허용 체류일 |
|---|---|---:|---|---|---|---|---:|
| 1 | **리드확보** | 10% | Pipeline | 리드 전환 또는 직접 생성 | 의사결정 라인과 예산 규모를 파악했다 | `accountId`, `ownerId` | 14 |
| 2 | **니즈파악** | 20% | Pipeline | 광고주 담당자와 1회 이상 접촉 완료 | KPI와 예산 범위가 문서로 확인됐다 | `closeDate`, `amount` | 14 |
| 3 | **제안준비** | 35% | Pipeline | 브리프(요구사항) 수령 | 미디어플랜 초안과 제작 리소스 확보 계획이 있다 | `contactId` | 10 |
| 4 | **제안·PT** | 50% | Best Case | 제안서/미디어플랜 v1 존재 | 제안 발표를 마치고 광고주 피드백을 받았다 | `nextStep` | 12 |
| 5 | **견적·협상** | 70% | Best Case | 견적 1건 이상 발행 | 합의된 금액의 견적 버전이 존재한다 | `amount`, `closeDate` | 14 |
| 6 | **내부승인** | 85% | Commit | 할인율·수수료율 확정 | 할인 승인 및 계약서 검토가 끝났다 | (할인 승인 완료) | 7 |
| 7 | **계약체결** | 100% | Closed (Won) | 계약서 날인 | 계약 레코드가 생성됐다 | `amount`, `closeDate` | — |
| 8 | **실주** | 0% | Omitted (Lost) | 광고주 거절 또는 자연 소멸 | 실주 사유와 경쟁사가 기록됐다 | `lossReason` | — |

### 4.2 단계 전이 규칙

- **전진**: 인접 단계로만 이동 가능. `계약체결`/`실주`는 어느 단계에서든 직행 가능.
- **후진**: 허용하되 사유를 `AuditLog`에 남기고 `stageEnteredAt`을 갱신합니다.
- **필수 필드 게이트**: 다음 단계로 이동할 때, **이동하려는 단계의 `requires` 필드가 비어 있으면 전이 모달을 띄웁니다.** 모달에서 채우지 않으면 저장되지 않습니다. 검증 실패 후 되돌리지 말고, 애초에 모달로 받습니다.
- **자동 세팅**: 단계 변경 시 `probability`와 `forecastCategory`를 단계 마스터 값으로 덮어씁니다. 사용자가 직접 수정하면 그 이후로는 동기화하지 않습니다(override 플래그).
- **`실주` 전이 모달**: `lossReason` 필수 + `competitorId`(경쟁사 선정일 때 필수) + 자유 기술. 취소하면 단계는 원복됩니다.
- **`계약체결` 전이 모달**: `amount` 확인 + 계약 시작일/기간 입력 → Contract 자동 생성 → `needsProduction` 라인만큼 Ticket 자동 생성 제안(체크박스 목록).
- **정체 판정**: `daysInStage > 허용 체류일` 이면 정체. 칸반 카드와 목록에 ⚠ 배지.
- **마감일 경과**: `isOpen && closeDate < 오늘` 이면 경과. 별도 빨강 배지 + 인사이트 발화.

### 4.3 실주 사유 마스터

`예산 삭감` · `경쟁사 선정` · `내부 대행 전환` · `집행 시기 연기` · `단가 미합의` · `담당자 교체` · `기타`

### 4.4 예측 카테고리 롤업

| 컬럼 | 정의 |
|---|---|
| **Closed** | 수주 확정 금액 합계 |
| **Commit** | `Commit` + `Closed` |
| **Best Case** | `Best Case` + `Commit` + `Closed` |
| **Pipeline(전체 오픈)** | `Pipeline` + `Best Case` + `Commit` |
| **가중 예측** | `Closed` + `Σ(오픈 금액 × 확률)` |
| **Omitted** | 모든 합계에서 **제외** |

### 4.5 Path 컴포넌트 사양

- 8개 셰브론을 `order` 순으로 가로 배치. 완료=채움, 현재=강조+링, 미래=흐림, 수주=긍정색, 실주=부정색.
- 셰브론 클릭 → 하단 코치 패널 확장. 좌: 이 단계의 `requires` 필드를 **인라인 편집 가능한 미니 폼**으로, 우: `guide` 안내문 + `exit` 종료 조건.
- 우측 끝 주 버튼: `다음 단계로` (마지막 오픈 단계에서는 `마감 처리`, 모달로 수주/실주 선택).
- 코치 패널 열림 상태는 사용자별로 기억합니다.

---

## 5. 화면 목록 (IA)

**라우팅 규약**: 화면 1개 = `app/` 아래 HTML 파일 1개. 상세 화면은 별도 파일을 만들지 않고 목록 파일에 `?id=` 쿼리로 진입해 **분할 뷰(Split View)**로 렌더합니다(Salesforce Split View 패턴). 예: `opportunities.html?id=o01`.

**앱 셸(모든 화면 공통)**
- 고정 상단 헤더: 앱 런처(◈) · 제품명 CLOSER · 전역 검색(⌘K) · 스코프 선택기(내 것/우리 팀/전사) · 알림 벨(미읽음 배지) · 사용자 아바타(역할 전환)
- 좌측 앱 레일: 5개 그룹 21개 항목(아래 표). 접기/펴기 상태 기억.
- 본문: 페이지 헤더(하이라이트 패널) + 콘텐츠
- 토스트 영역(상단 중앙) · 커맨드 팔레트(⌘K) · 모달 루트

### 5.1 화면 카탈로그

| # | 그룹 | 화면 | 파일 | 무엇이 있나 | 충족 요구사항 |
|---:|---|---|---|---|---|
| 1 | 영업 | **홈** | `dashboard.html` | 역할별 KPI 타일 6, 목표 게이지, 오늘/기한초과 할 일, 위험 딜, 인사이트 카드 3, 내 제작 의뢰 | #1 #3 #5 |
| 2 | 영업 | **파이프라인** | `pipeline.html` | 8단계 칸반(드래그 전이), 단계별 합계, 정체/경과 배지, 퍼널·병목 차트 | #5 |
| 3 | 영업 | **영업기회** | `opportunities.html` | 목록/분할뷰, 저장된 뷰, 인라인 편집, 대량 작업 · `?id=` 상세(Path·품목·견적·티켓·활동) | #5 #1 |
| 4 | 영업 | **광고주** | `accounts.html` | 목록 + `?id=` 360 상세(건강도·집행이력·계약·티켓·활동·메모) | #2 |
| 5 | 영업 | **담당자** | `contacts.html` | 담당자 목록, 의사결정 역할 필터, 접촉 공백 정렬 | #2 |
| 6 | 영업 | **리드** | `leads.html` | 리드 목록/칸반, 점수 정렬, **리드 전환 마법사** | #2 #5 |
| 7 | 실적·분석 | **내 실적** | `performance.html` | 목표 대비 달성 게이지, 월별 추이, **실적 직접 입력 폼**, 제출/확정 상태 | **#1** |
| 8 | 실적·분석 | **매출 예측** | `forecast.html` | 사용자×카테고리 예측 그리드, 누적 롤업, 조정, 기여 딜 드릴다운 | #1 #5 |
| 9 | 실적·분석 | **리포트** | `reports.html` | 리포트 빌더(그룹핑·집계·필터), 차트, CSV 내보내기 | #3 |
| 10 | 실적·분석 | **인사이트** | `insights.html` | 규칙 기반 **한국어 분석 의견 피드**, 근거·추천 액션, 심각도 필터 | **#3** |
| 11 | 거래 | **견적** | `quotes.html` | 견적 목록 + `?id=` 견적 편집기(품목 그리드, 할인, 승인 상신, 미리보기) | #5 |
| 12 | 거래 | **계약** | `contracts.html` | 계약 목록, 갱신 임박 캘린더, 상태 전이 | #5 |
| 13 | 거래 | **캠페인** | `campaigns.html` | 집행 캠페인 목록, 소진율/페이싱, 성과 지표, 캠페인 상세 | #2 #3 |
| 14 | 거래 | **광고상품** | `products.html` | 상품 마스터 + **단가표(PriceBook) 탭**, 수수료율 관리 | #5 |
| 15 | 제작·리소스 | **제작 의뢰** | `tickets.html` | 보드/목록 토글, 스윔레인, SLA 배지 · `?id=` 티켓 상세(전이 버튼·코멘트·이력·산출물) | **#6** |
| 16 | 제작·리소스 | **공수 관리** | `resources.html` | 경보 카드, 인력×주 가동률 히트맵, 공수 신청 큐, 승인/반려, 후보 추천 | **#4** |
| 17 | 제작·리소스 | **타임시트** | `timesheet.html` | 주간 그리드(월~일), 배정별 행, 제출/승인 | #4 |
| 18 | 공통 | **활동** | `activities.html` | 할 일/일정 통합 목록, 오늘/기한초과/예정, 캘린더 뷰 | #2 |
| 19 | 공통 | **승인함** | `approvals.html` | 미결/기결/상신 탭, 일괄 승인, 반려 사유 모달 | #5 #4 |
| 20 | 공통 | **설정·관리** | `admin.html` | 사용자·팀·목표·권한 매트릭스·감사 로그·데이터 리셋 | 관리 |
| 21 | 공통 | **디자인 시스템** | `design.html` | 토큰·컴포넌트 카탈로그(개발 참조용) | 개발 |

### 5.2 화면 간 이동 경로(주요 동선)

```
홈 ──위험 딜 클릭──► 영업기회 상세 ──[제작 의뢰]──► 티켓 생성 모달 ──► 티켓 상세
 │                        │                                              │
 │                        ├──[견적 생성]──► 견적 편집기 ──[승인 상신]──► 승인함
 │                        │                                              │
 │                        └──[단계 변경: 계약체결]──► 계약 생성 ──► 캠페인 생성
 │                                                              └──► 티켓 자동 생성
 ├──목표 게이지 클릭──► 내 실적 ──[실적 입력]──► 관리자 확정
 ├──인사이트 카드 [조치] ──► 해당 레코드 목록(필터 적용됨)
 └──알림 벨 ──► 대상 화면

티켓 상세 ──[공수 신청]──► 공수 관리 큐 ──[승인]──► 배정 ──► 타임시트 ──► 가동률
```

---

## 6. 화면별 상세

각 화면은 동일한 해부학을 따릅니다: **① 페이지 헤더(하이라이트) → ② 필터/뷰 바 → ③ 본문(탭 또는 그리드) → ④ 관련 목록/사이드 패널**.

공통 빈 상태 규칙: **절대 빈 화면을 내보내지 않습니다.** 아이콘 + 왜 비어 있는지 + 다음 행동 버튼 1개를 항상 넣습니다. 권한이 없어서 비었으면 "권한이 없습니다"라고 명시합니다.

---

### 6.1 홈 — `dashboard.html`

**요구사항**: #1(실적 모니터링) #3(인사이트) #5(파이프라인)

**레이아웃**
- **헤더**: `{사용자명}님의 오늘` + 오늘 날짜 + 스코프 배지(내 것/우리 팀/전사) + `기간 선택기`(이번 달/이번 분기/올해)
- **KPI 타일 6개**(가로 스크롤 없이 3×2 그리드):
  1. 이번 분기 수주 — 금액 + 전분기 대비 델타 화살표
  2. 목표 달성률 — % + 진척 바(회색0/빨강1-33/주황34-66/초록67+)
  3. 파이프라인 — 오픈 금액 + 건수
  4. 파이프라인 커버리지 — `n.n배` + 3배 기준 마커
  5. 성사율 — % + 건수 기준/금액 기준 토글
  6. 평균 영업 사이클 — 일수 + 전분기 대비
- **좌측 주 컬럼(2/3)**
  - `목표 대비 진척` 카드: 반원 게이지 + 잔여 금액 + 남은 영업일 + "하루 평균 얼마 필요" 문장
  - `오늘 할 일` 카드: 기한초과(빨강) → 오늘 → 이번 주 순. 각 행 클릭 시 관련 레코드로. 인라인 `완료` 체크
  - `주의가 필요한 딜` 테이블: 정체·마감경과·무활동 딜 상위 8건. 컬럼: 기회명 / 광고주 / 단계 / 금액 / 위험 사유 배지 / 마감일
- **우측 사이드(1/3)**
  - `인사이트` 카드 3장 (§7.8 규칙 상위 3개). 각 카드: 심각도 좌측 컬러 바 + 한 줄 헤드라인 + 근거 1줄 + `조치` 버튼
  - `내 제작 의뢰` 리스트: 진행 중 티켓 5건. 상태 칩 + SLA D-day
  - `최근 항목` 리스트

**역할별 변형**
- 영업관리자/관리자: KPI 타일이 팀 합계로, 좌측에 `팀원 리더보드` 테이블(이름·목표·달성·달성률 바·진행 딜) 추가, `승인 대기` 큐 카드 추가.
- 제작인력: 대시보드 대신 `tickets.html`로 리다이렉트(홈 버튼은 티켓 보드).
- 리소스매니저: `resources.html`로 리다이렉트.

**인터랙션**
- KPI 타일 클릭 → 해당 상세 화면으로 스코프·기간 필터를 물고 이동.
- 기간 선택기 변경 → 전 타일·차트 동시 재계산(로컬, 즉시).
- 할 일 체크 → 낙관적 UI + 토스트 `할 일을 완료했습니다` + 실패 시 롤백.

**빈 상태**
- 딜 없음: "아직 영업기회가 없습니다. 리드를 전환하거나 새 영업기회를 만들어 파이프라인을 시작하세요." + `[새 영업기회]`
- 할 일 없음: "오늘 예정된 할 일이 없습니다. 접촉이 뜸한 광고주 3곳을 확인해 보세요." + `[광고주 보기]`
- 목표 미설정: "이번 분기 목표가 설정되지 않았습니다. 관리자에게 목표 배정을 요청하세요."

---

### 6.2 파이프라인 — `pipeline.html`

**요구사항**: #5 (최초 영업~계약 단계별 flow)

**레이아웃**
- **헤더**: `파이프라인` + 총 오픈 금액 + 건수 + 가중 예측 + 스코프/기간/담당자 필터 칩
- **뷰 토글**: `칸반` / `퍼널` / `목록`
- **칸반 본문**: 8개 컬럼(실주는 기본 숨김, 토글로 표시)
  - 컬럼 헤더: 단계명 · 건수 · 합계 금액 · 확률 배지
  - 카드: 기회명(굵게) / 광고주 / 금액 / 마감일 D-day / 담당자 아바타 / 위험 아이콘(정체·경과·무활동·티켓지연)
  - 드래그 앤 드롭으로 단계 전이 → **전이 모달**(§4.2)이 필수 필드를 요구
- **퍼널 뷰**: 단계별 통과 건수 막대 + 단계 간 전환율 % + 평균 체류일. 전환율이 가장 낮은 구간에 `병목` 라벨
- **하단 인사이트 스트립**: 파이프라인 관련 인사이트 문장 2~3개

**인터랙션**
- 드래그 실패(권한 없음/필수 필드 미입력) 시 카드는 원위치로 스냅되고 에러 토스트에 **구체적 사유**를 표시.
- 컬럼 헤더 `합계` 클릭 → 취급고 / 순매출 / 가중 토글.
- 카드 우클릭(또는 ⋯) → `단계 변경` `담당자 변경` `활동 기록` `제작 의뢰` 빠른 메뉴.

**빈 상태**: 단계별 빈 컬럼에는 흐린 점선 박스 + `여기로 딜을 끌어오세요`. 전체가 비면 홈과 동일한 CTA.

---

### 6.3 영업기회 — `opportunities.html` / `?id=`

**목록 모드**
- 헤더: 뷰 선택 드롭다운(`내 진행 딜`, `이번 분기 마감`, `정체 딜`, `고액 딜`, `전체`) + 핀 + 검색 + `[새 영업기회]`
- 툴바: 필터 패널 토글 · 컬럼 선택 · 밀도 토글 · CSV 내보내기 · 뷰 저장
- 테이블: 체크박스 / 기회명 / 광고주 / 단계(칩) / 금액 / 순매출 / 확률 / 마감일 / 담당자 / 위험 배지. 정렬·리사이즈·인라인 편집(연필) 지원, 편집 시 하단 일괄 저장 바.
- 선택 시 대량 작업 바: `담당자 변경` `단계 변경` `삭제` `CSV 내보내기`

**상세 모드(`?id=o01`) — 분할 뷰**
- 좌측 레일: 현재 목록의 압축 행(기회명·금액·단계 칩). 키보드 ↑↓로 이동.
- 우측 레코드:
  - **하이라이트 패널**: 아이콘 + 기회명(H1) + 광고주 / 단계 / 금액 / 순매출 / 마감일 / 담당자 7필드 + 액션 바 `[편집] [견적 생성] [제작 의뢰] [활동 기록] [⋯]`
  - **Path 셰브론**(§4.5) + 코치 패널
  - **탭**: `상세` `상품(품목)` `견적` `제작 의뢰` `활동` `승인` `메모`
    - 상세: 2컬럼 섹션 그리드(기본정보 / 금액·예측 / 관계 / 시스템). 인라인 편집.
    - 상품: 품목 그리드(상품·수량·단가·할인·개월·금액·수수료). `[상품 추가]` → 단가표 선택 → 다중 선택 → 편집 그리드 3스텝 마법사. 하단 합계 바(취급고/순매출/평균 할인율).
    - 견적: 버전 목록(번호·버전·상태·금액·유효기간) + `[새 견적]`
    - 제작 의뢰: 연결 티켓 카드. 상태·담당자·마감일·SLA. `[제작 의뢰]`로 신규.
    - 활동: 작성기 탭(할 일/통화/미팅/이메일) + 타임라인(예정·지난)
    - 승인: 승인 이력 테이블(단계/결재자/결과/일시/의견) + 상태 배너
- **우측 사이드**: 광고주 요약 카드(건강도·최근 집행·미수), 경쟁 상황, 관련 목록 바로가기 칩

**빈 상태**: 품목 없음 → "품목을 추가하면 금액이 자동 계산되고 수주 시 제작 의뢰가 자동 생성됩니다." + `[상품 추가]`

---

### 6.4 광고주 — `accounts.html` / `?id=`

**요구사항**: #2 (고객사 관리)

**목록**: 뷰(`내 광고주` `Key 등급` `휴면 광고주` `이탈 위험` `전체`) · 테이블(광고주명/업종/등급/담당AE/누적 취급고/진행 딜/최근 접촉/건강도 바)

**상세 — 광고주 360**
- **하이라이트**: 광고주명 + 업종·등급·담당AE·누적 취급고·누적 순매출·최근 접촉일·건강도(0-100 링) + `[편집] [영업기회 생성] [활동 기록] [제작 의뢰] [⋯]`
- **건강도 카드**: 점수 링 + **이유 목록**(`45일간 접촉 없음`, `집행 중 캠페인 2건`, `SLA 초과 제작 건 1건`) — 점수만 보여주지 않습니다.
- **탭**
  - `개요`: 기본정보 · 사업자정보(마스킹) · 계약 조건 · 담당자 배정
  - `영업기회`: 진행/종료 분리 테이블 + 승률
  - `캠페인`: 집행 이력 테이블(기간·매체·예산·소진율·ROAS) + 월별 집행액 막대 차트
  - `계약`: 계약 목록 + 갱신 D-day
  - `담당자`: 담당자 카드 그리드(의사결정 역할 배지). 연락처는 기본 마스킹, `표시` 클릭 시 감사 로그 기록.
  - `제작 의뢰`: 진행 중 / 완료 두 카드로 분리(동적 관련 목록)
  - `활동`: 타임라인
  - `메모`: 고정 메모 + 목록
- **우측**: 계열사 계층 트리(`parentId`), 최근 인사이트, 파일

**빈 상태**: 캠페인 없음 → "집행 이력이 없습니다. 계약을 유효로 전환하면 캠페인이 자동 생성됩니다."

---

### 6.5 담당자 — `contacts.html`

- 목록: 성명/광고주/직함/의사결정 역할/최근 접촉/담당AE
- 필터: 의사결정 역할, 접촉 공백(30일+), 대표 담당자만
- 행 hover 시 미리보기 카드(요약 레이아웃 필드 5개 + `활동 기록` 버튼)
- 연락처 컬럼은 **항상 마스킹**. 개별 `표시` 토글은 감사 로그를 남깁니다.
- 빈 상태: "이 광고주에 등록된 담당자가 없습니다. 의사결정자를 먼저 등록하세요." + `[담당자 추가]`

---

### 6.6 리드 — `leads.html`

- 뷰 토글: `목록` / `칸반(상태별)`
- 목록 컬럼: 성명/회사/유입경로/상태 칩/점수 바/예상 예산/담당/등록 후 경과일
- **리드 전환 마법사**(3열 카드 모달):
  1. **광고주**: `새로 생성`(회사명 프리필) / `기존 선택`(사업자번호·상호 유사도 매칭 제안 표시)
  2. **담당자**: `새로 생성` / `기존 선택`
  3. **영업기회**: `새로 생성`(기회명 = `{회사} · {업종} 캠페인`) / `생성 안 함` 체크박스
  - 하단: 소유자 · 전환 상태 · `후속 할 일 생성`(기본 체크, 제목 "제안서 작성")
  - `[전환]` → 트랜잭션 1건 → 성공 모달에 생성된 3개 레코드 링크
- 중복 경고: 동일 `bizNo` 발견 시 **차단**, 상호 유사 시 **경고 배너 + 비교 보기**
- 빈 상태: "신규 리드가 없습니다. 인바운드 문의를 등록하거나 리드를 가져오세요."

---

### 6.7 내 실적 — `performance.html`  ★요구사항 #1의 주 화면

**레이아웃**
- **헤더**: `{사용자}님의 실적` + 기간 선택(월/분기) + 대상자 선택(관리자는 팀원 선택 가능)
- **상단 KPI**: 목표 / 확정 실적 / 달성률 / 잔여 / 남은 영업일 / 일평균 필요액
- **게이지 카드**: 반원 게이지(목표 대비 달성률) + 색 밴드(0 회색, 1-33 빨강, 34-66 주황, 67+ 초록) + 페이스 마커("오늘 기준 68%여야 정상")
- **월별 추이 차트**: 목표(선) vs 확정 실적(막대) vs 파이프라인 가중(옅은 막대) 12개월
- **구성 분석**: 신규/기존/갱신 비중 도넛 + 광고주별 상위 5 막대
- **실적 입력 섹션** ★
  - `[실적 입력]` 버튼 → 모달: 기간(월) · 광고주 · 연결 영업기회(선택) · 취급고 · 순매출 · 구분(신규 수주/기존 확대/갱신/추가 집행) · 비고
  - 목록 테이블: 기간 / 광고주 / 취급고 / 순매출 / 구분 / 상태 칩(임시저장·제출·확정·반려) / 입력일 / 액션
  - 인라인 편집은 `임시저장`·`반려` 상태에서만. `제출` 후에는 잠금, `회수` 버튼 제공.
  - 일괄 `[선택 항목 제출]`
  - 관리자 뷰에서는 `[확정]` `[반려(사유 필수)]` 버튼 노출
- **하단 인사이트**: 실적 관련 문장(목표 페이스, 미제출, 구성 편중)

**검증 규칙**
- `순매출 > 취급고` → 저장 차단, 필드 하단 `순매출은 취급고를 넘을 수 없습니다.`
- 미래 기간 입력 차단.
- 동일 (기간, 광고주, 영업기회) 중복 입력 시 경고 배너 + 기존 행 링크.

**빈 상태**: "이번 달 입력된 실적이 없습니다. 확정된 수주 건을 등록하면 목표 달성률에 즉시 반영됩니다." + `[실적 입력]`

---

### 6.8 매출 예측 — `forecast.html`

- **헤더**: 기간(분기/월) · 예측 유형 토글(`취급고 기준` / `순매출 기준`) · 스코프
- **그리드**: 행 = 사용자 계층(팀장 펼침 → 팀원), 열 = `Pipeline` `Best Case` `Commit` `Closed` `합계` `목표` `달성률`
  - 누적 롤업 모드 토글(단일 카테고리 / 누적)
  - 조정된 셀은 아이콘 + 원본값 툴팁. 관리자만 조정 가능, 조정 시 사유 필수.
  - 셀 클릭 → 하단 패널에 기여 딜 목록(인라인 편집 가능: 금액·마감일·단계)
- **달성률 바**: 색 밴드 동일 규칙
- **하단**: 전주 대비 변동 워터폴(신규 유입 / 상향 / 하향 / 마감 / 실주)
- 빈 상태: "이 기간에 마감 예정인 딜이 없습니다. 마감일을 확인하세요."

---

### 6.9 리포트 — `reports.html`

- 좌측: 저장된 리포트 폴더 트리(`전사 공용` `영업본부` `제작본부` `내 리포트`)
- 중앙: 리포트 빌더 3분할 — 필드 목록 / 아웃라인(행 그룹·열 그룹·컬럼·필터) / 미리보기
  - 그룹핑 최대 행 3 · 열 2. 집계: 합계·평균·최대·최소·건수·고유건수
  - 날짜 그룹 단위: 일/주/월/분기/반기/연
  - 필터: 필드+연산자+값 행 + 필터 논리식(`(1 AND 2) OR 3`)
- 결과: 접을 수 있는 그룹 헤더 + 소계 행 + 하단 고정 총계
- 차트: 막대/가로막대/선/도넛/퍼널 중 선택
- 내보내기: **CSV(UTF-8 BOM)** / 서식 유지 / 상세만. Excel에서 한글이 깨지지 않아야 합니다.
- 기본 제공 리포트 10종: 매체별 취급고 · AE별 목표 대비 실적 · 단계별 전환율 · 실주 사유 분포 · 광고주별 집행 추이 · 제작 유형별 평균 처리일 · SLA 준수율 · 인력별 가동률 · 신규/기존 매출 구성 · 경쟁사별 승패

---

### 6.10 인사이트 — `insights.html`  ★요구사항 #3의 주 화면

- **헤더**: `분석 의견` + 스코프/기간 + 심각도 필터 칩(`위험` `주의` `조치` `양호`) + 카테고리 필터(파이프라인/광고주/제작/리소스/실적)
- **본문**: 인사이트 카드 세로 스택
  - 카드 구조: **좌측 심각도 컬러 바** / 라벨 배지 / **헤드라인 한 문장(굵게)** / 근거 블록(`왜?` — 지표·값·비교·델타 행) / **추천 액션 버튼 1~2개** / 우측 상단 `무시` 메뉴(사유 선택)
  - 액션은 실제로 동작해야 합니다: 필터가 적용된 목록으로 이동하거나, 모달을 엽니다. 토스트만 띄우는 액션은 금지.
- **우측**: 요약 스코어보드(위험 n건 / 주의 n건 / 조치 n건), 지난주 대비 인사이트 증감
- 카드 생성 규칙 35종은 §7.8.
- 빈 상태(=좋은 상태): "지금 조치가 필요한 항목이 없습니다. 파이프라인 커버리지 3.4배, SLA 준수율 96%로 안정적입니다." — 초록 체크 아이콘.

---

### 6.11 견적 — `quotes.html` / `?id=`

- 목록: 견적번호/광고주/영업기회/버전/상태 칩/합계금액/최대 할인율/유효기간/작성자
- **견적 편집기(상세)**
  - 하이라이트: 견적번호 + 광고주·영업기회·상태·합계·유효기간 + `[승인 상신] [PDF 미리보기] [새 버전] [대표 견적 지정]`
  - **품목 그리드**(스프레드시트급): 상품 / 수량 / 개월 / 단가 / 할인율 / 금액 / 수수료율 / 그룹. 탭 이동, 행 추가·복제·삭제, 드래그 정렬, 그룹 소계 행.
  - 하단 고정 합계 바: 공급가액 / 부가세(10%) / **합계금액** / 순매출 / 평균 할인율(임계 초과 시 주황)
  - 우측: 승인 상태 카드(필요 결재선 미리보기 — `할인율 28% → 2차(본부장) 승인 필요`), 거래 조건 텍스트
  - **PDF 미리보기 모달**: 공급자 정보(상호/사업자번호/대표자/주소) · 직인 자리 · 품목표 · 공급가액/부가세/합계 · `단가는 VAT 별도` 문구 · 유효기간
- 상태가 `승인` 이상이면 그리드 잠금 + 배너 `승인된 견적입니다. 수정하려면 새 버전을 만드세요.`
- 빈 상태: "품목이 없습니다. 영업기회의 상품을 불러오거나 직접 추가하세요." + `[영업기회 품목 불러오기]`

---

### 6.12 계약 — `contracts.html`

- 목록: 계약번호/광고주/기간/금액/상태/자동갱신/갱신 D-day
- 뷰: `유효 계약` `갱신 임박(60일)` `만료` `전체`
- 상세 패널: 계약 정보 · 서명 정보 · 정산 조건 · 연결 캠페인 · 승인 이력
- 액션: `[유효 전환]`(→ 캠페인 + 티켓 자동 생성 확인 모달) `[갱신 기회 생성]` `[해지]`(사유 필수)
- 갱신 임박 카드: D-60 진입 시 자동으로 갱신 영업기회를 만들지 물어봅니다.
- 빈 상태: "체결된 계약이 없습니다. 영업기회를 `계약체결`로 전환하면 계약이 생성됩니다."

---

### 6.13 캠페인 — `campaigns.html`

- 목록: 캠페인명/광고주/매체/기간/예산/소진액/**소진율 바**/ROAS/상태
- 상세: 
  - 하이라이트: 캠페인명 + 광고주·매체·기간·예산·소진율·ROAS
  - **페이싱 카드**: 기간 경과율 vs 예산 소진율 이중 바. 괴리 20%p 초과 시 경고 문구(과소진/미소진).
  - 성과 지표 타일: 노출·클릭·CTR·CPC·전환·CVR·CPA·ROAS
  - 일별 추이 차트(지표 전환 드롭다운 + 전월 동기간 고스트 라인)
  - 연결 제작 의뢰 목록
- 빈 상태: "성과 데이터가 아직 없습니다. 집행이 시작되면 지표가 채워집니다."

---

### 6.14 광고상품 — `products.html`

- **탭 1 · 상품**: 목록(상품명/카테고리/매체/단위/과금방식/기준단가/수수료율/활성). 카테고리 필터 칩.
- **탭 2 · 단가표**: 좌측 단가표 목록(표준/대형광고주/연간계약), 우측 해당 단가표의 항목 그리드(상품/단가/수수료율/활성). 표준 단가표에 없는 상품은 추가 시 경고.
- **탭 3 · 매체**: 매체 마스터(매체명/그룹/기본 수수료율/정산 방식)
- 액션: `[상품 추가]` `[단가표 생성]` `[일괄 단가 조정]`(선택 항목 % 인상/인하)
- 빈 상태: 단가표에 항목 없음 → "이 단가표에 등록된 상품이 없습니다. 표준 단가표에서 복사할 수 있습니다." + `[표준에서 복사]`

---

### 6.15 제작 의뢰 — `tickets.html` / `?id=`  ★요구사항 #6의 주 화면

**뷰 토글**: `보드` / `목록` / `내 작업`

**보드 뷰**
- 컬럼 = 상태 9개 중 열린 상태 7개(완료·취소는 접힘). 컬럼 헤더: 상태명·건수·WIP 한도(초과 시 헤더 빨강)
- 스윔레인 선택기: `담당자` / `유형` / `광고주` / `없음`. 최상단에 **미배정** 레인 고정.
- 카드: 티켓번호(모노스페이스) · 제목 · 유형 아이콘 · 광고주 · 담당자 아바타 · 우선순위 칩 · **SLA D-day 칩**(여유 초록 / 임박 주황 / 초과 빨강) · 재작업 배지
- 드래그 = 상태 전이. **전이표에 없는 이동은 드롭 자체가 거부**되고 이유를 토스트로 알립니다. 전이에 필수 입력이 있으면 모달을 엽니다.

**목록 뷰**: 티켓번호/제목/유형/광고주/의뢰자/담당자/상태/우선순위/예상공수/실투입/마감일/SLA. 인라인 편집 + 대량 배정.

**티켓 상세(`?id=tk01`)**
- 하이라이트: `PRD-101` + 제목(H1) + 유형·광고주·의뢰자·담당자·마감일·우선순위·SLA 잔여 + 액션 바 `[내가 담당] [상태 전이 버튼들] [공수 신청] [워처 추가] [⋯]`
  - **상태 드롭다운이 아니라 전이 버튼**을 노출합니다. 현재 상태에서 가능한 전이만 버튼으로 보입니다.
- Path 셰브론(티켓 상태용, 7단계)
- 탭: `상세` `코멘트` `이력` `산출물` `공수`
  - 상세: 요청 내용 + **유형별 필수 항목 블록**(§8.2) + 연결 레코드(광고주/영업기회/캠페인)
  - 코멘트: 작성기(리치 텍스트 + @멘션 자동완성 + 파일 첨부 + `내부 전용` 토글) + 스레드. 시스템 상태 변경 항목은 압축 1줄로 섞여 표시.
  - 이력: append-only 테이블(일시/변경자/필드/이전→이후)
  - 산출물: 버전 목록(v1/v2/최종) + `최종 승인` 배지 + 미리보기
  - 공수: 연결된 공수 신청·배정·타임시트 합계 (예상 vs 실투입 소진 바)
- 우측: SLA 카드(잔여 시간 카운트다운 + 마일스톤), 워처 목록, 광고주 요약

**빈 상태**
- 보드 컬럼 빈칸: 흐린 안내 `이 상태의 의뢰가 없습니다`
- 미배정 레인 빈칸: "미배정 의뢰가 없습니다. 좋은 상태입니다." (초록)
- 코멘트 없음: "첫 코멘트를 남겨 진행 상황을 공유하세요."

---

### 6.16 공수 관리 — `resources.html`  ★요구사항 #4의 주 화면

**레이아웃**
- **경보 카드 4장**: `미배정 의뢰 n건` / `공수 승인 대기 n건` / `과부하 인원 n명` / `SLA 초과 n건` — 각 카드 클릭 시 아래 목록이 해당 필터로 전환
- **가동률 히트맵**: 행 = 제작 인력, 열 = 주(기본 8주) 또는 일(토글)
  - 셀 값 = 배정 공수 또는 캐파 대비 % (토글)
  - 셀 색: 회색(비근무) / 초록(60~100%) / 주황(<60% 유휴) / 빨강(>100% 과부하)
  - **수요 기준 선택기**: `확정 배정만` / `확정 + 가배정` / `확정 + 가배정 + 대기 신청`
  - 셀 더블클릭 → 시간 직접 입력. 드래그로 기간 복사.
  - 행 헤더: 이름 · 직무 · 주간 캐파 · 잔여 공수 · 가동률 %
- **공수 신청 큐 테이블**: 신청번호/티켓/요청 직무/요청 공수/기간/신청자/상태/경과시간 + 행 액션 `[승인] [반려] [후보 보기]`
- **후보 추천 패널**(신청 행에서 열림): 
  - 좌: 필터(직무·기간·최소 가용률·스킬 + 스킬별 최소 레벨)
  - 우: 순위 테이블 — 순위 / 이름 / **매치율 미터** / 가용률 / 직무 / 보유 스킬 매칭 수 / 현재 진행 건수
  - 매치 우선순위 칩을 드래그해 재정렬하면 순위가 즉시 재계산
  - 행 액션: `[가배정]` `[배정 확정]`
- **배정 미리보기**: 확정 전에 일별 배분 결과를 막대로 보여주고, 캐파 초과일은 빨강으로 표시. 초과 상태로 확정하려면 **사유 입력** 후 강행.

**빈 상태**
- 신청 없음: "대기 중인 공수 신청이 없습니다."
- 인력 없음: "제작 인력이 등록되지 않았습니다. 설정에서 사용자 직무를 지정하세요."

---

### 6.17 타임시트 — `timesheet.html`

- **헤더**: 주 선택기(◀ 2026-08-18 ~ 08-24 ▶) + 대상자(관리자는 팀원 선택) + 상태 배지 + `[제출]`
- **그리드**: 행 = 내게 열린 배정(티켓번호 · 제목 · 광고주), 열 = 월~일(비근무일 음영)
  - 셀 = 숫자 입력(0.5 단위) + 메모 아이콘
  - 우측 고정 열 = 행 합계, 하단 고정 행 = 일 합계 + 주 합계
  - 일 합계가 캐파 초과 시 주황
  - **배정 계획값으로 프리필** — 계획대로면 클릭 한 번으로 확인
- 제출 후 잠금 + 승인/반려 배지. 반려 시 사유가 상단 배너에 표시.
- 빈 상태: "이번 주에 배정된 작업이 없습니다. 공수 배정을 받으면 여기에 표시됩니다."

---

### 6.18 활동 — `activities.html`

- 뷰 토글: `목록` / `캘린더`
- 목록: 섹션 3개 — `기한 초과`(빨강) / `오늘` / `예정`. 각 행: 유형 아이콘 · 제목 · 관련 레코드 링크 · 기한 · 담당자 · 완료 체크
- 캘린더: 월/주 뷰. Event를 블록으로, Task를 종일 칩으로. 드래그로 일정 이동.
- 작성기: `할 일` `통화 기록` `미팅` `이메일` 탭. 관련 레코드는 진입 컨텍스트에서 프리필.
- 빈 상태: "예정된 활동이 없습니다. 접촉이 뜸한 광고주부터 일정을 잡으세요." + `[접촉 공백 광고주 보기]`

---

### 6.19 승인함 — `approvals.html`

- 탭: `미결`(내가 결재할 건) / `기결` / `상신함`(내가 올린 건)
- 미결 테이블: 종류/대상/상세/상신자/상신일시/**경과 시간**/금액 + 행 액션 `[승인] [반려]` + 체크박스 일괄 승인
- 반려 모달: **사유 필수**(자유 텍스트 + 사유 코드 선택)
- 상신함: 상태 추적 + `[회수]` 버튼
- 결재선 미리보기: 대상 레코드의 조건(할인율/금액)으로 결정된 단계를 시각화 (`1차 팀장 ✓ → 2차 본부장 ⏳ → 3차 대표`)
- 빈 상태: "결재할 건이 없습니다." (초록 체크)

---

### 6.20 설정·관리 — `admin.html`

- 탭: `사용자` `팀` `목표` `권한` `감사 로그` `데이터`
  - 사용자: 목록 + 역할·팀·직무·스킬·주간 캐파 편집. 비활성화 시 **레코드 이관 마법사**(소유 광고주/영업기회/티켓을 누구에게).
  - 팀: 조직 트리 편집, 팀장 지정
  - 목표: 기간×사용자 그리드로 목표 일괄 입력(붙여넣기 지원), 유형 토글(매출/순매출/신규광고주수)
  - 권한: §10 매트릭스를 읽기 전용 표로 렌더 + 역할별 실효 권한 조회기(`이 사용자가 이 객체에 무엇을 할 수 있나`)
  - 감사 로그: 일시/행위자/행위/객체/상세 테이블 + 필터 + CSV
  - 데이터: `시드 재생성` `내보내기(JSON)` `로컬 데이터 초기화`(2단계 확인)

---

### 6.21 디자인 시스템 — `design.html`

토큰 팔레트, 타이포 스케일, 컴포넌트 카탈로그(버튼·칩·배지·테이블·카드·모달·토스트·Path·칸반 카드·게이지·차트), 각 컴포넌트의 사용 규칙과 금지 사례. 개발자 참조 전용이며 레일 하단에 배치합니다.

---

## 7. 분석 엔진 사양

### 7.1 원칙

1. **지표 단일 정의**: 모든 수식은 `metrics.js`에만 존재합니다. 화면이 직접 합계를 내면 defect입니다.
2. **데이터 없으면 숫자를 만들지 않습니다**: 분모가 0이면 `null`을 반환하고 화면은 `—`와 함께 이유를 표시합니다. 0%를 꾸며내지 않습니다.
3. **모든 문장에는 근거가 붙습니다**: 인사이트 카드는 헤드라인 + 근거 지표 + 추천 액션 3요소를 반드시 가집니다.
4. **한국식 색 관례**: 증감 표시에서 **상승은 긍정색이 아니라 문맥에 따릅니다.** 매출 상승=긍정, 비용/사이클 상승=부정. 지표마다 `goodDirection`을 정의합니다.

### 7.2 스코프(Scope) 정의

모든 지표는 `scope` 객체를 받습니다.

```
scope = {
  userIds: string[]   // 볼 수 있는 사용자 목록 (역할 계층으로 계산)
  from:    Date       // 기간 시작 (기본: 이번 분기 1일)
  to:      Date       // 기간 종료 (기본: 이번 분기 말일)
  label:   string     // '2026 Q3'
}
```

`visibleUserIds()` 규칙: 영업사원 = 본인만 · 영업관리자 = 본인 + 같은 팀원 + 하위 팀 · 리소스매니저 = 제작 조직 전원 · 관리자 = 전원.

### 7.3 파이프라인 지표

| 지표 | 필드명 | 수식 | 단위 | 좋은 방향 |
|---|---|---|---|---|
| 파이프라인 금액 | `pipelineValue` | `Σ(오픈 영업기회.amount)` | 원 | ↑ |
| 가중 파이프라인 | `weightedPipeline` | `Σ(오픈.amount × 오픈.probability ÷ 100)` | 원 | ↑ |
| 수주 금액 | `wonAmount` | `Σ(기간 내 마감된 수주.amount)` | 원 | ↑ |
| 수주 순매출 | `wonNet` | `Σ(수주.netRevenue)` | 원 | ↑ |
| 성사율(건수) | `winRate` | `수주건수 ÷ (수주건수 + 실주건수) × 100` — 진행 건은 분모 제외 | % | ↑ |
| 성사율(금액) | `winRateByAmount` | `수주금액 ÷ (수주금액 + 실주금액) × 100` | % | ↑ |
| 평균 딜 규모 | `avgDealSize` | `수주금액 합계 ÷ 수주 건수` | 원 | ↑ |
| 영업 사이클 | `salesCycle` | `avg(수주.closeDate − 수주.createdAt)` (일) | 일 | ↓ |
| 파이프라인 커버리지 | `coverage` | `파이프라인 금액 ÷ (목표 − 수주 금액)`. 잔여 목표 ≤ 0이면 `∞` | 배 | ↑ (기준 3.0) |
| 목표 | `quota` | `Σ(대상자·대상 기간의 Target.amount where type='매출')` | 원 | — |
| 달성률 | `attainment` | `수주 금액 ÷ 목표 × 100` | % | ↑ |
| 잔여 목표 | `gapToQuota` | `목표 − 수주 금액` | 원 | ↓ |
| 진척 페이스 | `pace` | `달성률 ÷ (기간 경과일 ÷ 기간 총일수 × 100)` — 1.0이면 정상 | 배 | ↑ |
| 일평균 필요액 | `dailyNeed` | `잔여 목표 ÷ 남은 영업일` | 원/일 | ↓ |
| 단계 퍼널 | `stageFunnel` | 단계별 통과 건수. `현재 단계 order ≥ 해당 단계 order` 이거나 수주면 통과로 계수 | 건 | — |
| 단계 전환율 | `stageConversion` | `다음 단계 통과 건수 ÷ 현재 단계 통과 건수 × 100` | % | ↑ |
| 단계 체류일 | `stageDwell` | 단계별 `avg(오늘 − stageEnteredAt)` | 일 | ↓ |
| 정체 딜 수 | `stalledCount` | `count(오픈 && 체류일 > 단계별 허용일)` | 건 | ↓ |
| 마감 경과 딜 | `overdueCount` | `count(오픈 && closeDate < 오늘)` | 건 | ↓ |
| 무활동 딜 | `noActivityCount` | `count(오픈 && 최근 활동 30일 초과)` | 건 | ↓ |
| 영업 속도 | `velocity` | `(오픈 건수 × 평균 딜 규모 × 성사율) ÷ 영업 사이클` = 하루당 창출 금액 | 원/일 | ↑ |
| 광고주 집중도 | `concentration` | `상위 5개 광고주 수주액 ÷ 전체 수주액 × 100` | % | ↓ (경고 60%) |
| 신규 비중 | `newMix` | `신규 유형 수주액 ÷ 전체 수주액 × 100` | % | 균형 |

### 7.4 예측 지표

| 지표 | 수식 |
|---|---|
| `forecast.byCast[c]` | 예측 카테고리 `c`의 오픈 금액 합계. `Closed`는 수주 금액 |
| `forecast.commit` | `Commit + Closed` |
| `forecast.bestCase` | `Best Case + Commit + Closed` |
| `forecast.pipeline` | `Pipeline + Best Case + Commit + Closed` |
| `forecast.weighted` | `Closed + Σ(오픈 × 확률)` |
| 예측 정확도 | `1 − |실적 − 예측| ÷ 실적` (기간 마감 후 계산, 관리자 스코어보드용) |

### 7.5 제작·SLA 지표

| 지표 | 필드명 | 수식 |
|---|---|---|
| SLA 목표 시간 | `slaHoursFor(t)` | `유형별 기본 SLA시간 × 우선순위 계수` (P1 0.4 / P2 0.7 / P3 1.0 / P4 1.6) |
| SLA 잔여 | `slaRemaining(t)` | `(createdAt + slaHours) − 오늘` (시간). 음수면 위반 |
| SLA 상태 | `slaState(t)` | 잔여<0 → `breach` / 잔여 < 목표의 25% → `risk` / 그 외 `ok` / 완료·취소 → `done` |
| SLA 준수율 | `slaRate` | `(전체 − 위반) ÷ 전체 × 100` |
| 평균 리드타임 | `avgCycle` | `avg(doneAt − createdAt)` (영업일 기준) |
| 미배정 건수 | `unassigned` | `count(오픈 && assigneeId 없음)` |
| 미배정 대기시간 | `unassignedAge` | `avg(오늘 − createdAt)` for 미배정 |
| 재작업률 | `reworkRate` | `count(완료 && reworkCount>0) ÷ 완료 건수 × 100` |
| 평균 재작업 회차 | `avgRework` | `avg(완료.reworkCount)` |
| 공수 정확도 | `estimateAccuracy` | `avg(spentHours ÷ estimateHours)` — 1.2 초과면 과소 추정 |
| 상태 체류시간 | `statusDwell` | `TicketHistory`의 연속 status 변경 사이 간격 평균 |

### 7.6 리소스·가동률 지표

**기본 캐파**: 1인 주간 가용 공수 = **34시간**(주 40시간에서 회의·리서치 버퍼 15% 제외). 사용자별 `weeklyCapacity`로 override.

| 지표 | 수식 |
|---|---|
| 기간 캐파 | `weeklyCapacity × (기간 일수 ÷ 7)` − 부재 시간 |
| 배정 공수 | `Σ(기간과 겹치는 Assignment.hours, 취소 제외)` |
| **가동률** | `(청구 가능 공수 + 인정 공수) ÷ 기간 캐파 × 100` |
| **잔여 캐파 %** | `1 − (사용 공수 ÷ 기간 캐파)` |
| 잔여 FTE | `잔여 시간 ÷ (표준 일 근무시간 × 영업일수)` |
| 과부하 | 가동률 > 100% |
| 유휴 | 가동률 < 60% |
| 수요 기준 3종 | ① 확정 배정만 ② + 가배정(`heldResourceId`) ③ + 대기 신청(`status='대기'`) |
| 청구 가능 비율 | `billable 시간 ÷ 전체 기록 시간 × 100` |

### 7.7 스코어링

**리드 점수(0~100)** — 규칙 가산

| 조건 | 가점 |
|---|---|
| 기본 점수 | 30 |
| 유입 경로 = 기존 광고주 소개 | +25 |
| 유입 경로 = 인바운드 문의 / 파트너 소개 | +15 |
| 유입 경로 = 콜드 아웃바운드 | −5 |
| 예상 예산 ≥ 5천만원 | +20 · ≥ 2천만원 +12 · ≥ 1천만원 +6 |
| 업종이 상위 성사 업종 3개에 포함 | +8 |
| 직함에 `대표/이사/본부장/팀장` 포함 | +10 |
| 등록 후 7일 초과 무접촉 | −15 |
| 등록 후 21일 초과 무접촉 | 추가 −10 |

**광고주 건강도(0~100)** — 기준 70에서 가감, 이유 문자열을 함께 반환

| 조건 | 증감 | 이유 문장 |
|---|---:|---|
| 최근 7일 내 접촉 | +10 | `최근 7일 내 접촉` |
| 21일 초과 무접촉 | −10 | `{n}일간 접촉 없음` |
| 45일 초과 무접촉 | −22 | `{n}일간 접촉 없음` |
| 집행 중 캠페인 있음 | +8 | `집행 중 캠페인 {n}건` |
| 캠페인 이력은 있으나 현재 집행 없음 | −12 | `현재 집행 중인 캠페인 없음` |
| 진행 중 영업기회 있음 | +6 | `진행 중 영업기회 {n}건` |
| 최근 4개월 실주 2건 이상 | −14 | `최근 4개월 실주 {n}건` |
| SLA 초과 제작 건 있음 | −9 | `SLA 초과 제작 건 {n}건` |
| 갱신 D-60 이내 계약 있고 갱신 기회 없음 | −8 | `갱신 임박 계약에 후속 기회 없음` |

점수 밴드: `80+ 양호(초록)` / `60~79 관찰(회색)` / `40~59 주의(주황)` / `<40 위험(빨강)`

### 7.8 인사이트 규칙 (35종)

각 규칙은 `{ id, category, severity, condition, headline, why, actions }` 구조로 `insights.js`에 선언합니다.
`severity`: `risk`(위험) / `warn`(주의) / `act`(조치) / `good`(양호). 문장은 **평서형 한국어**로, 숫자를 반드시 포함합니다.

#### A. 파이프라인 (10)

| # | ID | 심각도 | IF 조건 | THEN 한국어 문장 |
|---:|---|---|---|---|
| 1 | `coverage-low` | 위험 | `coverage < 3` 이고 `잔여 목표 > 0` | **"파이프라인 커버리지가 {n.n}배로 안전선 3배를 밑돕니다. 잔여 목표 {금액}을 채우려면 최소 {필요금액} 규모의 신규 딜이 더 필요합니다."** |
| 2 | `coverage-ok` | 양호 | `coverage ≥ 3` | **"파이프라인 커버리지 {n.n}배로 목표 대비 여유가 있습니다. 지금은 신규 발굴보다 진행 딜의 단계 전진에 집중할 때입니다."** |
| 3 | `pace` | 주의 | `pace < 0.85` (진척이 기간 경과보다 15%p 이상 뒤짐) | **"기간의 {경과}%가 지났는데 목표는 {달성}%만 채웠습니다. 남은 {영업일}영업일 동안 하루 평균 {금액}을 수주해야 목표에 도달합니다."** |
| 4 | `stalled` | 주의 | `정체 딜 ≥ 3` | **"{n}건의 딜이 같은 단계에 허용 기간을 넘겨 머물러 있습니다. 가장 오래된 건은 '{기회명}'으로 {일}일째 {단계} 단계입니다."** |
| 5 | `overdue-close` | 위험 | `마감 경과 딜 ≥ 1` | **"마감 예정일이 지난 딜이 {n}건, 금액으로 {금액}입니다. 마감일을 갱신하지 않으면 이번 분기 예측이 그만큼 부풀려집니다."** |
| 6 | `no-activity` | 주의 | `무활동 30일 초과 오픈 딜 ≥ 2` | **"{n}건의 진행 딜에 최근 30일간 아무 활동 기록이 없습니다. 활동이 없는 딜의 성사율은 평균의 절반 이하입니다."** |
| 7 | `bottleneck` | 조치 | 단계 전환율 최저 구간 < 50% | **"'{단계A} → {단계B}' 전환율이 {n}%로 전 단계 중 가장 낮습니다. 이 구간에서 딜의 {손실}%가 새고 있습니다."** |
| 8 | `big-deal-loss` | 위험 | `건수 성사율 − 금액 성사율 ≥ 15%p` | **"건수 기준 성사율은 {a}%인데 금액 기준은 {b}%입니다. 작은 딜은 이기고 큰 딜은 지고 있다는 신호입니다."** |
| 9 | `cycle-drift` | 주의 | `이번 기간 사이클 > 직전 기간 사이클 × 1.2` | **"평균 영업 사이클이 {현재}일로 직전 기간 {이전}일보다 {n}일 길어졌습니다. 의사결정 라인이 넓어졌는지 확인이 필요합니다."** |
| 10 | `velocity-drop` | 주의 | `이번 기간 velocity < 직전 × 0.8` | **"영업 속도가 하루 {금액}으로 직전 기간 대비 {n}% 떨어졌습니다. 딜 규모·성사율·사이클 중 어디가 나빠졌는지 점검하세요."** |

#### B. 실주·경쟁 (3)

| # | ID | 심각도 | IF 조건 | THEN 한국어 문장 |
|---:|---|---|---|---|
| 11 | `loss-reason` | 조치 | 최근 90일 실주 중 1위 사유가 40% 이상 | **"최근 90일 실주 {전체}건 중 {비율}%가 '{사유}' 때문입니다. 단일 원인이 절반 가까이를 차지하면 제안 방식 자체를 손봐야 합니다."** |
| 12 | `competitor-rising` | 주의 | 특정 경쟁사에 최근 90일 3건 이상 실주 | **"'{경쟁사}'에 최근 90일 동안 {n}건을 내줬습니다. 해당 건들의 공통 업종은 '{업종}'입니다."** |
| 13 | `loss-missing-reason` | 조치 | 실주 딜 중 `lossReason` 누락 ≥ 1 | **"실주 처리된 {n}건에 사유가 기록되지 않았습니다. 사유 없는 실주는 다음 분기 전략의 재료가 되지 못합니다."** |

#### C. 광고주·리드 (6)

| # | ID | 심각도 | IF 조건 | THEN 한국어 문장 |
|---:|---|---|---|---|
| 14 | `concentration` | 주의 | `상위 5개 광고주 비중 ≥ 60%` | **"상위 5개 광고주가 전체 수주의 {n}%를 차지합니다. '{1위 광고주}' 한 곳이 이탈하면 분기 목표의 {영향}%가 사라집니다."** |
| 15 | `at-risk` | 위험 | 건강도 < 40인 광고주 ≥ 1 | **"이탈 위험 광고주가 {n}곳입니다. '{광고주}'는 {일}일간 접촉이 없고 집행 중 캠페인도 없습니다."** |
| 16 | `silent-account` | 주의 | 거래중 광고주 중 45일 초과 무접촉 ≥ 3 | **"거래 중인 광고주 {n}곳과 45일 넘게 접촉이 없습니다. 재계약 시즌 전에 접점을 복구해야 합니다."** |
| 17 | `renewal` | 조치 | 계약 만료 D-60 이내 && 갱신 기회 없음 | **"{n}건의 계약이 {일}일 내 만료되는데 갱신 영업기회가 만들어지지 않았습니다. 합계 {금액} 규모입니다."** |
| 18 | `cold-leads` | 주의 | 등록 7일 초과 무접촉 리드 ≥ 3 | **"{n}건의 리드가 접수 후 7일 넘게 첫 접촉 없이 남아 있습니다. 인바운드 리드는 응답이 하루 늦을 때마다 전환율이 눈에 띄게 떨어집니다."** |
| 19 | `dormant-revive` | 조치 | 최근 집행 종료 후 60~120일 경과 광고주 ≥ 1 | **"'{광고주}'는 마지막 집행 종료 후 {일}일이 지났습니다. 휴면 90일 이내 재접촉이 신규 개척보다 성사율이 높습니다."** |

#### D. 실적·목표 (4)

| # | ID | 심각도 | IF 조건 | THEN 한국어 문장 |
|---:|---|---|---|---|
| 20 | `actual-missing` | 조치 | 지난달 수주 딜은 있으나 해당 월 실적 입력 없음 | **"지난달 수주한 {n}건({금액})의 실적이 아직 입력되지 않았습니다. 실적을 입력해야 달성률에 반영됩니다."** |
| 21 | `actual-pending` | 조치 | `제출` 상태 실적이 5영업일 이상 미확정 | **"제출된 실적 {n}건이 {일}일째 확정되지 않았습니다. 관리자 확정 전까지 팀 집계에 잡히지 않습니다."** |
| 22 | `quota-hit` | 양호 | `attainment ≥ 100` | **"이번 기간 목표 {금액}을 {달성}% 달성했습니다. 초과분 {금액}은 다음 기간 파이프라인으로 이월 관리하세요."** |
| 23 | `new-mix` | 조치 | `신규 비중 < 20%` 또는 `> 80%` | 신규<20%: **"이번 기간 수주의 {n}%만 신규 광고주에서 나왔습니다. 기존 물량에 의존하면 한 곳의 이탈이 곧바로 목표 미달로 이어집니다."** / 신규>80%: **"수주의 {n}%가 신규입니다. 기존 광고주 재계약 관리가 비어 있지 않은지 확인하세요."** |

#### E. 승인 (2)

| # | ID | 심각도 | IF 조건 | THEN 한국어 문장 |
|---:|---|---|---|---|
| 24 | `approval-wait` | 조치 | 미결 승인 ≥ 1 | **"결재 대기 중인 건이 {n}건 있습니다. 가장 오래된 건은 {일}일째 대기 중입니다."** |
| 25 | `approval-blocking` | 주의 | 승인 대기 중이면서 연결 딜의 마감일이 14일 이내 | **"{n}건의 승인이 마감 임박 딜을 잡고 있습니다. '{기회명}'은 마감까지 {일}일 남았는데 할인 승인이 {대기일}일째 대기 중입니다."** |

#### F. 제작 티켓 (5)

| # | ID | 심각도 | IF 조건 | THEN 한국어 문장 |
|---:|---|---|---|---|
| 26 | `sla-breach` | 위험 | SLA 초과 오픈 티켓 ≥ 1 | **"납기를 넘긴 제작 의뢰가 {n}건입니다. '{티켓번호} {제목}'은 마감 후 {일}일이 지났습니다."** |
| 27 | `unassigned` | 주의 | 미배정 오픈 티켓 ≥ 2 | **"담당자가 지정되지 않은 의뢰가 {n}건, 가장 오래된 건은 접수 후 {시간}시간 지났습니다."** |
| 28 | `rework` | 조치 | 완료 티켓의 재작업률 ≥ 30% | **"완료된 제작물의 {n}%가 최소 1회 재작업을 거쳤습니다. 재작업의 대부분은 의뢰 시점의 정보 부족에서 나옵니다."** |
| 29 | `ticket-vs-close` | 위험 | 티켓 마감일 > 연결 딜의 마감일 | **"'{기회명}'의 마감 예정일보다 제작 의뢰 '{티켓번호}'의 납기가 {일}일 늦습니다. 이대로면 제안 일정에 산출물이 도착하지 않습니다."** |
| 30 | `estimate-drift` | 주의 | `avg(spentHours/estimateHours) > 1.3` | **"제작 실투입이 예상 공수의 {n}%에 달합니다. 공수 산정 기준을 다시 잡지 않으면 배정 계획이 계속 어긋납니다."** |

#### G. 리소스 (3)

| # | ID | 심각도 | IF 조건 | THEN 한국어 문장 |
|---:|---|---|---|---|
| 31 | `overloaded` | 위험 | 가동률 > 100%인 인력 ≥ 1 | **"{n}명이 가용 공수를 초과해 배정돼 있습니다. '{이름}'은 이번 주 {배정}시간 배정으로 캐파 {캐파}시간을 {초과}시간 넘겼습니다."** |
| 32 | `idle` | 조치 | 가동률 < 60%인 인력 ≥ 1 && 미배정 티켓 ≥ 1 | **"'{이름}'의 이번 주 가동률이 {n}%인데 미배정 의뢰가 {건}건 대기 중입니다. 배정하면 양쪽이 동시에 해결됩니다."** |
| 33 | `req-pending` | 조치 | 대기 상태 공수 신청 ≥ 1 | **"공수 신청 {n}건이 승인 대기 중입니다. 가장 오래된 건은 {시간}시간째 대기하고 있으며, 요청 착수일까지 {일}일 남았습니다."** |

#### H. 캠페인 성과 (2)

| # | ID | 심각도 | IF 조건 | THEN 한국어 문장 |
|---:|---|---|---|---|
| 34 | `roas-low` | 주의 | 집행 중 캠페인의 ROAS < 200% | **"'{캠페인}'의 ROAS가 {n}%로 손익 기준선을 밑돕니다. 소재 교체나 타겟 조정 없이 남은 예산 {금액}을 그대로 태우면 결과보고가 어려워집니다."** |
| 35 | `pace-overspend` | 주의 | `소진율 ÷ 기간경과율 > 1.2` 또는 `< 0.8` | 과소진: **"'{캠페인}'은 기간의 {경과}%가 지났는데 예산의 {소진}%를 썼습니다. 이 속도면 {일}일 일찍 예산이 소진됩니다."** / 미소진: **"'{캠페인}'은 기간의 {경과}%가 지났는데 소진은 {소진}%에 그칩니다. 미소진은 곧 수수료 손실입니다."** |

> **규칙 수 총계 35종** (요구 최소 20종 초과 달성). 카테고리별 최소 노출: 홈은 상위 3개, 인사이트 화면은 전체.

### 7.9 인사이트 우선순위 및 표시 규칙

1. **정렬**: `severity`(risk > warn > act > good) → 영향 금액 내림차순 → 최신순.
2. **중복 억제**: 같은 레코드를 지목하는 규칙이 3개 이상이면 상위 1개만 남기고 나머지는 카드 하단 `관련 신호 {n}건` 접힘으로 처리.
3. **양호 규칙**: `good` 카드는 최대 1장만 노출합니다(칭찬이 경고를 밀어내면 안 됩니다).
4. **무시(dismiss)**: 사유 선택(`이미 조치함` / `해당 없음` / `나중에`) 후 14일간 동일 규칙+동일 대상 재노출 금지.
5. **액션 계약**: 모든 `actions[]`는 `{label, href, filter}` 형태로, 실제 필터가 적용된 화면으로 이동해야 합니다.
6. **문장 작성 규칙**: ① 숫자를 반드시 포함 ② 원인 또는 결과를 한 절 포함 ③ 존댓말 평서형 ④ 40~90자 ⑤ 느낌표 금지 ⑥ 고유명사는 실제 레코드명을 인용.

---

## 8. 티켓 워크플로우

Jira의 **타입별 워크플로 + 명시적 상태 전이(조건·검증·후처리)** 를 Salesforce Case의 **큐 소유 + SLA 마일스톤 + 에스컬레이션**과 합칩니다.

### 8.1 의뢰 유형(Issue Type)

| 유형 | 담당 직무 | 기본 공수 | 기본 SLA | 기본 큐(팀) | 산출물 |
|---|---|---:|---:|---|---|
| **영상제작** | 영상편집자 | 24h | 96h | 크리에이티브 제작본부 | 완성본 + 컷 버전 |
| **광고기획** | 광고기획자 | 12h | 48h | 크리에이티브 제작본부 | 기획서/미디어플랜 |
| **디자인** | 그래픽디자이너 | 10h | 48h | 크리에이티브 제작본부 | 소재 세트(매체 규격별) |
| **랜딩페이지** | 퍼블리셔 | 20h | 96h | 크리에이티브 제작본부 | 배포 URL + 소스 |
| **카피** | 카피라이터 | 6h | 24h | 크리에이티브 제작본부 | 카피 세트 |
| **성과분석** | 데이터분석가 | 8h | 48h | 크리에이티브 제작본부 | 리포트 |

### 8.2 유형별 필수 입력 (`typeFields`)

**의뢰 폼은 유형 선택이 첫 필드이고, 선택 시 아래 블록이 통째로 교체됩니다.** 필수 항목이 비면 제출 버튼이 비활성화되고 `필수 항목 {n}개 미입력`을 표시합니다. **이것이 재작업률을 낮추는 핵심 장치입니다.**

| 유형 | 필수 필드 | 선택 필드 |
|---|---|---|
| 영상제작 | `러닝타임(초)` · `해상도/비율`(16:9, 9:16, 1:1) · `자막 유무` · `나레이션 유무` · `원본 소재 링크` · `노출 매체` | 레퍼런스 URL, BGM 지정, 촬영 필요 여부 |
| 광고기획 | `캠페인 목표`(인지/유입/전환/재구매) · `타겟`(연령·성별·관심사) · `예산 규모` · `집행 기간` | 경쟁사 참고, 이전 캠페인 성과 |
| 디자인 | `매체 규격`(다중 선택) · `사이즈 목록` · `카피 확정 여부` · `브랜드 가이드 링크` | 시안 수, 원본 이미지 |
| 랜딩페이지 | `도메인/경로` · `반응형 여부` · `트래킹 코드`(GA4/픽셀) · `폼 연동 여부` · `기획안 링크` | 결제 연동, A/B 분기 |
| 카피 | `톤앤매너` · `글자 수 제한` · `필수 포함 키워드` | 금칙어, 참고 문구 |
| 성과분석 | `분석 대상 캠페인` · `분석 기간` · `필요 지표` | 비교 기준(전월/전년) |

**공통 필수**: 유형 · 제목 · 광고주 · 우선순위 · **납품 희망일** · 목적(제안용/집행용/리뉴얼) · 요청 내용

### 8.3 상태(Status)

| 상태 | 분류 | 의미 | SLA 시계 |
|---|---|---|---|
| `접수대기` | To Do | 등록됨, 큐 대기 | **가동** |
| `검토` | To Do | 리소스 매니저가 내용 검토 중 | **가동** |
| `배정됨` | To Do | 담당자 지정 완료, 미착수 | **가동** |
| `진행중` | In Progress | 작업 중 | **가동** |
| `검수` | In Progress | 의뢰자 확인 대기 | **정지**(의뢰자 대기) |
| `수정요청` | In Progress | 반려되어 재작업 중 | **가동** |
| `보류` | In Progress | 정보 부족·광고주 대기 | **정지** |
| `완료` | Done | 산출물 승인 | 종료 |
| `취소` | Done | 진행하지 않음 | 종료 |

> **SLA 시계 정지 규칙이 핵심입니다.** `검수`와 `보류`에서 시계를 멈추지 않으면 의뢰자 대기 때문에 제작팀이 부당하게 위반 처리됩니다.

### 8.4 상태 전이표 (Transition)

| From | 가능한 To | 실행 가능 주체 | 필수 입력(검증) | 후처리(Post Function) |
|---|---|---|---|---|
| `접수대기` | `검토`, `취소` | 리소스매니저 / 의뢰자(취소만) | — | 검토 진입 시 큐 알림 |
| `검토` | `배정됨`, `보류`, `취소` | 리소스매니저 | 배정 시 `assigneeId` 필수 | 담당자 알림 + 워처 알림 |
| `배정됨` | `진행중`, `보류`, `취소` | 담당자 / 리소스매니저 | — | `startedAt` 스탬프 |
| `진행중` | `검수`, `보류` | 담당자 | 검수 시 **산출물 1건 이상** 필수 | 의뢰자 알림, SLA 시계 정지 |
| `검수` | `완료`, `수정요청` | 의뢰자 / 리소스매니저 | 수정요청 시 **사유 필수** | 완료: `doneAt` 스탬프 · 수정요청: `reworkCount+1`, 시계 재가동 |
| `수정요청` | `진행중` | 담당자 | — | 시계 가동 |
| `보류` | `검토`, `진행중`, `취소` | 담당자 / 리소스매니저 | 보류 진입 시 `holdReason` 필수 | 시계 정지/재가동 |
| `완료` | — | — | — | 연결 영업기회에 산출물 알림, 오더 라인 `납품완료` 체크 |
| `취소` | — | — | — | 배정·공수 신청 동반 취소 |

**규칙**
- 이 표에 없는 이동은 **UI에 버튼 자체가 없고**, API 레벨에서도 거부합니다.
- `완료`/`취소`는 종료 상태입니다. 재개가 필요하면 **새 티켓**을 만들거나 관리자가 `재오픈`(감사 로그 필수)합니다.
- 모든 전이는 `TicketHistory`에 1행을 남깁니다.
- 무상 수정 한도(`freeReworkLimit`, 기본 2) 초과 시 `수정요청` 전이는 **추가비용 승인 상신**을 요구합니다.

### 8.5 우선순위 매트릭스

우선순위는 임의 선택이 아니라 **영향도 × 긴급도**로 결정합니다. 의뢰 폼에서 두 축을 고르면 우선순위가 자동 산출되고, 상향 조정은 팀장 승인이 필요합니다.

| 영향도 ↓ / 긴급도 → | **즉시(D-2 이내)** | **단기(D-3~7)** | **여유(D-8+)** |
|---|---|---|---|
| **높음** (수주 직결·집행 중단 위험·Key 광고주) | **P1 긴급** | **P1 긴급** | **P2 높음** |
| **보통** (제안 경쟁·기존 광고주 정기) | **P2 높음** | **P3 보통** | **P3 보통** |
| **낮음** (내부 검토·리뉴얼·참고용) | **P3 보통** | **P4 낮음** | **P4 낮음** |

| 우선순위 | SLA 계수 | 예: 영상제작(기본 96h) | 보드 표시 |
|---|---:|---:|---|
| P1 긴급 | ×0.4 | 38h | 빨강 칩 + 카드 좌측 두꺼운 바 |
| P2 높음 | ×0.7 | 67h | 주황 칩 |
| P3 보통 | ×1.0 | 96h | 회색 칩 |
| P4 낮음 | ×1.6 | 154h | 흐린 칩 |

**P1 남용 방지**: 한 의뢰자가 동시에 열 수 있는 P1은 **2건**까지. 초과 시 "현재 P1 2건이 진행 중입니다. 기존 건을 낮추거나 팀장 승인을 받으세요." 경고와 함께 팀장 승인 요구.

### 8.6 SLA · 에스컬레이션

**마일스톤 2단계**
1. **최초 응답**(접수 → `검토` 또는 `배정됨` 진입): 유형 SLA의 15%
2. **납품**(접수 → `검수` 진입): 유형 SLA 100%

**업무시간 기준**: KST 09:00~18:00, 점심 12:00~13:00 제외, 주말·한국 공휴일(대체공휴일 포함) 제외. **벽시계 뺄셈 금지 — 반드시 영업시간 캘린더를 통과시킵니다.**

**에스컬레이션 사다리**

| 트리거 | 조치 |
|---|---|
| 최초 응답 SLA 50% 경과, 미배정 | 큐 전체 알림 |
| 최초 응답 SLA 초과 | 리소스매니저에게 알림 + `resources.html` 경보 카드 계수 |
| 납품 SLA 25% 남음 | 담당자 + 의뢰자 알림 (`임박` 상태) |
| 납품 SLA 초과 | 담당자 + 리소스매니저 + 의뢰자 알림, 티켓 `escalated=true`, 인사이트 `sla-breach` 발화 |
| 납품 SLA 초과 + 24h | 제작본부 팀장 알림 + 홈 대시보드 위험 카드 |

### 8.7 큐 · 배정 · 워처

- **큐 소유**: `assigneeId`가 null이면 `queueTeamId`가 소유자입니다. 큐 목록은 팀 전원에게 보입니다.
- **`내가 담당` 액션**: 낙관적 잠금(현재 소유자 비교 후 교체)으로 동시 클릭 시 한 명만 성공하고, 나머지는 `이미 {이름}님이 담당으로 지정했습니다` 토스트.
- **워처**: 의뢰자 + 담당자 + 연결 영업기회의 `teamIds`가 기본. @멘션된 사람은 자동 추가. 워처는 모든 상태 변경·코멘트 알림을 받되 **편집 권한은 없습니다.**
- **자동 생성**: 계약이 `유효`로 전환되면 `needsProduction=true`인 라인마다 티켓 초안을 생성 제안합니다. 납기 = `집행 시작일 − 유형별 리드타임`.

---

## 9. 공수(리소스) 워크플로우

Certinia PSA의 **Resource Request → (Hold) → Assignment → Timecard → Utilization** 체인을 그대로 재현합니다.

### 9.1 전체 흐름

```
[영업/제작] 공수 신청 작성
      │  ResourceRequest(status='대기')
      ▼
[리소스매니저] 후보 추천 확인 ──► 가배정(Hold)  ──7일 만료──► 자동 해제
      │  status='가배정', heldResourceId 설정          (히트맵에 수요로 계속 표시)
      ▼
[리소스매니저] 승인 / 반려
      │  승인 → status='승인'          반려 → status='반려' (사유 필수, 신청자 알림)
      ▼
[시스템] 배정 생성  Assignment + dailyHours 배분
      │  ResourceRequest.status='배정완료'
      ▼
[제작인력] 타임시트 입력 (주 단위) → 제출
      ▼
[리소스매니저] 타임시트 승인 → Ticket.spentHours 갱신
      ▼
[시스템] 가동률(UtilizationResult) 야간 집계 → 히트맵·대시보드
```

### 9.2 상태 정의

**ResourceRequest.status**

| 상태 | 의미 | 다음 상태 | 주체 |
|---|---|---|---|
| `대기` | 신청 제출됨, 검토 전 | `가배정` `승인` `반려` `취소` | 리소스매니저(취소는 신청자) |
| `가배정` | 특정 인력을 소프트 예약. 히트맵에 수요로 표시되나 Assignment는 없음 | `승인` `대기`(해제) `반려` `취소` | 리소스매니저 |
| `승인` | 승인됨, 배정 생성 직전 | `배정완료` `취소` | 시스템 |
| `배정완료` | Assignment 생성 완료 | `취소` | — |
| `반려` | 거절됨. **처리 의견 필수** | `대기`(재신청) | 신청자 |
| `취소` | 신청 철회 | — | — |

**Assignment.status**: `예정` → `진행중` → `완료` (또는 `취소`). 시작일 도래 시 자동 `진행중`, 티켓 완료 시 자동 `완료`.

**Timesheet.status**: `임시저장` → `제출` → `승인` / `반려`. 승인된 것만 집계에 반영.

### 9.3 신청 폼

| 필드 | 필수 | 검증 |
|---|:--:|---|
| 연결 티켓 | ● | 열린 티켓만 선택 가능 |
| 요청 직무 | ● | `craft` 값 집합 |
| 요청 공수(시간) | ● | > 0, ≤ 400 |
| 시작 희망일 | ● | 오늘 이후 |
| 종료 희망일 | ● | 시작일 이후. **연결 티켓의 마감일 이후면 저장 차단** |
| 일일 투입 시간 | | 기본 `요청 공수 ÷ 영업일수`. 8h 초과 시 초과근무 사유 필요 |
| 필요 스킬 | | 매칭 점수에 반영 |
| 신청 사유 | ● | 자유 텍스트 |

### 9.4 후보 추천 알고리즘

**1단계 · 하드 필터**(불통과자는 후보에서 제외)

| 규칙 | 조건 |
|---|---|
| 직무 일치 | `user.craft === request.roleNeeded` |
| 활성 | `user.active === true` |
| 기간 가용 | 요청 기간 내 잔여 캐파 > 0 |
| 필수 스킬 | 요청의 필수 스킬을 전부 보유 |
| 동시 진행 상한 | 열린 배정 건수 < 상한(기본 4) |

**2단계 · 가중 점수(0~100)**

| 항목 | 가중치 | 계산 |
|---|---:|---|
| 가용률 적합도 | 35 | 요청 기간의 잔여 캐파 비율. 요청 공수를 여유롭게 수용할수록 높음 |
| 스킬 적합도 | 25 | 요청 스킬 중 보유 비율. **과잉 자격은 감점**(시니어를 단순 리사이즈에 태우지 않기) |
| 광고주 연속성 | 15 | 최근 90일 내 같은 광고주 작업 이력이 있으면 만점 |
| 가동률 평준화 | 15 | 목표 가동률 대비 여유가 큰 사람 우대 |
| 재작업 이력 | 10 | 최근 재작업률이 낮을수록 높음 |

`매치율 %` = 가중 합계. 후보 패널의 우선순위 칩을 드래그해 가중치를 재정렬하면 순위가 즉시 재계산됩니다.

### 9.5 배정 시 공수 배분 방식

| 방식 | 계산 |
|---|---|
| **균등 배분**(기본) | `요청 공수 ÷ 영업일수`를 매일 동일 배분 |
| **전일 투입(FTE)** | 하루 캐파(기본 6.8h = 34÷5)만큼 채우며 소진될 때까지 |
| **부분 투입(%)** | 하루 캐파 × 지정 % |
| **후반 집중** | 마감 3영업일에 40% 집중 (영상편집 기본값) |
| **전반 집중** | 착수 3영업일에 40% 집중 (광고기획 기본값) |

배정 확정 전 **미리보기**에 일별 막대를 그리고 캐파 초과일을 빨강으로 표시합니다. 초과 상태로 확정하려면 사유 입력 후 `강행 배정`(감사 로그 기록).

### 9.6 캐파 산식 (Capacity Math)

```
표준 주간 캐파        = 34시간          (주 40h − 회의·버퍼 15%)
표준 일 캐파          = 34 ÷ 5 = 6.8시간
기간 캐파(person)     = weeklyCapacity × (영업일수 ÷ 5) − 부재시간
사용 공수(person)     = Σ Assignment.dailyHours[해당 기간]  (status ≠ '취소')
가배정 수요           = Σ ResourceRequest(status='가배정').hours × (기간 겹침 비율)
대기 수요             = Σ ResourceRequest(status='대기').hours × (기간 겹침 비율)

가동률 %              = (청구가능 공수 + 인정 공수) ÷ 기간 캐파 × 100
잔여 캐파 %           = (1 − 사용 공수 ÷ 기간 캐파) × 100
잔여 FTE              = (기간 캐파 − 사용 공수) ÷ (6.8 × 영업일수)

수요 기준 3종:
  ① 확정              = 사용 공수
  ② 확정+가배정        = 사용 공수 + 가배정 수요
  ③ 확정+가배정+대기   = 사용 공수 + 가배정 수요 + 대기 수요
```

**히트맵 색 규칙**

| 조건 | 색 | 라벨 |
|---|---|---|
| 비근무일·공휴일·부재 | 회색 | — |
| 가동률 0% | 흐린 회색 | 유휴 |
| 1~59% | 주황 | 여유 |
| 60~100% | 초록 | 적정 |
| 101~120% | 빨강 | 초과 |
| 120% 초과 | 진한 빨강 + ⚠ | 심각 초과 |

**직무별 생산성 계수**(일 캐파 보정): 영상편집 0.75 · 광고기획 0.70 · 디자인 0.80 · 퍼블리싱 0.85 · 카피 0.80 · 분석 0.80. 계획을 8시간 풀가동 위에 세우면 반드시 어긋납니다.

### 9.7 부재(비가동) 관리

| 유형 | 캐파 차감 | 비청구 계상 |
|---|:--:|:--:|
| 연차 / 반차 / 병가 / 공가 | ● | ✕ |
| 교육·워크숍 / 내부 R&D | ✕ | ● |
| 사내 행사 | ✕ | ● |
| 촬영 출장 | ✕ | ✕ (청구 가능) |

부재는 히트맵에 빗금 블록으로 렌더하고, 겹치는 배정 시도는 하드 규칙 위반으로 경고합니다.

### 9.8 타임시트 규칙

- 주(월~일) 단위 그리드. 행 = 열린 배정, 열 = 요일.
- **배정 계획값으로 프리필** — 계획대로 일했으면 확인 후 제출 1클릭.
- 0.5시간 단위. 일 합계가 캐파 초과 시 주황, 12시간 초과 시 저장 차단.
- 제출 후 잠금. 반려되면 다시 편집 가능하며 반려 사유가 배너에 표시.
- 승인된 시간만 `Ticket.spentHours`와 가동률에 반영.
- 매주 금요일 미제출자에게 알림 발송.

---

## 10. 권한 매트릭스

### 10.1 원칙 (2축 분리)

Salesforce와 동일하게 **두 축을 분리**합니다.

- **축 1 · 객체 권한**: 이 역할이 이 객체에 어떤 동작을 할 수 있는가 (C/R/U/D)
- **축 2 · 레코드 공유**: 그 객체의 **어떤 행**을 볼 수 있는가 (소유권 + 역할 계층 + 공유 규칙)

실효 권한 = `객체 권한 ∩ 레코드 접근 ∩ 필드 권한`. UI에서 버튼을 감추는 것만으로는 부족하며, 저장 시점에도 반드시 재검증합니다.

### 10.2 객체 × 역할 CRUD 매트릭스

C=생성 R=조회 U=수정 D=삭제 · `—`=접근 불가 · `R*`=자기 소유/관련 건만

| 객체 | 영업사원 | 영업관리자 | 제작인력 | 리소스매니저 | 관리자 |
|---|---|---|---|---|---|
| **User** | R | R | R | R U | C R U D |
| **Team** | R | R | R | R | C R U D |
| **Account(광고주)** | C R U | C R U D | R | R | C R U D |
| **Contact** | C R U | C R U D | R | R | C R U D |
| **Lead** | C R U | C R U D | — | — | C R U D |
| **Opportunity** | C R U D | C R U D | R | R | C R U D |
| **OpportunityLine** | C R U D | C R U D | R | — | C R U D |
| **Product** | R | R | R | R | C R U D |
| **PriceBook / Entry** | R | R | — | — | C R U D |
| **Quote / QuoteLine** | C R U | C R U D | — | — | C R U D |
| **Contract** | R | R U | — | — | C R U D |
| **Campaign** | C R U | C R U D | R | R | C R U D |
| **Activity** | C R U D | C R U D | C R U* | C R U* | C R U D |
| **Ticket(제작의뢰)** | C R U* | C R U | R U* | C R U D | C R U D |
| **TicketComment** | C R | C R | C R | C R U D | C R U D |
| **TicketHistory** | R | R | R | R | R (불변) |
| **ResourceRequest** | C R U* | R U | R | C R U D | C R U D |
| **Assignment** | R | R | R* | C R U D | C R U D |
| **Timesheet** | — | R | C R U* | C R U D | C R U D |
| **Target(목표)** | R* | C R U D | — | R | C R U D |
| **Actual(실적)** | C R U* | C R U D | — | — | C R U D |
| **Note** | C R U D* | C R U D | C R U* | C R U* | C R U D |
| **Approval** | C R* | C R U | — | C R U | C R U D |
| **Notification** | R U* | R U* | R U* | R U* | R U D |
| **AuditLog** | — | R* | — | — | R (불변) |
| **ListView** | C R U D* | C R U D | C R U D* | C R U D* | C R U D |
| **설정(admin)** | — | — | — | — | 전체 |

### 10.3 레코드 공유 규칙 (축 2)

| 객체 | 조직 기본값(OWD) | 확장 규칙 |
|---|---|---|
| Account | **비공개** | 소유자 + 역할 계층 상향 + 영업기회 팀원 읽기 |
| Opportunity | **비공개** | 소유자 + 역할 계층 + `teamIds` 팀원 + 관리자 |
| Quote / Contract | Opportunity 상속 | — |
| Lead | **비공개** | 소유자 + 관리자 |
| Ticket | **공개 읽기 전용** | 제작 조직 전원 읽기. 쓰기는 담당자·의뢰자·리소스매니저 |
| ResourceRequest / Assignment | **공개 읽기 전용** | 쓰기는 리소스매니저 |
| Timesheet | **비공개** | 본인 + 리소스매니저 + 관리자 |
| Target / Actual | **비공개** | 본인 + 상위 관리자 + 관리자 |
| Campaign | Account 상속 | 제작 인력 읽기 |
| Product / PriceBook | **공개 읽기 전용** | 쓰기는 관리자 |

**역할 계층 롤업**: 영업관리자는 같은 팀·하위 팀 구성원이 소유한 레코드를 자동으로 읽습니다. 제작 조직은 영업 계층 아래에 두지 **않습니다** — 제작 인력의 티켓 접근은 계층이 아니라 공유 규칙으로 부여합니다.

### 10.4 필드 수준 보안 (민감 필드)

| 필드 | 영업사원 | 영업관리자 | 제작인력 | 리소스매니저 | 관리자 |
|---|---|---|---|---|---|
| `Opportunity.netRevenue` (순매출) | 읽기 | 읽기 | **숨김** | **숨김** | 읽기 |
| `Product.costRate` (원가율) | **숨김** | 읽기 | **숨김** | **숨김** | 읽기·쓰기 |
| `PriceBookEntry.commissionRate` | 읽기 | 읽기 | **숨김** | **숨김** | 읽기·쓰기 |
| `Account.creditLimit` (여신) | 읽기 | 읽기 | **숨김** | **숨김** | 읽기·쓰기 |
| `Account.bizNo` (사업자번호) | **마스킹** | **마스킹** | **숨김** | **숨김** | 읽기 |
| `Contact.phone` / `email` | **마스킹**(표시 토글 시 감사 로그) | 마스킹 | **숨김** | **숨김** | 마스킹 |
| `User.phone` | 마스킹 | 마스킹 | 마스킹 | 마스킹 | 마스킹 |
| `Assignment.costRate` (인건 단가) | **숨김** | 읽기 | **숨김** | 읽기 | 읽기·쓰기 |
| `Target` / `Actual` (타인) | **숨김** | 읽기(팀원) | **숨김** | **숨김** | 읽기 |

**숨김 필드는 목록·리포트·CSV 내보내기·API 응답 어디에도 나타나지 않습니다.** UI에서만 감추는 것은 defect입니다.

### 10.5 액션 수준 권한 (버튼 게이트)

| 액션 | 허용 역할 | 추가 조건 |
|---|---|---|
| 단계 → `계약체결` | 영업사원(소유자), 영업관리자, 관리자 | 필수 필드 충족 |
| 견적 승인 상신 | 견적 작성자 | 할인율이 임계 초과일 때만 표시 |
| 승인 처리(승인/반려) | 해당 단계의 `approverId` 본인, 관리자 | 반려 시 사유 필수 |
| 승인 회수 | 상신자 본인 | 상태가 `대기`일 때만 |
| 티켓 `내가 담당` | 제작인력(해당 큐 소속), 리소스매니저 | 현재 미배정일 때 |
| 티켓 `수정요청` | 의뢰자, 리소스매니저 | 사유 필수. 한도 초과 시 승인 필요 |
| 공수 승인/반려 | 리소스매니저, 관리자 | 반려 시 사유 필수 |
| 강행 배정(캐파 초과) | 리소스매니저, 관리자 | 사유 필수 + 감사 로그 |
| 실적 확정/반려 | 영업관리자, 관리자 | 반려 시 사유 필수 |
| 목표 설정 | 영업관리자(팀원), 관리자(전원) | **본인 목표는 수정 불가** |
| 사용자 비활성화 | 관리자 | 레코드 이관 마법사 완료 필수 |
| 데이터 초기화 | 관리자 | 2단계 확인 |
| 연락처 마스킹 해제 | 영업사원(담당 건), 영업관리자, 관리자 | 조회 시 감사 로그 |

---

## 11. 시드 데이터 계획

### 11.1 원칙 (준수 필수)

1. **전부 가상**입니다. 실존하는 기업·브랜드·인물·연락처를 사용하지 않습니다. 회사명은 조어(`노바커머스`, `비오라코스메틱`)로 만듭니다.
2. **전화번호 마스킹**: 개인 `010-****-1234`, 대표 `02-****-9192`. 마스킹된 형태로 **저장**하며, 원본을 어디에도 두지 않습니다.
3. **이메일**: `{식별자}@{가상도메인}-demo.co.kr` 형식만. 실제 도메인 금지.
4. **사업자등록번호**: `123-**-*****` 마스킹 형태.
5. **비밀정보 금지**: API 키·토큰·비밀번호를 시드에 넣지 않습니다.
6. **결정론적 생성**: 고정 시드 PRNG를 사용해 `node tools/gen-seed.js`가 항상 동일한 데이터를 만듭니다. 화면 스크린샷과 문서가 어긋나지 않아야 합니다.
7. **기준일 고정**: `TODAY = 2026-08-24`. 모든 상대 날짜는 이 값에서 계산합니다.

### 11.2 볼륨 계획

| 엔티티 | 건수 | 비고 |
|---|---:|---|
| `teams` | 4 | 영업 3팀 + 크리에이티브 제작본부 1 |
| `users` | 23 | 관리자 1 · 영업관리자 3 · 영업사원 8 · 리소스매니저 1 · 제작인력 10 |
| `accounts` | 42 | Key 6 · Major 10 · Growth 16 · Long-tail 10. 그중 계열사 관계 4쌍 |
| `contacts` | 106 | 광고주당 2~4명. 각 광고주에 대표 담당자 1명 필수 |
| `leads` | 26 | 상태 분포: 신규 8 · 접촉 시도 6 · 접촉 완료 5 · 적격 4 · 부적격 2 · 전환됨 1 |
| `products` | 24 | 검색 5 · 디스플레이 5 · 동영상 4 · SNS 4 · 커머스 3 · 제작 3 |
| `priceBooks` | 3 | 표준(`isStandard`) · 대형광고주 · 연간계약 |
| `priceBookEntries` | 72 | 24상품 × 3단가표. 대형광고주 −8%, 연간계약 −12% |
| `mediaChannels` | 16 | 매체 마스터 |
| `opportunities` | 223 | 오픈 88 · 수주 96 · 실주 39. 최근 18개월 분포 |
| `opportunityLines` | 650 | 기회당 1~5개. 오픈 기회의 70%는 라인 보유 |
| `quotes` | 45 | 견적·협상 이상 단계 기회의 60%. 그중 12건은 v2 이상 |
| `quoteLines` | 150 | |
| `contracts` | 30 | 수주 기회의 31%. 그중 7건은 D-60 이내 만료(갱신 인사이트 유발용) |
| `campaigns` | 47 | 집행중 18 · 종료 24 · 집행예정 5 |
| `activities` | 1,150 | 최근 6개월. 30%는 기한 초과 또는 오늘 예정 |
| `tickets` | 120 | 접수대기 12 · 검토 8 · 배정됨 14 · 진행중 22 · 검수 11 · 수정요청 7 · 보류 5 · 완료 38 · 취소 3 |
| `ticketComments` | 260 | 티켓당 0~6개 |
| `ticketHistory` | 480 | 전이마다 1행 |
| `resourceRequests` | 48 | 대기 9 · 가배정 5 · 승인 4 · 배정완료 24 · 반려 4 · 취소 2 |
| `assignments` | 78 | |
| `timesheets` | 420 | 최근 8주 × 제작인력 10명 |
| `targets` | 286 | 사용자 13명(영업) × 22개월 + 팀 목표 |
| `actuals` | 130 | 임시저장 8 · 제출 14 · 확정 104 · 반려 4 |
| `approvals` | 34 | 대기 9 · 승인 19 · 반려 4 · 회수 2 |
| `notes` | 60 | |
| `notifications` | 40 | 미읽음 11 |
| `auditLogs` | 90 | 최근 30일 |
| `competitors` | 7 | 가상 대행사명 |
| `listViews` | 12 | 객체별 기본 뷰 |

### 11.3 가상 어휘 사전

**광고주(조어 42개 예시)**: 노바커머스 · 비오라코스메틱 · 다온헬스 · 루미너스뷰티 · 그린테이블 · 아틀라스금융 · 코드플로우 · 하이브리즈 · 세라핀랩 · 온다모빌리티 · 미르게임즈 · 픽셀런 · 브릭앤코 · 소울웨이브 · 유니크에듀 · 클라우드릿 · 포레스트푸드 · 넥스트리테일 · 하모니트래블 · 아쿠아라인 · 베로나패션 …
**금지**: 실존 기업명, 실존 브랜드명, 실존 인물명 유사 표기.

**인물명**: 흔한 성씨 + 흔한 이름 조합으로 무작위 생성하되, 중복을 허용하지 않습니다. 실존 유명인과 동일한 조합이 나오면 재생성합니다.

**매체 채널 16종**: 통합검색 광고 · 쇼핑검색 광고 · 브랜드검색 · 파워컨텐츠 · 성과형 디스플레이 · 배너 네트워크 · 리타게팅 DA · 프리미엄 지면 · 인스트림 영상 · 아웃스트림 영상 · 숏폼 영상 · 피드 SNS · 스토리 SNS · 커머스 제휴 · 오픈마켓 광고 · 제작·크리에이티브

**경쟁 대행사(가상 7)**: 메디아링크 · 애드브릿지 · 퍼포먼스온 · 크리에이트랩 · 채널메이커 · 그로스팩토리 · 원티드미디어

**업종 12종**: §3.3 표와 동일.

### 11.4 데이터 형상(반드시 만족할 것)

시드는 단순히 개수를 채우는 게 아니라 **모든 인사이트 규칙이 최소 1회 발화되도록** 설계합니다.

| 보장 조건 | 목적(발화 규칙) |
|---|---|
| 정체 딜(허용 체류일 초과) ≥ 5건 | `stalled` |
| 마감일 경과 오픈 딜 ≥ 4건 | `overdue-close` |
| 30일 무활동 오픈 딜 ≥ 6건 | `no-activity` |
| 실주 사유 중 1위가 40% 이상 | `loss-reason` |
| 특정 경쟁사에 90일 내 3건 실주 | `competitor-rising` |
| `lossReason` 누락 실주 2건 | `loss-missing-reason` |
| 상위 5개 광고주 비중 60% 이상 | `concentration` |
| 건강도 40 미만 광고주 3곳 | `at-risk` |
| 45일 무접촉 거래중 광고주 5곳 | `silent-account` |
| D-60 이내 만료 + 갱신 기회 없는 계약 3건 | `renewal` |
| 7일 초과 무접촉 리드 5건 | `cold-leads` |
| 대기 승인 9건 중 2건은 마감 D-14 딜 연결 | `approval-wait` / `approval-blocking` |
| SLA 초과 티켓 6건, 임박 4건 | `sla-breach` |
| 미배정 티켓 12건(최고 경과 40시간) | `unassigned` |
| 완료 티켓 재작업률 30% 이상 | `rework` |
| 티켓 납기 > 딜 마감일 인 케이스 3건 | `ticket-vs-close` |
| 가동률 100% 초과 인력 2명, 60% 미만 3명 | `overloaded` / `idle` |
| ROAS 200% 미만 집행중 캠페인 4건 | `roas-low` |
| 소진 페이스 1.2배 초과 2건, 0.8배 미만 3건 | `pace-overspend` |
| 지난달 수주 있으나 실적 미입력 사용자 2명 | `actual-missing` |
| 목표 100% 달성 사용자 1명 | `quota-hit` |
| 커버리지 3배 미만 사용자 다수, 3배 이상 1명 | `coverage-low` / `coverage-ok` |

### 11.5 시간축 분포

- **과거 18개월**: 수주/실주 이력, 실적, 캠페인 종료 건. 계절성 반영 — 3월·9월(상·하반기 예산 집행) 피크, 1월·8월 저점.
- **현재 ±30일**: 집행 중 캠페인, 열린 티켓, 대기 승인, 이번 주 타임시트.
- **미래 90일**: 오픈 딜의 마감 예정일, 갱신 임박 계약, 예정 활동.
- **영업일 준수**: 활동·마감일·타임시트는 주말과 한국 공휴일을 피합니다.

### 11.6 금액 스케일 (한국 광고대행사 현실 반영)

| 구분 | 범위 |
|---|---|
| Key 광고주 연 예산 | 8억 ~ 30억원 |
| Major 광고주 연 예산 | 2억 ~ 8억원 |
| Growth 광고주 연 예산 | 5천만 ~ 2억원 |
| Long-tail 연 예산 | 1천만 ~ 5천만원 |
| 딜 금액(취급고) | 1천만 ~ 5억원, 중앙값 약 6천만원 |
| 대행 수수료율 | 매체 10~20%(기본 15), 제작 25~35% |
| 순매출 | 취급고의 12~20% |
| 월 목표(AE) | 5천만 ~ 1.5억원 |
| 제작 상품 단가 | 영상 800만~3천만 · 디자인 150만~600만 · LP 500만~1,500만 |

금액은 십만원 단위로 반올림해 현실감을 줍니다.

### 11.7 생성기 구현 요구사항 (`tools/gen-seed.js`)

- 결정론적 PRNG(고정 시드) 사용. `Math.random()` 직접 호출 금지.
- 출력: `assets/js/seed.js`에 `window.CLOSER_SEED = {...}` 한 줄. 상단 주석에 엔티티별 건수와 "가상 데이터 · 전화번호 마스킹" 고지를 남깁니다.
- 참조 무결성 검증: 모든 FK가 실제 존재하는 ID를 가리키는지 생성 후 자체 검사하고, 실패 시 비정상 종료합니다.
- `tools/verify.js`는 §11.4의 **보장 조건 전체**를 체크해 하나라도 불만족이면 실패를 보고합니다.

---

## 12. 추가 클론 기능 목록

갭 분석에서 도출된 항목을 우선순위와 함께 정리합니다. **must**는 이번 빌드 범위, **should**는 다음 반복, **nice**는 여력이 있을 때.

### 12.1 P0 — 일상 동작인데 빠져 있던 것

| # | 기능 | 우선순위 | 핵심 메커니즘 | 왜 필요한가 |
|---:|---|---|---|---|
| 1 | **홈 어시스턴트(Assistant)** | **must** | 기한초과 할 일 · 7일 미접촉 리드 · 30일 무활동 딜 · 마감 경과 딜을 하나의 우선순위 목록으로 밀어줌 | 시스템이 사용자에게 일을 **밀어주는** 유일한 지점. 없으면 CRM은 입력 창고가 됨 |
| 2 | **할 일 작업면(Task 큐)** | **must** | `activities.html`의 기한초과/오늘/예정 3분할, 일괄 완료·재배정, 후속 할 일 생성 | 타임라인은 읽기용. 실행 큐가 따로 필요 |
| 3 | **알림 엔진** | **must** | `Notification` + 벨 트레이 + 딥링크 + 읽음 처리 + 심각도. 승인·배정·멘션·SLA·마감임박 5종 트리거 | 승인·SLA·페이싱 경보가 전부 전달 계층을 전제로 함 |
| 4 | **캘린더 뷰** | **should** | `activities.html` 월/주 뷰, Event 블록·Task 칩, 드래그 일정 변경, 객체 캘린더(티켓 납기·캠페인 시작일) | 광고주 미팅·촬영 일정·납기가 핵심 업무인데 달력이 없음 |
| 5 | **이메일 템플릿·발송 로그** | **should** | 템플릿 + 병합 필드 + 레코드에서 발송 → `Activity(type='email')` 자동 기록 | 제안·견적 메일이 타임라인에 남아야 접촉 이력이 완성됨 |
| 6 | **사용자 생명주기 관리** | **must** | 비활성화(삭제 금지) + **레코드 이관 마법사**(광고주/딜/티켓 일괄 이관) + 감사 로그 | AE 퇴사·이동 시 담당 광고주와 미결 건이 고아가 됨 |
| 7 | **다중 통화 + 일자별 환율** | **nice** | `currencyIsoCode` + `DatedConversionRate`. 딜 마감일 기준 환율 적용 | 해외 매체(USD) 집행 시 마진이 재현 불가능해짐 |
| 8 | **레코드 복제(Clone with Related)** | **should** | 영업기회를 품목까지 복제, 캠페인 월별 복제 | 월별·재계약 딜 생성이 가장 잦은 반복 작업 |

### 12.2 P1 — 주요 Sales Cloud 기능

| # | 기능 | 우선순위 | 핵심 메커니즘 |
|---:|---|---|---|
| 9 | **레코드 병합(Merge)** | **must** | Account/Contact/Lead 최대 3건 선택 → 마스터 지정 → 필드별 라디오 선택 → 자식 레코드 재부모화 → 패자는 휴지통. 감사 로그 필수 |
| 10 | **중복 관리 규칙** | **must** | 일치 규칙(사업자번호 완전일치 = 차단 / 상호 유사 = 경고) + 저장 시 중복 배너 + 비교 보기 |
| 11 | **대량 작업(Mass Transfer/Update)** | **must** | 조건 기반 소유자 일괄 변경(열린 딜·티켓 동반 이관 옵션), 일괄 삭제, 일괄 상태 변경. 선택 상한 200행 |
| 12 | **가져오기/내보내기 UX** | **should** | CSV 드래그 → **컬럼 매핑 화면** → 외부 ID로 매칭(upsert) → 미리보기 → 오류 행 CSV. **인코딩 선택(UTF-8 BOM / EUC-KR)** 필수 |
| 13 | **휴지통 · 복원** | **must** | `deletedAt` 소프트 삭제 + 15일 보관 + 내 휴지통/전체 휴지통 + 관계 포함 복원 |
| 14 | **상품 스케줄(월별 안분)** | **should** | `OpportunityLineSchedule` — 라인 금액을 집행 월로 분할. 월별 인식·월별 정산의 엔진 |
| 15 | **담당자 다중 소속** | **should** | `AccountContactRelation`(역할·기간·직접/간접). 한 담당자가 계열사 3곳을 담당하는 현실 |
| 16 | **영역(Territory) 관리** | **nice** | 업종/매체/지역 기준 배정 규칙 + 재배분 시뮬레이션(Planning/Active 모델) |
| 17 | **결재자 경험 보강** | **must** | 미결함 일괄 승인 · 대결(위임) · 부재중 자동 위임 · 정체 결재 리마인드 |
| 18 | **검색 심화(한국어)** | **should** | 최근 항목 · 객체별 결과 탭 · **초성 검색** · 공백 무시 · 영/한 브랜드명 동의어. `LIKE '%x%'` 단순 구현 금지 |
| 19 | **파일 버전 관리** | **should** | 산출물 v1→v2 동일 문서 ID 유지, `최종 승인` 플래그, 미리보기, 만료되는 공유 링크 |
| 20 | **개인정보·수신동의 계층** | **must** | `optInMarketing` 채널×목적별 동의, 마스킹 규칙, 조회 감사 로그, 내보내기 시 자동 마스킹 |

### 12.3 P2 — 교차 관심사

| # | 기능 | 우선순위 | 핵심 메커니즘 |
|---:|---|---|---|
| 21 | **키보드·접근성·한글 IME** | **must** | `?` 단축키 오버레이, 테이블 방향키 이동·Enter 편집·Esc 취소, 모달 포커스 트랩, WCAG AA 대비, **IME 조합 중 이벤트 발생 금지**(조회 필드·검색창의 확정적 버그원) |
| 22 | **목록 페이지네이션·서버측 정렬** | **must** | 전 행 렌더 금지. 청크 로딩 + 행 수 상한 표시. (교정: Lightning 목록은 무한 스크롤이 아니라 청크 로딩입니다) |
| 23 | **인쇄용 뷰 / PDF 출력** | **should** | 견적서·제안서 인쇄 레이아웃, 한글 폰트 임베드 |
| 24 | **환경·설정 배포** | **nice** | 설정(레이아웃·단계·SLA·권한)을 JSON으로 내보내기/가져오기 |
| 25 | **한도·보존 정책** | **should** | 감사 로그·활동 보존 기간, 목록 상한, 대용량 테이블 사전 집계 |
| 26 | **예측 제출 이력** | **should** | 주차별 Commit 스냅샷 저장 → 예측 정확도 스코어보드. 관리자가 측정되는 유일한 지표 |
| 27 | **주간 파이프라인 스냅샷** | **must** | 매주 월요일 파이프라인 상태 적재 → "지난주 대비 무엇이 바뀌었나" 워터폴. 현재 상태만으로는 계산 불가 |
| 28 | **외부 연동 계약(자격증명 주입)** | **nice** | 매체 실적 수집을 위한 커넥터 정의. **키는 절대 저장하지 않고** 주입식 자격증명 참조만 보관. 재시도·백필·정정(광고 매체는 어제 수치를 사후 수정함) 규칙 명시 |
| 29 | **광고주 포털(외부 뷰)** | **nice** | 성과 리포트·견적 승인의 광고주 열람 전용 링크(만료·비밀번호) |
| 30 | **AI 어시스턴트 계층** | **nice** | 레코드 컨텍스트 기반 초안 생성(브리프 요약·월간 리포트 초안). 생성물은 **항상 편집 가능한 초안**으로 열고, PII를 마스킹해 전달하며, 프롬프트/응답을 감사 로그에 남김 |

### 12.4 기존 연구 자료에 대한 교정 2건

1. **목록 뷰는 단일 페이지가 아닙니다.** 현대 Lightning 목록은 청크 단위로 지연 로딩하고 행 수 상한을 둡니다. 광고주 5만 행을 한 번에 렌더하는 구현은 브라우저를 죽입니다. **페이지네이션과 서버측(로컬 인덱스) 정렬·필터를 명시적으로 구현합니다.**
2. **`Opportunity.amount`의 읽기전용 롤업 규칙은 단가표 고정 및 상품 스케줄과 함께 서술되어야 합니다.** 라인이 존재하면 롤업이라는 규칙만 구현하고 월별 스케줄(#14)을 빼면, 월별 인식 금액과 `amount`가 영원히 맞지 않습니다.

### 12.5 구현 순서 권고

```
1차(핵심 요구 6종)   : 데이터 모델 → 셸/IA → 파이프라인 칸반 → 영업기회 상세 → 광고주 360
                       → 제작 티켓 보드/상세 → 공수 신청·배정·히트맵 → 내 실적 입력
                       → 지표 엔진 → 인사이트 35종 → 홈
2차(P0 보강)         : 알림 엔진 · 어시스턴트 · 할 일 큐 · 승인함 보강 · 사용자 이관
                       · 휴지통 · 대량 작업 · 병합/중복
3차(P1)              : 캘린더 · 리포트 빌더 · 상품 스케줄 · 파일 버전 · 한국어 검색
                       · 주간 스냅샷 · 예측 제출 이력
4차(P2/nice)         : 다중 통화 · 영역 관리 · 포털 · AI 초안 · 연동 커넥터
```

---

## 부록 A. 용어 사전 (한↔영)

| 한국어 | 시스템 필드/개념 | Salesforce 대응 |
|---|---|---|
| 광고주 | `Account` | Account |
| 광고주 담당자 | `Contact` | Contact |
| 리드 / 가망 광고주 | `Lead` | Lead |
| 영업기회 / 딜 | `Opportunity` | Opportunity |
| 취급고 | `Opportunity.amount` | Amount (gross billing) |
| 순매출 | `Opportunity.netRevenue` | (커스텀) 대행 수수료 기준 |
| 단계 | `stage` | StageName |
| 예측 구분 | `forecastCategory` | Forecast Category |
| 견적 | `Quote` | Quote |
| 계약 | `Contract` | Contract |
| 집행 캠페인 | `Campaign` | (커스텀 Ad Campaign) |
| 제작 의뢰 | `Ticket` | Case + Jira Issue |
| 공수 신청 | `ResourceRequest` | PSA Resource Request |
| 투입 배정 | `Assignment` | PSA Assignment |
| 타임시트 | `Timesheet` | PSA Timecard |
| 목표 / 쿼터 | `Target` | ForecastingQuota |
| 실적 | `Actual` | (커스텀) |
| 승인 / 결재 | `Approval` | Approval Process |
| 가동률 | 가동률 % | Utilization |
| 파이프라인 커버리지 | `coverage` | Pipeline Coverage |

## 부록 B. 상태값 전체 목록 (하드코딩 금지, 이 표가 원본)

| 객체 | 필드 | 값 |
|---|---|---|
| Opportunity | `stage` | 리드확보 · 니즈파악 · 제안준비 · 제안·PT · 견적·협상 · 내부승인 · 계약체결 · 실주 |
| Opportunity | `forecastCategory` | Pipeline · Best Case · Commit · Closed · Omitted |
| Opportunity | `type` | 신규 · 기존 확대 · 갱신 · 재계약 |
| Opportunity | `lossReason` | 예산 삭감 · 경쟁사 선정 · 내부 대행 전환 · 집행 시기 연기 · 단가 미합의 · 담당자 교체 · 기타 |
| Lead | `status` | 신규 · 접촉 시도 · 접촉 완료 · 적격 · 부적격 · 전환됨 |
| Account | `status` | 잠재 · 거래중 · 휴면 · 이탈 |
| Account | `tier` | Key · Major · Growth · Long-tail |
| Quote | `status` | 작성중 · 승인대기 · 승인 · 반려 · 발송 · 수락 · 거절 · 만료 |
| Contract | `status` | 초안 · 승인대기 · 유효 · 만료 · 해지 |
| Campaign | `status` | 집행예정 · 집행중 · 일시중지 · 종료 |
| Ticket | `status` | 접수대기 · 검토 · 배정됨 · 진행중 · 검수 · 수정요청 · 보류 · 완료 · 취소 |
| Ticket | `type` | 영상제작 · 광고기획 · 디자인 · 랜딩페이지 · 카피 · 성과분석 |
| Ticket | `priority` | P1 긴급 · P2 높음 · P3 보통 · P4 낮음 |
| ResourceRequest | `status` | 대기 · 가배정 · 승인 · 반려 · 배정완료 · 취소 |
| Assignment | `status` | 예정 · 진행중 · 완료 · 취소 |
| Timesheet | `status` | 임시저장 · 제출 · 승인 · 반려 |
| Actual | `status` | 임시저장 · 제출 · 확정 · 반려 |
| Approval | `status` | 대기 · 승인 · 반려 · 회수 |
| Activity | `status` | 예정 · 진행중 · 완료 · 취소 |
| User | `role` | 영업사원 · 영업관리자 · 제작인력 · 리소스매니저 · 관리자 |

---

*문서 끝. 이 사양과 다른 구현은 defect로 간주합니다.*

