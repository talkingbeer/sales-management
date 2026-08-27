/* CLOSER · domain.js — the business rules.
 * Salesforce's Sales Process, Path, Forecast Categories, Approval Process and
 * Service Cloud case lifecycle, re-cut for a Korean digital-advertising agency.
 * Pages read these tables; nothing hard-codes a stage name.
 */
(function (w) {
  'use strict';
  var C = w.CLOSER, U = C.util, db = C.db;
  var D = {};

  /* ══ 영업 파이프라인 — Salesforce Path ═══════════════════════════════
     order · 확률 · 예측 카테고리 · 진입 조건 · 이 단계에서 반드시 채워야 할 필드 */
  D.STAGES = [
    { key: '리드확보', order: 1, prob: 10, cast: 'Pipeline',
      guide: '광고주 담당자와 첫 접점을 확보하고, 예산 집행 시점을 확인합니다.',
      requires: ['accountId', 'ownerId'],
      exit: '의사결정 라인과 예산 규모를 파악했다.' },
    { key: '니즈파악', order: 2, prob: 20, cast: 'Pipeline',
      guide: '캠페인 목표(KPI), 예산, 집행 시기, 경쟁 대행사를 확인합니다.',
      requires: ['closeDate', 'amount'],
      exit: 'KPI와 예산 범위가 문서로 확인됐다.' },
    { key: '제안준비', order: 3, prob: 35, cast: 'Pipeline',
      guide: '미디어믹스를 설계하고 필요한 제작물(영상·디자인·LP)을 티켓으로 의뢰합니다.',
      requires: ['contactId'],
      exit: '미디어플랜 초안과 제작 리소스 확보 계획이 있다.' },
    { key: '제안·PT', order: 4, prob: 50, cast: 'Best Case',
      guide: '광고주에게 제안하고 피드백을 기록합니다. 경쟁 상황을 남기세요.',
      requires: ['nextStep'],
      exit: '제안 발표를 마치고 광고주 피드백을 받았다.' },
    { key: '견적·협상', order: 5, prob: 70, cast: 'Best Case',
      guide: '견적을 발행하고 단가·수수료율·집행 기간을 협의합니다.',
      requires: ['amount', 'closeDate'],
      exit: '합의된 금액의 견적 버전이 존재한다.' },
    { key: '내부승인', order: 6, prob: 85, cast: 'Commit',
      guide: '할인율이 승인 기준을 넘으면 승인 요청을 제출합니다.',
      requires: [],
      exit: '할인 승인 및 계약서 검토가 끝났다.' },
    { key: '계약체결', order: 7, prob: 100, cast: 'Closed', won: true,
      guide: '계약을 등록하고 집행 캠페인을 생성합니다.',
      requires: ['amount', 'closeDate'],
      exit: '계약서가 날인되고 계약 레코드가 생성됐다.' },
    { key: '실주', order: 8, prob: 0, cast: 'Omitted', lost: true,
      guide: '실주 사유를 반드시 남깁니다. 실주 사유는 다음 분기 전략의 재료입니다.',
      requires: ['lossReason'],
      exit: '실주 사유와 경쟁사가 기록됐다.' }
  ];
  D.OPEN_STAGES = D.STAGES.filter(function (s) { return !s.won && !s.lost; });
  D.stage = function (key) {
    for (var i = 0; i < D.STAGES.length; i++) if (D.STAGES[i].key === key) return D.STAGES[i];
    return D.STAGES[0];
  };
  D.stageIndex = function (key) { return D.stage(key).order - 1; };
  D.isOpen = function (opp) { var s = D.stage(opp.stage); return !s.won && !s.lost; };
  D.isWon = function (opp) { return !!D.stage(opp.stage).won; };
  D.isLost = function (opp) { return !!D.stage(opp.stage).lost; };
  /** 가중 파이프라인 = 금액 × 단계 확률 */
  D.weighted = function (opp) { return (opp.amount || 0) * D.stage(opp.stage).prob / 100; };

  D.FORECAST_CASTS = ['Pipeline', 'Best Case', 'Commit', 'Closed', 'Omitted'];

  /** 단계가 오래 머물면 정체. 단계별 허용 체류일. */
  D.STAGE_MAX_DAYS = { 리드확보: 14, 니즈파악: 14, 제안준비: 10, '제안·PT': 12, '견적·협상': 14, 내부승인: 7 };
  D.daysInStage = function (opp) { return U.days(opp.stageEnteredAt || opp.createdAt, C.today); };
  D.isStalled = function (opp) {
    if (!D.isOpen(opp)) return false;
    var cap = D.STAGE_MAX_DAYS[opp.stage] || 14;
    return D.daysInStage(opp) > cap;
  };
  D.isOverdue = function (opp) { return D.isOpen(opp) && U.days(opp.closeDate, C.today) > 0; };

  D.OPP_TYPES = ['신규', '기존 확대', '갱신', '재계약'];
  D.LOSS_REASONS = ['예산 삭감', '경쟁사 선정', '내부 대행 전환', '집행 시기 연기', '단가 미합의', '담당자 교체', '기타'];
  D.LEAD_SOURCES = ['인바운드 문의', '전시·세미나', '기존 광고주 소개', '콜드 아웃바운드', '파트너 소개', '웹사이트', '리타게팅 캠페인'];
  D.LEAD_STATUS = ['신규', '접촉 시도', '접촉 완료', '적격', '부적격', '전환됨'];
  D.ACCOUNT_TIERS = ['Key', 'Major', 'Growth', 'Long-tail'];
  D.INDUSTRIES = ['이커머스', '뷰티', '헬스케어', '금융', '교육', '게임', '식음료', '패션', '여행', '모빌리티', 'B2B SaaS', '유통'];

  /* ══ 제작 의뢰 티켓 — Jira 워크플로 + Service Cloud SLA ═════════════ */
  D.TICKET_TYPES = [
    { key: '영상제작',   role: '영상편집자',   baseHours: 24, slaHours: 96 },
    { key: '광고기획',   role: '광고기획자',   baseHours: 12, slaHours: 48 },
    { key: '디자인',     role: '그래픽디자이너', baseHours: 10, slaHours: 48 },
    { key: '랜딩페이지', role: '퍼블리셔',     baseHours: 20, slaHours: 96 },
    { key: '카피',       role: '카피라이터',   baseHours: 6,  slaHours: 24 },
    { key: '성과분석',   role: '데이터분석가', baseHours: 8,  slaHours: 48 }
  ];
  D.ticketType = function (k) {
    for (var i = 0; i < D.TICKET_TYPES.length; i++) if (D.TICKET_TYPES[i].key === k) return D.TICKET_TYPES[i];
    return D.TICKET_TYPES[0];
  };

  D.TICKET_STATUS = ['접수대기', '검토', '배정됨', '진행중', '검수', '수정요청', '완료', '보류', '취소'];
  D.TICKET_OPEN = ['접수대기', '검토', '배정됨', '진행중', '검수', '수정요청', '보류'];
  /** 상태 전이표 — 여기 없는 이동은 UI에서 제공하지 않습니다. */
  D.TICKET_FLOW = {
    접수대기: ['검토', '취소'],
    검토:     ['배정됨', '보류', '취소'],
    배정됨:   ['진행중', '보류', '취소'],
    진행중:   ['검수', '보류'],
    검수:     ['완료', '수정요청'],
    수정요청: ['진행중'],
    보류:     ['검토', '진행중', '취소'],
    완료:     [],
    취소:     []
  };
  /** 누가 그 전이를 할 수 있는가. requester=의뢰자, assignee=담당자, manager=리소스매니저 */
  D.TICKET_ACTOR = {
    검토: ['manager'], 배정됨: ['manager'], 진행중: ['assignee'],
    검수: ['assignee'], 완료: ['requester', 'manager'], 수정요청: ['requester'],
    보류: ['assignee', 'manager'], 취소: ['requester', 'manager']
  };

  D.PRIORITIES = [
    { key: 'P1', label: '긴급', slaFactor: 0.4 },
    { key: 'P2', label: '높음', slaFactor: 0.7 },
    { key: 'P3', label: '보통', slaFactor: 1 },
    { key: 'P4', label: '낮음', slaFactor: 1.6 }
  ];
  D.slaHoursFor = function (t) {
    var base = D.ticketType(t.type).slaHours;
    var p = D.PRIORITIES.filter(function (x) { return x.key === t.priority; })[0] || D.PRIORITIES[2];
    return Math.round(base * p.slaFactor);
  };
  /** 약속한 납기(dueDate) 마감까지 남은 시간. 음수면 위반.
      SLA 시계는 접수 시각이 아니라 광고주와 합의한 납기를 기준으로 돈다 —
      제작 일정은 협의로 정해지고, 지켜야 하는 것은 그 약속이기 때문이다. */
  D.dueMoment = function (t) { return t.dueDate ? new Date(t.dueDate + 'T18:00:00') : null; };
  D.slaRemaining = function (t) {
    if (t.status === '완료' || t.status === '취소') return null;
    var due = D.dueMoment(t);
    if (!due) return null;
    return Math.round((due - C.today) / 3600000);
  };
  D.slaState = function (t) {
    var r = D.slaRemaining(t);
    if (r === null) return 'done';
    if (r < 0) return 'breach';
    if (r < D.slaHoursFor(t) * 0.3) return 'risk';
    return 'ok';
  };
  /** 완료된 건이 납기를 넘겨 끝났는가 — 준수율 계산에 함께 들어간다. */
  D.wasLate = function (t) {
    if (t.status !== '완료' || !t.doneAt || !t.dueDate) return false;
    return new Date(t.doneAt) > D.dueMoment(t);
  };

  /* ══ 공수(리소스) 신청 ══════════════════════════════════════════════ */
  D.RESOURCE_ROLES = ['영상편집자', '모션디자이너', '그래픽디자이너', '퍼블리셔', '프론트엔드개발자', '광고기획자', '카피라이터', '데이터분석가'];
  D.REQUEST_STATUS = ['대기', '승인', '반려', '배정완료', '취소'];
  /** 1인 기준 주간 가용 공수. 회의·리서치 버퍼 15%를 제외한 실가동 시간.
      사용자별 weeklyCapacity가 있으면 그 값이 우선한다. */
  D.WEEKLY_CAPACITY = 34;
  D.capacityOf = function (user) { return (user && user.weeklyCapacity) || D.WEEKLY_CAPACITY; };

  /** 상태별 WIP 한도 — 넘으면 보드 헤더가 경고한다. 동시에 붙잡고 있는 일이
      많아질수록 리드타임은 길어진다. */
  D.WIP_LIMITS = { 검토: 6, 배정됨: 8, 진행중: 10, 검수: 6, 수정요청: 5 };

  /**
   * 공수 신청에 대한 후보 적합도(0–100).
   * 직무 일치 45 · 스킬 매칭 30 · 가용 여력 25. 왜 이 사람이 1순위인지
   * 화면에서 그대로 설명할 수 있도록 항목별 점수를 함께 돌려준다.
   */
  D.matchScore = function (user, req) {
    var parts = [];
    var roleFit = user.craft === req.roleNeeded ? 45 : 0;
    parts.push({ label: '직무 일치', got: roleFit, max: 45, note: user.craft || '—' });

    var need = req.skillsNeeded || [];
    var have = (user.skills || []).reduce(function (m, s) { m[s.name] = s.level; return m; }, {});
    var hit = need.filter(function (n) { return have[n]; });
    var lvl = hit.reduce(function (a, n) { return a + have[n]; }, 0);
    var skillFit = need.length ? Math.round((hit.length / need.length) * 18 + Math.min(12, lvl * 2)) : 18;
    parts.push({ label: '스킬 매칭', got: skillFit, max: 30, note: need.length ? hit.join(', ') || '없음' : '요구 스킬 미지정' });

    var u = D.utilization(user.id, req.startDate || C.today, req.endDate || U.addDays(C.today, 14));
    var rate = u.capacity ? u.hours / u.capacity : 0;
    var free = Math.round(U.clamp((1 - rate), 0, 1) * 25);
    parts.push({ label: '가용 여력', got: free, max: 25, note: Math.round(rate * 100) + '% 가동 중' });

    return { score: roleFit + skillFit + free, parts: parts, utilization: Math.round(rate * 100) };
  };

  D.utilization = function (resourceId, from, to) {
    var asg = db.where('assignments', function (a) {
      return a.resourceId === resourceId && a.status !== '취소' &&
        !(U.days(a.endDate, from) > 0 || U.days(to, a.startDate) > 0);
    });
    var weeks = Math.max(1, U.days(from, to) / 7);
    return { hours: U.sum(asg, 'hours'), capacity: D.capacityOf(db.get('users', resourceId)) * weeks, count: asg.length };
  };

  /* ══ 승인 프로세스 ═══════════════════════════════════════════════════
     할인율 구간별 승인자 단계. Salesforce Approval Process의 축소판. */
  D.DISCOUNT_RULES = [
    { max: 10, approver: null,          label: '승인 불필요' },
    { max: 20, approver: '영업관리자',   label: '팀장 승인' },
    { max: 30, approver: '관리자',       label: '본부장 승인' },
    { max: 100, approver: '관리자',      label: '본부장 승인 + 마진 검토' }
  ];
  D.approvalFor = function (discountPct) {
    for (var i = 0; i < D.DISCOUNT_RULES.length; i++) if (discountPct <= D.DISCOUNT_RULES[i].max) return D.DISCOUNT_RULES[i];
    return D.DISCOUNT_RULES[D.DISCOUNT_RULES.length - 1];
  };
  D.APPROVAL_STATUS = ['대기', '승인', '반려', '회수'];

  /* ══ 실적 입력 ══════════════════════════════════════════════════════ */
  D.ACTUAL_KINDS = ['신규 수주', '기존 확대', '갱신', '추가 집행'];
  D.ACTUAL_STATUS = ['임시저장', '제출', '확정'];

  /* ══ 매체 · 광고상품 ════════════════════════════════════════════════ */
  D.MEDIA_GROUPS = ['검색', '디스플레이', '동영상', 'SNS', '커머스', '제작'];

  /* ══ 권한 매트릭스 ══════════════════════════════════════════════════
     역할 × 객체 → 허용 동작. UI는 여기만 보고 버튼을 감춥니다. */
  D.ROLES = ['영업사원', '영업관리자', '제작인력', '리소스매니저', '관리자'];
  var ALL = 'CRUD', RU = 'RU', R = 'R', CRU = 'CRU';
  D.PERMS = {
    영업사원:     { accounts: CRU, opportunities: ALL, quotes: CRU, contracts: R,  tickets: CRU, resourceRequests: CRU, actuals: CRU, targets: R, users: R,  reports: R, admin: '' },
    /* 팀장도 Key 광고주를 직접 담당한다 — 자기 실적을 스스로 입력할 수 있어야 한다. */
    영업관리자:   { accounts: ALL, opportunities: ALL, quotes: ALL, contracts: RU, tickets: CRU, resourceRequests: RU,  actuals: ALL, targets: ALL, users: R, reports: R, admin: '' },
    제작인력:     { accounts: R,   opportunities: R,   quotes: '',  contracts: '', tickets: RU,  resourceRequests: R,   actuals: '',  targets: '',  users: R, reports: R, admin: '' },
    리소스매니저: { accounts: R,   opportunities: R,   quotes: '',  contracts: '', tickets: ALL, resourceRequests: ALL, actuals: '',  targets: R,   users: RU, reports: R, admin: '' },
    관리자:       { accounts: ALL, opportunities: ALL, quotes: ALL, contracts: ALL, tickets: ALL, resourceRequests: ALL, actuals: ALL, targets: ALL, users: ALL, reports: ALL, admin: ALL }
  };
  /** can('opportunities','U') — 현재 사용자 기준. */
  D.can = function (object, action, user) {
    var u = user || db.me();
    if (!u) return false;
    var row = D.PERMS[u.role] || {};
    return (row[object] || '').indexOf(action) > -1;
  };

  /* ══ 광고주 건강도 ══════════════════════════════════════════════════
     최근 활동 · 집행 추세 · 미결 이슈로 0–100. 이유를 함께 돌려줍니다. */
  D.accountHealth = function (acc) {
    var reasons = [], score = 70;
    var lastAct = acc.lastActivityDate ? U.days(acc.lastActivityDate, C.today) : 999;
    if (lastAct <= 7) { score += 10; reasons.push('최근 7일 내 접촉'); }
    else if (lastAct > 45) { score -= 22; reasons.push(lastAct + '일간 접촉 없음'); }
    else if (lastAct > 21) { score -= 10; reasons.push(lastAct + '일간 접촉 없음'); }

    var camps = db.where('campaigns', function (c) { return c.accountId === acc.id; });
    var running = camps.filter(function (c) { return c.status === '집행중'; });
    if (running.length) { score += 8; reasons.push('집행 중 캠페인 ' + running.length + '건'); }
    else if (camps.length) { score -= 12; reasons.push('현재 집행 중인 캠페인 없음'); }

    var open = db.where('opportunities', function (o) { return o.accountId === acc.id && D.isOpen(o); });
    if (open.length) { score += 6; reasons.push('진행 중 영업기회 ' + open.length + '건'); }

    var lost = db.where('opportunities', function (o) { return o.accountId === acc.id && D.isLost(o) && U.days(o.closeDate, C.today) < 120; });
    if (lost.length >= 2) { score -= 14; reasons.push('최근 4개월 실주 ' + lost.length + '건'); }

    var breach = db.where('tickets', function (t) { return t.accountId === acc.id && D.slaState(t) === 'breach'; });
    if (breach.length) { score -= 9; reasons.push('SLA 초과 제작 건 ' + breach.length + '건'); }

    return { score: U.clamp(Math.round(score), 0, 100), reasons: reasons };
  };

  /* ══ 파생 지표 ══════════════════════════════════════════════════════ */
  D.oppAmount = function (oppId) {
    var lines = db.linesOf(oppId);
    if (!lines.length) return null;
    return U.sum(lines, function (l) { return l.qty * l.unitPrice * (1 - (l.discountPct || 0) / 100) * (l.months || 1); });
  };
  /** 대행 수수료 기준 순매출. 매체비는 취급고(gross)로만 잡습니다. */
  D.netRevenue = function (opp) {
    var lines = db.linesOf(opp.id);
    if (!lines.length) return opp.netRevenue || Math.round((opp.amount || 0) * 0.15);
    return Math.round(U.sum(lines, function (l) {
      var p = db.get('products', l.productId) || {};
      var gross = l.qty * l.unitPrice * (1 - (l.discountPct || 0) / 100) * (l.months || 1);
      return gross * ((p.commissionRate !== undefined ? p.commissionRate : 15) / 100);
    }));
  };

  C.domain = D;
})(window);
