/* CLOSER · tools/gen-seed.js
 * Deterministic demo-data generator. Run:  node tools/gen-seed.js
 * Writes assets/js/seed.js (window.CLOSER_SEED).
 *
 * Every company, person and campaign below is invented. Phone numbers are
 * masked (010-****-####) and e-mail uses fictional domains — the demo must not
 * carry anything that looks like a real person's contact details.
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* ── deterministic PRNG so every run produces the identical dataset ──── */
let _s = 0x9e3779b9;
function rnd() {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n) => { const c = arr.slice(); const o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };
const chance = p => rnd() < p;
const round = (n, unit) => Math.round(n / unit) * unit;

/* ── the clock ───────────────────────────────────────────────────────── */
const TODAY = new Date(2026, 7, 24);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isoT = (d, h = 10, m = 0) => `${iso(d)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ym = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const dayOf = n => addDays(TODAY, n);

/* ══ vocabulary ═══════════════════════════════════════════════════════ */
const SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍', '전', '고', '문', '손', '배', '백', '허', '남'];
const GIVEN = ['지훈', '서연', '민준', '수아', '도현', '하윤', '준서', '지우', '시윤', '채원', '건우', '유진', '태윤', '소율', '현우', '다은', '재원', '나연', '동현', '가은', '성민', '주하', '승우', '지안', '예린', '상우', '민서', '규현', '보람', '태경', '연우', '세훈', '하람', '지환'];
const usedNames = new Set();
function personName() {
  for (let i = 0; i < 80; i++) {
    const n = pick(SUR) + pick(GIVEN);
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
  }
  return pick(SUR) + pick(GIVEN) + ri(1, 9);
}
const maskPhone = () => `010-****-${String(ri(1000, 9999))}`;
const maskMobileShort = () => `02-****-${String(ri(1000, 9999))}`;

/* 가공 회사명 — 실재 브랜드와 겹치지 않도록 합성어로 만든 가상의 광고주 */
const ADVERTISERS = [
  ['노바커머스', '이커머스'], ['루미에르뷰티', '뷰티'], ['한결헬스케어', '헬스케어'],
  ['메이플에듀', '교육'], ['블루하버금융', '금융'], ['픽셀리그', '게임'],
  ['온담식품', '식음료'], ['하이라인패션', '패션'], ['윈드로드트래블', '여행'],
  ['모빗모빌리티', '모빌리티'], ['스택소프트', 'B2B SaaS'], ['그린바스켓', '유통'],
  ['테라뷰티랩', '뷰티'], ['닥터슬립', '헬스케어'], ['코어핏', '헬스케어'],
  ['빈스트릿커피', '식음료'], ['아르코리빙', '유통'], ['셀렉티드샵', '이커머스'],
  ['퍼스트무브', 'B2B SaaS'], ['라온키즈', '교육'], ['미드나잇스튜디오', '게임'],
  ['클리어페이', '금융'], ['보노핏', '헬스케어'], ['에코라인', '유통'],
  ['소울베이커리', '식음료'], ['벨로시티스포츠', '패션'], ['하버뷰호텔스', '여행'],
  ['제로웨이스트클럽', '유통'], ['뉴런에이아이', 'B2B SaaS'], ['달빛책방', '교육'],
  ['플레이보드', '게임'], ['써클렌즈랩', '뷰티'], ['모던홈퍼니처', '유통'],
  ['패스트런', '모빌리티'], ['하모니덴탈', '헬스케어'], ['컬러팔레트', '뷰티'],
  ['오션프레시', '식음료'], ['스텝업아카데미', '교육'], ['빅웨이브게임즈', '게임'],
  ['세이프가드보험', '금융'], ['어반라이더', '모빌리티'], ['포레스트리빙', '유통']
];

const MEDIA = [
  ['통합검색 광고', '검색'], ['쇼핑검색 광고', '검색'], ['브랜드검색', '검색'],
  ['디스플레이 네트워크', '디스플레이'], ['리타게팅 DA', '디스플레이'], ['프로그래매틱 DSP', '디스플레이'],
  ['인스트림 영상', '동영상'], ['숏폼 영상', '동영상'], ['커넥티드TV', '동영상'],
  ['소셜 피드 광고', 'SNS'], ['소셜 스토리 광고', 'SNS'], ['인플루언서 시딩', 'SNS'],
  ['커머스 배너', '커머스'], ['라이브커머스 송출', '커머스'],
  ['로컬 타깃 광고', 'SNS'], ['메신저 광고', 'SNS']
];

const PRODUCTS = [
  ['통합검색 키워드 운영', '검색', 'mc01', '월', 8000000, 15],
  ['쇼핑검색 광고 운영', '검색', 'mc02', '월', 6500000, 15],
  ['브랜드검색 집행', '검색', 'mc03', '월', 4200000, 12],
  ['디스플레이 네트워크 운영', '디스플레이', 'mc04', '월', 9500000, 17],
  ['리타게팅 DA 운영', '디스플레이', 'mc05', '월', 5400000, 18],
  ['프로그래매틱 DSP 운영', '디스플레이', 'mc06', '월', 14000000, 14],
  ['유튜브 인스트림 집행', '동영상', 'mc07', '월', 12000000, 13],
  ['숏폼 광고 집행', '동영상', 'mc08', '월', 7800000, 16],
  ['CTV 브랜딩 집행', '동영상', 'mc09', '월', 22000000, 11],
  ['소셜 피드 퍼포먼스', 'SNS', 'mc10', '월', 8800000, 18],
  ['소셜 스토리 캠페인', 'SNS', 'mc11', '월', 5200000, 18],
  ['인플루언서 시딩 패키지', 'SNS', 'mc12', '건', 18000000, 22],
  ['커머스 배너 집행', '커머스', 'mc13', '월', 6800000, 16],
  ['라이브커머스 송출', '커머스', 'mc14', '건', 15000000, 20],
  ['로컬 타깃 광고 운영', 'SNS', 'mc15', '월', 3600000, 20],
  ['메신저 광고 운영', 'SNS', 'mc16', '월', 7400000, 17],
  ['브랜드 영상 제작 (60초)', '제작', null, '건', 24000000, 38],
  ['숏폼 3편 패키지', '제작', null, '건', 9600000, 42],
  ['상세페이지 디자인', '제작', null, '건', 4400000, 45],
  ['랜딩페이지 제작', '제작', null, '건', 7200000, 44],
  ['배너 크리에이티브 세트', '제작', null, '건', 3200000, 46],
  ['광고 기획·전략 컨설팅', '제작', null, '월', 5000000, 55],
  ['퍼포먼스 리포팅 대시보드', '제작', null, '월', 2600000, 50],
  ['통합 미디어플랜 수립', '제작', null, '건', 6000000, 52]
];

const COMPETITORS = ['메디아링크', '퍼스트애드', '온에어파트너스', '그로스랩', '애드브릿지', '넥스트리치', '(인하우스 전환)'];

const TITLES = ['마케팅팀장', '퍼포먼스 마케터', '브랜드 매니저', '이커머스 팀장', 'CMO', '광고 담당', '커머스 MD', '콘텐츠 매니저', '사업개발 팀장', '대표'];
const DEPTS = ['마케팅본부', '커머스본부', '브랜드전략팀', '디지털마케팅팀', '경영지원', '사업개발'];

const CAMPAIGN_THEMES = ['여름 시즌 프로모션', '신규 가입 확보', '브랜드 인지도 캠페인', '리텐션 리마케팅', '신제품 론칭', '블랙프라이데이 프리세일', '앱 설치 캠페인', '오프라인 매장 유입', '구독 전환 캠페인', '재구매 유도', '상반기 브랜딩', '지역 타깃 확장'];

const TICKET_TITLES = {
  영상제작: ['메인 브랜드 필름 60초 편집', '숏폼 3종 편집 (세로형)', '제품 언박싱 영상 제작', '고객 인터뷰 영상 편집', '유튜브 인스트림 15초 컷 제작', '라이브커머스 하이라이트 편집'],
  광고기획: ['하반기 미디어믹스 설계', '경쟁사 광고 소재 분석', '신규 제안 전략 수립', '타깃 페르소나 재정의', '캠페인 KPI 설계', 'PT 덱 구성안 작성'],
  디자인: ['상세페이지 디자인 1종', 'DA 배너 세트 12종', '소셜 피드 카드뉴스 6종', '이벤트 페이지 비주얼', '브랜드 키비주얼 리터치', '스토리 광고 소재 4종'],
  랜딩페이지: ['프로모션 랜딩페이지 제작', '이벤트 응모 페이지 개발', '앱 다운로드 LP 반응형 작업', '리드폼 랜딩 제작', '구독 신청 페이지 개편'],
  카피: ['광고 카피 20종 작성', '랜딩 히어로 카피 리라이팅', '이메일 시퀀스 카피', '숏폼 자막 카피 작성'],
  성과분석: ['월간 성과 리포트 작성', '캠페인 A/B 테스트 분석', '전환 경로 분석 리포트', 'ROAS 개선안 도출']
};

const ACT_SUBJECTS = {
  call: ['킥오프 콜', '예산 확인 통화', '제안 피드백 통화', '집행 일정 조율', '단가 협의 통화'],
  email: ['제안서 발송', '견적서 회신', '미디어플랜 공유', '리포트 발송', '계약서 초안 전달'],
  meeting: ['광고주 대면 미팅', '제안 PT', '분기 성과 리뷰', '킥오프 미팅', '계약 조건 협의'],
  task: ['미디어플랜 초안 작성', '경쟁사 조사', '제작 의뢰서 작성', '견적 산출', '내부 승인 요청']
};

/* ══ output containers ════════════════════════════════════════════════ */
const S = {
  teams: [], users: [], accounts: [], contacts: [], leads: [], opportunities: [],
  opportunityLines: [], products: [], quotes: [], quoteLines: [], contracts: [],
  campaigns: [], activities: [], tickets: [], ticketComments: [], ticketHistory: [],
  resourceRequests: [], assignments: [], timesheets: [], targets: [], actuals: [],
  approvals: [], notes: [], notifications: [], auditLogs: [], competitors: [],
  mediaChannels: [], listViews: []
};

/* ── media channels & products ──────────────────────────────────────── */
MEDIA.forEach((m, i) => S.mediaChannels.push({ id: `mc${String(i + 1).padStart(2, '0')}`, name: m[0], group: m[1] }));
PRODUCTS.forEach((p, i) => S.products.push({
  id: `p${String(i + 1).padStart(2, '0')}`, name: p[0], category: p[1], channelId: p[2],
  unit: p[3], listPrice: p[4], commissionRate: p[5], active: true,
  note: p[1] === '제작' ? '제작 상품은 순매출 인식률이 높습니다.' : '매체비는 취급고, 수수료만 순매출로 인식합니다.'
}));
COMPETITORS.forEach((c, i) => S.competitors.push({ id: `cm${String(i + 1).padStart(2, '0')}`, name: c, note: '' }));

/* ── teams & users ──────────────────────────────────────────────────── */
S.teams.push({ id: 't1', name: '미디어세일즈 1팀', kind: '영업' });
S.teams.push({ id: 't2', name: '미디어세일즈 2팀', kind: '영업' });
S.teams.push({ id: 't3', name: '퍼포먼스 그로스팀', kind: '영업' });
S.teams.push({ id: 't4', name: '크리에이티브 제작본부', kind: '제작' });

function addUser(id, role, teamId, extra) {
  const name = personName();
  const u = Object.assign({
    id, name, initials: name.slice(-2), role, teamId,
    email: `${id}@closer-demo.co.kr`, phone: maskPhone(),
    hireDate: iso(dayOf(-ri(300, 2200))), active: true
  }, extra || {});
  S.users.push(u);
  return u;
}
const admin = addUser('u01', '관리자', 't1', { title: '세일즈 본부장' });
const lead1 = addUser('u02', '영업관리자', 't1', { title: '1팀장' });
const lead2 = addUser('u03', '영업관리자', 't2', { title: '2팀장' });
const lead3 = addUser('u04', '영업관리자', 't3', { title: '그로스팀장' });
S.teams[0].leaderId = lead1.id; S.teams[1].leaderId = lead2.id; S.teams[2].leaderId = lead3.id;

const reps = [];
[['u05', 't1'], ['u06', 't1'], ['u07', 't1'], ['u08', 't2'], ['u09', 't2'], ['u10', 't2'], ['u11', 't3'], ['u12', 't3']]
  .forEach(([id, team]) => reps.push(addUser(id, '영업사원', team, { title: 'AE' })));

const resourceMgr = addUser('u13', '리소스매니저', 't4', { title: '제작본부 PM' });
S.teams[3].leaderId = resourceMgr.id;

/* 직무별 보유 스킬 — 공수 배정 시 후보 추천의 근거가 된다.
   직무만으로 사람을 고르면 "영상편집자 아무나"가 되고, 그건 배정이 아니다. */
const SKILL_POOL = {
  영상편집자: ['프리미어', '애프터이펙트', '컬러그레이딩', '숏폼 편집', '자막·타이포'],
  모션디자이너: ['애프터이펙트', '3D 모션', '타이포 모션', '로고 애니메이션', '인포그래픽'],
  그래픽디자이너: ['상세페이지', '배너 세트', '키비주얼', '포토 리터치', '브랜드 가이드'],
  퍼블리셔: ['반응형 퍼블리싱', '웹접근성', 'GA4 연동', '랜딩 최적화', '이메일 HTML'],
  프론트엔드개발자: ['React', '리드폼 연동', 'A/B 테스트', '성능 최적화', '트래킹 스크립트'],
  광고기획자: ['미디어믹스', '경쟁 분석', 'KPI 설계', 'PT 덱', '타깃 세그먼트'],
  카피라이터: ['광고 카피', '랜딩 카피', '이메일 시퀀스', 'SNS 톤', '스크립트'],
  데이터분석가: ['GA4', '전환 경로 분석', 'ROAS 모델링', '대시보드', 'A/B 통계']
};
const makers = [];
[['u14', '영상편집자'], ['u15', '영상편집자'], ['u16', '모션디자이너'], ['u17', '그래픽디자이너'],
 ['u18', '그래픽디자이너'], ['u19', '퍼블리셔'], ['u20', '프론트엔드개발자'], ['u21', '광고기획자'],
 ['u22', '카피라이터'], ['u23', '데이터분석가']]
  .forEach(([id, craft]) => makers.push(addUser(id, '제작인력', 't4', {
    title: craft, craft,
    skills: pickN(SKILL_POOL[craft], ri(3, 4)).map(name => ({ name, level: ri(2, 5) })),
    weeklyCapacity: pick([30, 34, 34, 34, 36, 28])
  })));

const salesUsers = reps.concat([lead1, lead2, lead3]);

/* ── accounts ───────────────────────────────────────────────────────── */
ADVERTISERS.forEach(([name, industry], i) => {
  const id = `a${String(i + 1).padStart(2, '0')}`;
  const tier = i < 6 ? 'Key' : i < 16 ? 'Major' : i < 30 ? 'Growth' : 'Long-tail';
  /* Key 광고주는 팀장이 직접 물고 간다 — 실제 대행사의 계정 배분과 같다. */
  const owner = tier === 'Key' ? [lead1, lead2, lead3][i % 3] : reps[i % reps.length];
  const firstDeal = dayOf(-ri(120, 1400));
  S.accounts.push({
    id, name, industry, tier, ownerId: owner.id,
    website: `www.${['nova', 'lume', 'hangyeol', 'maple', 'bluehb', 'pixel', 'ondam', 'highline', 'windroad', 'mobit',
      'stacksoft', 'greenbasket', 'terabl', 'drsleep', 'corefit', 'beanst', 'arco', 'selected', 'firstmove', 'raonkids',
      'midnight', 'clearpay', 'bonofit', 'ecoline', 'soulbake', 'velocity', 'harborview', 'zerowaste', 'neuron', 'moonbook',
      'playboard', 'circlens', 'modernhome', 'fastrun', 'harmony', 'palette', 'oceanfresh', 'stepup', 'bigwave', 'safeguard',
      'urbanrider', 'forestliv'][i]}-demo.co.kr`,
    phone: maskMobileShort(),
    address: pick(['서울 강남구', '서울 마포구', '서울 성동구', '경기 성남시 분당구', '서울 종로구', '서울 서초구', '부산 해운대구', '경기 고양시']),
    employees: pick([28, 45, 80, 120, 210, 340, 520, 850, 1200]),
    annualBudget: round(ri(3, 42) * 100000000, 10000000),
    status: chance(0.86) ? '거래중' : '휴면',
    firstDealDate: iso(firstDeal),
    /* 대부분의 광고주는 최근에 접촉했고, 일부만 오래 방치됐다.
       전부 방치 상태이면 "이탈 위험" 신호가 신호가 아니게 된다. */
    lastActivityDate: iso(dayOf(chance(0.72) ? -ri(0, 20) : chance(0.6) ? -ri(21, 44) : -ri(46, 95))),
    parentId: null,
    memo: ''
  });
});
/* 실제 CRM에는 반드시 중복이 있다. 상호 표기가 다르거나 같은 회사가 두 번
   등록된 경우를 몇 건 심어 두어야 중복 탐지·병합 기능이 할 일이 생긴다. */
[
  ['a01', '(주)노바 커머스', 'u06'],
  ['a02', '루미에르 뷰티', 'u07'],
  ['a12', '그린 바스켓', 'u09']
].forEach(([srcId, altName, ownerId], i) => {
  const src = S.accounts.find(a => a.id === srcId);
  S.accounts.push(Object.assign({}, src, {
    id: `a${43 + i}`,
    name: altName,
    ownerId,
    tier: 'Growth',
    annualBudget: round(src.annualBudget * 0.4, 10000000),
    status: '거래중',
    firstDealDate: iso(dayOf(-ri(30, 200))),
    lastActivityDate: iso(dayOf(-ri(5, 60))),
    parentId: null,
    memo: '영업 담당자가 별도로 등록한 건으로 보입니다. 병합 검토 필요.'
  }));
});
[
  ['데일리 핏', 'dailyfit-demo.co.kr'],
  ['코지 홈', 'cozyhome-demo.co.kr']
].forEach(([company, dom], i) => {
  S.leads.push({
    id: `l${27 + i}`, name: personName(), company,
    title: pick(TITLES), email: `contact@${dom}`, phone: maskPhone(),
    source: '웹사이트', status: '접촉 시도', score: ri(30, 70),
    industry: pick(['헬스케어', '유통']), estBudget: round(ri(2, 8) * 10000000, 5000000),
    ownerId: pick(reps).id, createdAt: isoT(dayOf(-ri(2, 20)), 11),
    convertedOppId: null, memo: '기존 리드와 같은 회사일 수 있습니다.'
  });
});

/* one real parent/child hierarchy so the record page has something to show */
S.accounts[17].parentId = S.accounts[0].id;   // 셀렉티드샵 ← 노바커머스
S.accounts[35].parentId = S.accounts[1].id;   // 컬러팔레트 ← 루미에르뷰티

/* ── contacts ───────────────────────────────────────────────────────── */
let cIdx = 1;
S.accounts.forEach(acc => {
  const n = acc.tier === 'Key' ? 4 : acc.tier === 'Major' ? 3 : 2;
  for (let k = 0; k < n; k++) {
    const name = personName();
    S.contacts.push({
      id: `c${String(cIdx++).padStart(3, '0')}`,
      accountId: acc.id, name,
      title: k === 0 ? pick(['마케팅팀장', 'CMO', '이커머스 팀장']) : pick(TITLES),
      dept: pick(DEPTS),
      email: `contact${cIdx}@${acc.website.replace('www.', '')}`,
      phone: maskPhone(),
      ownerId: acc.ownerId,
      isPrimary: k === 0,
      decisionRole: k === 0 ? '의사결정자' : k === 1 ? '실무 담당' : pick(['영향력자', '실무 담당', '예산 승인자']),
      lastActivityDate: iso(dayOf(-ri(1, 90)))
    });
  }
});

/* ── leads ──────────────────────────────────────────────────────────── */
const LEAD_COMPANIES = ['비오라코스메틱', '스마트런에듀', '데일리핏', '오렌지박스', '한빛물류', '코지홈', '트윈피크게임즈',
  '실버라인케어', '퓨어워터', '어반팜', '넥스트북', '리버사이드리조트', '핏앤런', '골든아워스튜디오', '메이드바이핸드',
  '클라우드나인', '스노우베이커리', '드림트레이너', '포켓마켓', '라이트하우스랩', '허브앤코', '무브온모빌리티',
  '차밍뷰티', '심플리빙', '탑라인에듀', '위드펫'];
LEAD_COMPANIES.forEach((company, i) => {
  const created = dayOf(-ri(0, 60));
  const status = i < 5 ? '신규' : i < 9 ? '접촉 시도' : i < 15 ? '접촉 완료' : i < 20 ? '적격' : i < 23 ? '부적격' : '전환됨';
  S.leads.push({
    id: `l${String(i + 1).padStart(2, '0')}`,
    name: personName(), company,
    title: pick(TITLES),
    email: `hello@${['viora', 'smartlearn', 'dailyfit', 'orangebox', 'hanbit', 'cozyhome', 'twinpeak', 'silverline',
      'purewater', 'urbanfarm', 'nextbook', 'riverside', 'fitnrun', 'goldenhour', 'madebyhand', 'cloud9', 'snowbake',
      'dreamtrainer', 'pocketmarket', 'lighthouse', 'herbnco', 'moveon', 'charming', 'simpliving', 'topline', 'withpet'][i]}-demo.co.kr`,
    phone: maskPhone(),
    source: pick(['인바운드 문의', '전시·세미나', '기존 광고주 소개', '콜드 아웃바운드', '파트너 소개', '웹사이트', '리타게팅 캠페인']),
    status,
    score: ri(12, 96),
    industry: pick(['이커머스', '뷰티', '헬스케어', '교육', '식음료', '패션', '유통', 'B2B SaaS']),
    estBudget: round(ri(2, 20) * 10000000, 5000000),
    ownerId: pick(reps).id,
    createdAt: isoT(created, ri(9, 18), pick([0, 15, 30, 45])),
    convertedOppId: null,
    memo: status === '부적격' ? pick(['예산 미확보', '인하우스 운영 결정', '집행 시기 미정']) : ''
  });
});

/* ── opportunities ──────────────────────────────────────────────────── */
const STAGES = ['리드확보', '니즈파악', '제안준비', '제안·PT', '견적·협상', '내부승인'];
const STAGE_PROB = { 리드확보: 10, 니즈파악: 20, 제안준비: 35, '제안·PT': 50, '견적·협상': 70, 내부승인: 85, 계약체결: 100, 실주: 0 };
const CAST = { 리드확보: 'Pipeline', 니즈파악: 'Pipeline', 제안준비: 'Pipeline', '제안·PT': 'Best Case', '견적·협상': 'Best Case', 내부승인: 'Commit', 계약체결: 'Closed', 실주: 'Omitted' };
const LOSS = ['예산 삭감', '경쟁사 선정', '내부 대행 전환', '집행 시기 연기', '단가 미합의', '담당자 교체', '기타'];
const OPP_TYPES = ['신규', '기존 확대', '갱신', '재계약'];

let oIdx = 1, olIdx = 1;
function makeOpp(acc, mode) {
  const id = `o${String(oIdx++).padStart(2, '0')}`;
  const owner = S.users.find(u => u.id === acc.ownerId);
  const theme = pick(CAMPAIGN_THEMES);
  const type = mode === 'won' && chance(0.4) ? pick(['기존 확대', '갱신', '재계약']) : (chance(0.45) ? '신규' : pick(OPP_TYPES));
  let stage, createdAt, closeDate, lossReason = null, stageEnteredAt;

  /* 성사·실주는 최근 분기에 무게를 둔다 — 오늘 화면이 텅 비면 데모가 아니다. */
  if (mode === 'won') {
    stage = '계약체결';
    closeDate = dayOf(chance(0.48) ? -ri(1, 82) : -ri(83, 430));
    createdAt = addDays(closeDate, -ri(22, 96));
    stageEnteredAt = closeDate;
  } else if (mode === 'lost') {
    stage = '실주';
    closeDate = dayOf(chance(0.42) ? -ri(4, 82) : -ri(83, 400));
    createdAt = addDays(closeDate, -ri(18, 88));
    stageEnteredAt = closeDate;
    lossReason = pick(LOSS);
  } else {
    stage = pick(STAGES);
    createdAt = dayOf(-ri(4, 120));
    closeDate = dayOf(ri(-12, 95));
    stageEnteredAt = addDays(TODAY, -ri(1, 34));
  }

  /* 광고주 등급이 클수록 라인 수도 단가도 커진다 — Key 계정의 딜은 억 단위. */
  const tierScale = { Key: 1.9, Major: 1.35, Growth: 1.0, 'Long-tail': 0.7 }[acc.tier];
  const lineCount = acc.tier === 'Key' ? ri(3, 5) : acc.tier === 'Major' ? ri(2, 4) : ri(1, 3);
  const chosen = pickN(S.products, lineCount);
  let amount = 0;
  const pendingLines = chosen.map(p => {
    const months = p.unit === '월' ? pick([3, 3, 6, 6, 12]) : 1;
    const qty = p.unit === '건' ? ri(1, 3) : 1;
    const discountPct = chance(0.4) ? pick([5, 8, 10, 12, 15, 18, 22, 28]) : 0;
    const unitPrice = round(p.listPrice * tierScale * (0.85 + rnd() * 0.4), 100000);
    const value = Math.round(qty * unitPrice * (1 - discountPct / 100) * months);
    amount += value;
    return { productId: p.id, qty, unitPrice, discountPct, months, amount: value };
  });

  const opp = {
    id, name: `${acc.name} · ${theme}`, accountId: acc.id, ownerId: owner.id,
    stage, amount, probability: STAGE_PROB[stage], forecastCategory: CAST[stage],
    closeDate: iso(closeDate), createdAt: isoT(createdAt, ri(9, 18)),
    stageEnteredAt: isoT(stageEnteredAt, ri(9, 18)),
    type, source: pick(['인바운드 문의', '기존 광고주 소개', '콜드 아웃바운드', '파트너 소개', '전시·세미나']),
    competitorId: chance(0.5) ? pick(S.competitors).id : null,
    nextStep: mode === 'open' ? pick(['제안서 2차 수정 발송', '단가표 회신 대기', 'PT 일정 확정', '계약 조건 검토 요청', '샘플 소재 공유']) : '',
    lossReason,
    contactId: null,
    campaignId: null,
    teamIds: chance(0.3) ? [pick(makers).id] : []
  };
  const contactsOf = S.contacts.filter(c => c.accountId === acc.id);
  if (contactsOf.length) opp.contactId = contactsOf[0].id;
  S.opportunities.push(opp);
  pendingLines.forEach(l => S.opportunityLines.push(Object.assign({ id: `ol${String(olIdx++).padStart(3, '0')}`, oppId: id }, l)));
  return opp;
}

/* 42개 광고주에 걸쳐 성사 96 / 실주 40 / 진행 46 — 성사율 약 70%가 아니라
   현실적인 55~60% 대가 나오도록 배분한다. */
S.accounts.forEach(acc => {
  const wonN = acc.tier === 'Key' ? ri(4, 6) : acc.tier === 'Major' ? ri(3, 4) : acc.tier === 'Growth' ? ri(2, 3) : ri(1, 2);
  for (let i = 0; i < wonN; i++) makeOpp(acc, 'won');
  const lostN = acc.tier === 'Key' ? ri(2, 4) : acc.tier === 'Major' ? ri(2, 3) : acc.tier === 'Growth' ? ri(1, 2) : ri(0, 1);
  for (let i = 0; i < lostN; i++) makeOpp(acc, 'lost');
});
/* 진행 중 딜 — 절반의 광고주 + 리드 전환분 */
S.accounts.forEach((acc, i) => { if (i % 2 === 0 || acc.tier === 'Key') makeOpp(acc, 'open'); });
S.accounts.slice(0, 14).forEach(acc => makeOpp(acc, 'open'));

/* 전환된 리드를 실제 딜에 연결 */
S.leads.filter(l => l.status === '전환됨').forEach(l => {
  const o = pick(S.opportunities.filter(x => x.type === '신규'));
  if (o) l.convertedOppId = o.id;
});

/* 담당자마다 이번 달 성사 건이 최소 하나는 있게 분포를 손본다.
   실제로도 월말에 몰려 마감되지만, 0건인 달은 데모 화면을 죽인다. */
const curMonth = ym(TODAY);
salesUsers.forEach(u => {
  const mine = S.opportunities.filter(o => o.ownerId === u.id && o.stage === '계약체결');
  if (!mine.length || mine.some(o => ym(new Date(o.closeDate)) === curMonth)) return;
  const moved = mine.sort((a, b) => (a.closeDate < b.closeDate ? 1 : -1))[0];
  const nd = new Date(TODAY.getFullYear(), TODAY.getMonth(), ri(2, 22));
  moved.closeDate = iso(nd);
  moved.stageEnteredAt = isoT(nd, ri(9, 18));
  moved.createdAt = isoT(addDays(nd, -ri(22, 96)), ri(9, 18));
});

const wonOpps = S.opportunities.filter(o => o.stage === '계약체결');
const openOpps = S.opportunities.filter(o => STAGES.indexOf(o.stage) > -1);

/* ── quotes ─────────────────────────────────────────────────────────── */
let qIdx = 1, qlIdx = 1;
const quoteSource = openOpps.filter(o => ['견적·협상', '내부승인', '제안·PT'].indexOf(o.stage) > -1).concat(wonOpps.slice(0, 14));
quoteSource.forEach(o => {
  const versions = chance(0.35) ? 2 : 1;
  for (let v = 1; v <= versions; v++) {
    const lines = S.opportunityLines.filter(l => l.oppId === o.id);
    const discountTotal = Math.round(lines.reduce((a, l) => a + l.qty * l.unitPrice * l.months * (l.discountPct / 100), 0));
    const total = o.amount;
    const maxDiscount = Math.max(0, ...lines.map(l => l.discountPct));
    const id = `q${String(qIdx++).padStart(2, '0')}`;
    S.quotes.push({
      id, oppId: o.id, accountId: o.accountId, ownerId: o.ownerId,
      version: v, no: `Q-2026-${String(qIdx + 100)}`,
      status: v < versions ? '만료' : (o.stage === '계약체결' ? '수주' : chance(0.5) ? '발송' : '작성중'),
      total, discountTotal, maxDiscountPct: maxDiscount,
      createdAt: isoT(addDays(new Date(o.stageEnteredAt), -ri(2, 12)), ri(10, 17)),
      validUntil: iso(addDays(new Date(o.closeDate), 14)),
      approvedBy: maxDiscount > 10 && chance(0.6) ? lead1.id : null,
      terms: '집행 개시 전 50% 선금, 종료 후 30일 이내 잔금. 세금계산서는 매월 말일 발행.'
    });
    lines.forEach(l => {
      const p = S.products.find(x => x.id === l.productId);
      S.quoteLines.push({
        id: `ql${String(qlIdx++).padStart(3, '0')}`, quoteId: id, productId: l.productId,
        name: p.name, qty: l.qty, months: l.months, unitPrice: l.unitPrice,
        discountPct: l.discountPct, amount: l.amount, commissionRate: p.commissionRate
      });
    });
  }
});

/* ── contracts ──────────────────────────────────────────────────────── */
let ctIdx = 1;
wonOpps.slice(0, 30).forEach(o => {
  const start = addDays(new Date(o.closeDate), ri(3, 14));
  const term = pick([3, 6, 6, 12]);
  const end = new Date(start); end.setMonth(end.getMonth() + term);
  const active = end > TODAY;
  S.contracts.push({
    id: `ct${String(ctIdx++).padStart(2, '0')}`,
    no: `C-2026-${String(200 + ctIdx)}`,
    oppId: o.id, accountId: o.accountId, ownerId: o.ownerId,
    startDate: iso(start), endDate: iso(end), termMonths: term,
    amount: o.amount, status: active ? '유효' : '종료',
    autoRenew: chance(0.35),
    signedAt: iso(addDays(new Date(o.closeDate), ri(1, 6))),
    billingCycle: pick(['월 정산', '분기 정산', '집행 종료 후 일괄']),
    taxInvoice: pick(['매월 말일 발행', '집행 완료 후 발행'])
  });
});

/* ── campaigns ──────────────────────────────────────────────────────── */
let cpIdx = 1;
S.contracts.forEach(ct => {
  const n = ri(1, 2);
  for (let i = 0; i < n; i++) {
    const start = addDays(new Date(ct.startDate), ri(0, 20));
    const end = addDays(start, ri(28, 90));
    const budget = round(ct.amount / n * (0.6 + rnd() * 0.4), 1000000);
    const running = start <= TODAY && end >= TODAY;
    const done = end < TODAY;
    const progress = running ? Math.max(0.08, (TODAY - start) / (end - start)) : done ? 1 : 0;
    const spend = Math.round(budget * progress * (0.82 + rnd() * 0.35));
    /* 노출은 CPM(1,000회 노출당 단가)에서 나온다. 여기를 CPC처럼 계산하면
       노출이 수십억 건이 되고 ROAS가 십만 퍼센트로 튄다. */
    const cpm = pick([2200, 3400, 4800, 6500, 9000]);
    const impressions = Math.round(spend / cpm * 1000);
    const clicks = Math.round(impressions * (0.004 + rnd() * 0.018));
    const conversions = Math.round(clicks * (0.008 + rnd() * 0.035));
    const aov = ri(35000, 140000);
    /* 효율은 캠페인마다 갈린다 — 일부는 손익분기 아래로 떨어져야
       "효율 저조" 경고가 실제로 발화한다. */
    const revenue = Math.round(conversions * aov * (0.45 + rnd() * 1.1));
    S.campaigns.push({
      id: `cp${String(cpIdx++).padStart(2, '0')}`,
      name: `${S.accounts.find(a => a.id === ct.accountId).name} ${pick(CAMPAIGN_THEMES)}`,
      accountId: ct.accountId, contractId: ct.id, ownerId: ct.ownerId,
      channelId: pick(S.mediaChannels).id,
      startDate: iso(start), endDate: iso(end),
      status: running ? '집행중' : done ? '종료' : '예정',
      budget, spend: Math.min(spend, Math.round(budget * 1.08)),
      impressions, clicks, conversions, revenue,
      objective: pick(['전환', '트래픽', '인지도', '앱 설치', '리드 확보'])
    });
  }
});

/* ── activities ─────────────────────────────────────────────────────── */
let acIdx = 1;
function addActivity(relatedType, relatedId, ownerId, when, opts) {
  const type = (opts && opts.type) || pick(['call', 'email', 'meeting', 'task']);
  const done = when < TODAY;
  S.activities.push(Object.assign({
    id: `ac${String(acIdx++).padStart(3, '0')}`,
    type, subject: pick(ACT_SUBJECTS[type]),
    relatedType, relatedId, ownerId,
    dueDate: iso(when), doneAt: done ? isoT(when, ri(9, 19)) : null,
    status: done ? '완료' : '예정',
    priority: pick(['보통', '보통', '높음']),
    note: ''
  }, opts || {}));
}
S.opportunities.forEach(o => {
  const n = o.stage === '계약체결' ? ri(4, 8) : o.stage === '실주' ? ri(2, 5) : ri(1, 6);
  const base = new Date(o.createdAt);
  const span = Math.max(6, Math.round((new Date(o.closeDate) - base) / 86400000));
  for (let i = 0; i < n; i++) addActivity('opportunity', o.id, o.ownerId, addDays(base, Math.round(span * (i + 1) / (n + 1))));
});
/* 예정된 할 일 — 오늘 화면을 채운다. 일부는 기한을 넘긴 채로 남겨 둔다:
   기한 초과가 하나도 없는 CRM은 실제로는 존재하지 않고, 어시스턴트와
   활동 화면의 경고가 전부 0이 되면 그 화면은 아무것도 말하지 못한다. */
salesUsers.forEach(u => {
  const mine = S.opportunities.filter(o => o.ownerId === u.id && STAGES.indexOf(o.stage) > -1);
  pickN(mine, Math.min(6, mine.length)).forEach((o, i) => {
    const when = i < 2 ? dayOf(-ri(1, 9)) : i === 2 ? TODAY : dayOf(ri(1, 9));
    addActivity('opportunity', o.id, u.id, when, {
      status: '예정', doneAt: null, priority: i === 0 ? '높음' : '보통'
    });
  });
});
S.accounts.forEach(a => { for (let i = 0; i < ri(1, 3); i++) addActivity('account', a.id, a.ownerId, dayOf(-ri(1, 120))); });

/* ── tickets ────────────────────────────────────────────────────────── */
const TICKET_TYPE_KEYS = Object.keys(TICKET_TITLES);
const TYPE_ROLE = { 영상제작: '영상편집자', 광고기획: '광고기획자', 디자인: '그래픽디자이너', 랜딩페이지: '퍼블리셔', 카피: '카피라이터', 성과분석: '데이터분석가' };
const TYPE_HOURS = { 영상제작: 24, 광고기획: 12, 디자인: 10, 랜딩페이지: 20, 카피: 6, 성과분석: 8 };
/* domain.js의 D.TICKET_TYPES와 같은 값 — 납기 산정에 쓴다. */
const TYPE_SLA = { 영상제작: 96, 광고기획: 48, 디자인: 48, 랜딩페이지: 96, 카피: 24, 성과분석: 48 };
const STATUS_FLOW = ['접수대기', '검토', '배정됨', '진행중', '검수', '수정요청', '완료', '보류'];
let tkIdx = 1, tcIdx = 1, thIdx = 1;

function makeTicket(opp, forceStatus) {
  const type = pick(TICKET_TYPE_KEYS);
  const key = `PRD-${100 + tkIdx}`;
  const id = `tk${String(tkIdx++).padStart(2, '0')}`;
  const priority = chance(0.12) ? 'P1' : chance(0.3) ? 'P2' : chance(0.75) ? 'P3' : 'P4';
  const status = forceStatus || pick(['접수대기', '검토', '배정됨', '진행중', '진행중', '검수', '수정요청', '완료', '완료', '완료', '보류']);
  /* 날짜는 납기에서 거꾸로 잡는다. 접수일을 먼저 뿌리면 SLA가 전부 깨진
     데이터가 나오고, 그런 지표는 아무것도 알려주지 않는다.
     열린 건의 약 20%만 이미 납기를 넘긴 상태로 둔다. */
  const slaDays = Math.max(2, Math.round(TYPE_SLA[type] / 24 * (1.1 + rnd() * 1.3)));
  let created, dueD, doneD = null;
  if (status === '완료') {
    doneD = dayOf(-ri(2, 70));
    dueD = addDays(doneD, chance(0.26) ? -ri(1, 6) : ri(0, 4));   // 26%는 납기를 넘겨 납품됐다
    /* 접수는 납기에서 거꾸로 잡되, 납품보다 늦어지면 안 된다.
       납기가 납품보다 뒤인 경우 그대로 빼면 접수일이 납품일을 앞질러
       리드타임이 음수가 된다 — 실제로 그런 티켓이 7건 나왔다. */
    created = addDays(Math.min(dueD.getTime(), doneD.getTime()), -slaDays);
  } else if (status === '취소') {
    created = dayOf(-ri(10, 60));
    dueD = addDays(created, slaDays);
  } else {
    const AHEAD = {
      접수대기: [2, 9], 검토: [2, 10], 배정됨: [3, 13], 진행중: [1, 15],
      검수: [0, 8], 수정요청: [0, 6], 보류: [0, 12]
    }[status] || [1, 10];
    dueD = dayOf(chance(0.2) ? -ri(1, 6) : ri(AHEAD[0], AHEAD[1]));
    created = addDays(dueD, -slaDays);
    if (created > TODAY) created = dayOf(-ri(0, 1));
  }
  const craft = TYPE_ROLE[type];
  const pool = makers.filter(m => m.craft === craft);
  const assignee = status === '접수대기' || status === '검토' ? null : (pool.length ? pick(pool) : pick(makers));
  const est = Math.round(TYPE_HOURS[type] * (0.7 + rnd() * 0.9));
  const doneAt = doneD;
  const rework = status === '완료' && chance(0.3) ? ri(1, 2) : (status === '수정요청' ? 1 : 0);
  const acc = S.accounts.find(a => a.id === opp.accountId);

  S.tickets.push({
    id, key, type,
    title: pick(TICKET_TITLES[type]),
    description: `${acc.name} ${opp.name.split(' · ')[1] || '캠페인'} 건 제작 의뢰입니다.\n\n· 목적: ${pick(['신규 유입 확대', '전환율 개선', '브랜드 인지 강화', '재구매 유도'])}\n· 참고: 광고주 가이드라인 준수, 로고 최소 노출 규격 확인 필요\n· 산출물: ${type === '영상제작' ? '완성본 + 15초 컷 버전' : type === '디자인' ? '원본 + 리사이즈 세트' : '작업 파일 일체'}`,
    requesterId: opp.ownerId, assigneeId: assignee ? assignee.id : null,
    accountId: opp.accountId, oppId: opp.id,
    status, priority,
    estimateHours: est,
    spentHours: status === '완료' ? Math.round(est * (0.8 + rnd() * 0.6)) : status === '진행중' || status === '검수' ? Math.round(est * rnd() * 0.8) : 0,
    dueDate: iso(dueD),
    createdAt: isoT(created, ri(9, 18)),
    startedAt: ['진행중', '검수', '수정요청', '완료'].indexOf(status) > -1 ? isoT(addDays(created, ri(1, 5)), 10) : null,
    doneAt: doneAt ? isoT(doneAt, ri(14, 19)) : null,
    reworkCount: rework,
    labels: pickN(['시급', '광고주요청', '리소스부족', '재작업', '신규광고주', 'A/B테스트'], ri(0, 2)),
    watchers: [opp.ownerId].concat(assignee ? [assignee.id] : []),
    /* 산출물 버전 — 검수 단계부터 쌓이고, 완료 건은 마지막 버전이 승인본이다. */
    deliverables: ['검수', '수정요청', '완료'].indexOf(status) === -1 ? [] : (function () {
      const n = status === '완료' ? ri(1, 3) : ri(1, 2);
      const ext = type === '영상제작' ? 'mp4' : type === '랜딩페이지' ? 'zip' : type === '디자인' ? 'png' : 'pdf';
      const out = [];
      for (let v = 1; v <= n; v++) {
        out.push({
          version: 'v' + v,
          name: `${key}_${type}_v${v}.${ext}`,
          sizeMB: Math.round((type === '영상제작' ? ri(180, 1400) : ri(2, 48)) * 10) / 10,
          at: isoT(addDays(created, Math.max(1, Math.round(slaDays * v / (n + 1)))), ri(11, 19)),
          byId: assignee ? assignee.id : resourceMgr.id,
          approved: status === '완료' && v === n
        });
      }
      return out;
    })()
  });

  const t = S.tickets[S.tickets.length - 1];
  /* 상태 이력 */
  let cur = '접수대기', at = created;
  const idxTarget = STATUS_FLOW.indexOf(status) === -1 ? 3 : STATUS_FLOW.indexOf(status);
  for (let i = 1; i <= idxTarget; i++) {
    at = addDays(at, ri(1, 4));
    if (at > TODAY) break;
    S.ticketHistory.push({
      id: `th${String(thIdx++).padStart(3, '0')}`, ticketId: id, at: isoT(at, ri(9, 19)),
      actorId: i <= 2 ? resourceMgr.id : (assignee ? assignee.id : resourceMgr.id),
      field: 'status', from: cur, to: STATUS_FLOW[i]
    });
    cur = STATUS_FLOW[i];
  }
  /* 댓글 */
  const cN = ri(0, 4);
  for (let i = 0; i < cN; i++) {
    S.ticketComments.push({
      id: `tc${String(tcIdx++).padStart(3, '0')}`, ticketId: id,
      authorId: i % 2 === 0 ? opp.ownerId : (assignee ? assignee.id : resourceMgr.id),
      body: pick([
        '광고주 피드백 반영해서 컷 순서 조정 부탁드립니다.',
        '초안 공유드립니다. 확인 후 코멘트 주세요.',
        '로고 사용 가이드가 업데이트됐습니다. 최신 파일로 교체했습니다.',
        '일정상 이번 주 금요일까지 1차 시안 나올 수 있을까요?',
        '레퍼런스 3건 첨부했습니다. 톤앤매너는 두 번째가 가깝습니다.',
        '수정 반영 완료했습니다. 검수 부탁드립니다.',
        '광고주 측 검토가 하루 늦어진다고 합니다. 일정 조정 필요합니다.'
      ]),
      createdAt: isoT(addDays(created, ri(1, 14)), ri(9, 19))
    });
  }
  return t;
}
/* 진행 딜과 최근 성사 딜에 제작 의뢰를 건다. 보드가 비면 화면이 죽으므로
   진행 딜에는 넉넉히, 성사 딜에는 완료 이력 위주로 붙인다. */
openOpps.forEach(o => {
  const n = chance(0.35) ? 2 : 1;
  for (let i = 0; i < n; i++) makeTicket(o, i === 0 ? pick(['검토', '배정됨', '진행중', '진행중', '검수', '수정요청', '접수대기']) : undefined);
});
wonOpps.slice(0, 34).forEach(o => makeTicket(o, chance(0.78) ? '완료' : undefined));
/* 납기를 이미 넘긴 건을 몇 개 심어 SLA 인사이트가 근거를 갖게 한다 */
openOpps.slice(0, 3).forEach(o => {
  const t = makeTicket(o, '진행중');
  t.priority = 'P1';
  t.dueDate = iso(dayOf(-ri(2, 6)));
  t.labels = ['시급'];
});

/* ── resource requests & assignments ────────────────────────────────── */
let rrIdx = 1, asIdx = 1;
S.tickets.forEach(t => {
  if (['접수대기'].indexOf(t.status) > -1) return;
  if (!chance(0.72)) return;
  const role = TYPE_ROLE[t.type];
  const status = t.status === '검토' ? '대기' : chance(0.1) ? '반려' : t.assigneeId ? '배정완료' : '승인';
  const start = addDays(new Date(t.createdAt), ri(1, 6));
  const end = addDays(start, ri(3, 18));
  const hours = Math.round(t.estimateHours * (0.9 + rnd() * 0.35));
  const id = `rr${String(rrIdx++).padStart(2, '0')}`;
  S.resourceRequests.push({
    id, ticketId: t.id, requesterId: t.requesterId, roleNeeded: role,
    hours, startDate: iso(start), endDate: iso(end),
    status, approverId: resourceMgr.id,
    createdAt: isoT(addDays(new Date(t.createdAt), ri(0, 2)), ri(9, 18)),
    decidedAt: status === '대기' ? null : isoT(addDays(start, -1), ri(9, 18)),
    note: status === '반려' ? pick(['해당 주 캐파 초과 — 일정 조정 후 재신청 바랍니다.', '요청 공수가 산정 기준을 초과합니다. 범위 축소 필요.']) : '',
    reason: pick(['광고주 요청 일정 준수를 위해 필요합니다.', '제안 PT 일정에 맞춰야 합니다.', '집행 개시일 전 소재 완성 필요.']),
    skillsNeeded: pickN(SKILL_POOL[role] || [], ri(1, 2))
  });
  if (status === '배정완료' && t.assigneeId) {
    S.assignments.push({
      id: `as${String(asIdx++).padStart(2, '0')}`, requestId: id, ticketId: t.id,
      resourceId: t.assigneeId, hours, startDate: iso(start), endDate: iso(end),
      status: t.status === '완료' ? '완료' : '진행중'
    });
  }
});
/* 앞으로 4주 배정을 더 얹어 캐파 히트맵이 살아 있게 한다 */
makers.forEach(m => {
  const n = ri(1, 4);
  for (let i = 0; i < n; i++) {
    const start = dayOf(ri(-6, 20));
    const end = addDays(start, ri(3, 12));
    const t = pick(S.tickets.filter(x => x.assigneeId === m.id)) || pick(S.tickets);
    S.assignments.push({
      id: `as${String(asIdx++).padStart(2, '0')}`, requestId: null, ticketId: t.id,
      resourceId: m.id, hours: ri(6, 30), startDate: iso(start), endDate: iso(end),
      status: '진행중'
    });
  }
});

/* ── timesheets ─────────────────────────────────────────────────────── */
let tsIdx = 1;
makers.forEach(m => {
  for (let d = 30; d >= 0; d--) {
    const day = dayOf(-d);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    if (!chance(0.8)) continue;
    const mine = S.tickets.filter(t => t.assigneeId === m.id);
    if (!mine.length) continue;
    const entries = ri(1, 2);
    for (let e = 0; e < entries; e++) {
      const t = pick(mine);
      /* 주 단위로 제출·승인된다. 이번 주 것은 아직 작성 중이다. */
      const monday = addDays(day, -((day.getDay() + 6) % 7));
      const thisWeek = iso(monday) === iso(addDays(TODAY, -((TODAY.getDay() + 6) % 7)));
      S.timesheets.push({
        id: `ts${String(tsIdx++).padStart(3, '0')}`,
        resourceId: m.id, ticketId: t.id, date: iso(day),
        weekOf: iso(monday),
        hours: pick([2, 3, 4, 4, 5, 6, 8]) / entries,
        billable: chance(0.85),
        status: thisWeek ? '작성중' : chance(0.85) ? '승인' : '제출',
        note: ''
      });
    }
  }
});

/* ── targets & actuals ──────────────────────────────────────────────── */
let tgIdx = 1, atIdx = 1;
/* 목표는 허공에서 정하지 않는다. 최근 6개월 실적의 월평균에 담당자별 성장
   계수를 곱해 산출한다 — 그래서 달성률이 현실적인 대역(대략 70~120%)에 든다. */
const sixMonthsAgo = addDays(TODAY, -182);
const baseByUser = {};
salesUsers.forEach((u, i) => {
  const recentWon = S.opportunities.filter(o =>
    o.ownerId === u.id && o.stage === '계약체결' && new Date(o.closeDate) >= sixMonthsAgo);
  const monthly = recentWon.reduce((a, o) => a + o.amount, 0) / 6;
  const growthFactor = 0.92 + ((i * 7) % 5) * 0.075;   // 0.92 ~ 1.22, 담당자마다 다르게
  baseByUser[u.id] = Math.max(90000000, round(monthly * growthFactor, 5000000));
});

for (let back = 11; back >= -1; back--) {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - back, 1);
  const period = ym(d);
  salesUsers.forEach(u => {
    /* 과거 달은 목표가 조금 낮았다 — 매 분기 상향되는 게 보통이다. */
    const ramp = 1 - Math.max(0, back) * 0.012;
    S.targets.push({
      id: `tg${String(tgIdx++).padStart(3, '0')}`, ownerId: u.id, period, type: '매출',
      amount: round(baseByUser[u.id] * ramp, 5000000)
    });
    S.targets.push({
      id: `tg${String(tgIdx++).padStart(3, '0')}`, ownerId: u.id, period, type: '신규광고주',
      amount: u.role === '영업관리자' ? 4 : 2
    });
  });
}
/* 실적은 성사된 딜에서 자동 생성 + 이번 달은 일부러 임시저장/미제출을 남긴다 */
wonOpps.forEach(o => {
  const closed = new Date(o.closeDate);
  const period = ym(closed);
  const thisMonth = period === ym(TODAY);
  S.actuals.push({
    id: `at${String(atIdx++).padStart(3, '0')}`,
    ownerId: o.ownerId, period, accountId: o.accountId, oppId: o.id,
    amount: o.amount,
    netRevenue: Math.round(o.amount * (0.12 + rnd() * 0.12)),
    kind: o.type === '신규' ? '신규 수주' : o.type === '갱신' ? '갱신' : o.type === '기존 확대' ? '기존 확대' : '추가 집행',
    status: thisMonth ? (chance(0.5) ? '임시저장' : '제출') : '확정',
    enteredAt: isoT(addDays(closed, ri(0, 3)), ri(10, 18)),
    note: ''
  });
});

/* ── approvals ──────────────────────────────────────────────────────── */
let apIdx = 1;
S.quotes.filter(q => q.maxDiscountPct > 10).slice(0, 20).forEach(q => {
  const opp = S.opportunities.find(o => o.id === q.oppId);
  const requester = S.users.find(u => u.id === q.ownerId);
  const approver = requester.role === '영업관리자' ? admin : S.users.find(u => u.role === '영업관리자' && u.teamId === requester.teamId) || lead1;
  const status = opp.stage === '계약체결' ? '승인' : opp.stage === '실주' ? '회수' : chance(0.55) ? '대기' : chance(0.7) ? '승인' : '반려';
  const submitted = addDays(new Date(q.createdAt), ri(0, 3));
  S.approvals.push({
    id: `ap${String(apIdx++).padStart(2, '0')}`,
    objectType: 'quotes', objectId: q.id, oppId: q.oppId,
    kind: '할인 승인', step: q.maxDiscountPct > 20 ? '2차 (본부장)' : '1차 (팀장)',
    requesterId: requester.id, approverId: approver.id,
    status,
    submittedAt: isoT(submitted, ri(9, 18)),
    decidedAt: status === '대기' ? null : isoT(addDays(submitted, ri(1, 5)), ri(9, 18)),
    comment: status === '반려' ? '마진율이 기준선 아래입니다. 제작 상품 비중을 높여 재제출 바랍니다.' : status === '승인' ? '승인합니다. 집행 개시 후 마진 재확인 요청.' : '',
    detail: `할인율 ${q.maxDiscountPct}% · 견적 ${q.no} · 금액 ${q.total.toLocaleString('ko-KR')}원`
  });
});
/* 공수 신청 승인 건도 결재함에 올린다 */
S.resourceRequests.filter(r => r.status === '대기').slice(0, 8).forEach(r => {
  S.approvals.push({
    id: `ap${String(apIdx++).padStart(2, '0')}`,
    objectType: 'resourceRequests', objectId: r.id, oppId: null,
    kind: '공수 승인', step: '1차 (리소스매니저)',
    requesterId: r.requesterId, approverId: resourceMgr.id,
    status: '대기', submittedAt: r.createdAt, decidedAt: null, comment: '',
    detail: `${r.roleNeeded} ${r.hours}시간 · ${r.startDate} ~ ${r.endDate}`
  });
});

/* ── notes ──────────────────────────────────────────────────────────── */
let nIdx = 1;
S.accounts.slice(0, 24).forEach(a => {
  S.notes.push({
    id: `nt${String(nIdx++).padStart(2, '0')}`, relatedType: 'account', relatedId: a.id,
    authorId: a.ownerId,
    body: pick([
      '의사결정은 마케팅팀장 선에서 마무리되지만, 5천만 원 이상은 대표 결재가 필요합니다.',
      '분기 예산 확정이 매 분기 첫째 주에 이뤄집니다. 그 전 2주가 제안 적기입니다.',
      '작년 경쟁 PT에서 크리에이티브 완성도로 밀렸습니다. 이번엔 제작 역량을 앞세울 것.',
      '리포트는 주간 단위로 요구합니다. 자동화 대시보드 제공이 만족도에 크게 작용했습니다.',
      '내부 인하우스 팀이 생겨 검색 광고는 직접 운영합니다. 영상·디스플레이 위주로 접근.'
    ]),
    createdAt: isoT(dayOf(-ri(5, 200)), ri(10, 18))
  });
});

/* ── notifications ──────────────────────────────────────────────────── */
let nfIdx = 1;
function notify(userId, kind, text, link, daysAgo) {
  S.notifications.push({
    id: `nf${String(nfIdx++).padStart(2, '0')}`, userId, kind, text, link,
    at: isoT(dayOf(-daysAgo), ri(9, 19)), read: daysAgo > 3
  });
}
S.approvals.filter(a => a.status === '대기').slice(0, 6).forEach((a, i) => {
  notify(a.approverId, '승인', `${S.users.find(u => u.id === a.requesterId).name}님이 ${a.kind} 요청을 제출했습니다.`, 'approvals.html', i);
});
S.tickets.filter(t => t.status === '검수').slice(0, 5).forEach((t, i) => {
  notify(t.requesterId, '티켓', `${t.key} “${t.title}” 이 검수 대기 상태입니다.`, `ticket.html?id=${t.id}`, i);
});
S.tickets.filter(t => t.assigneeId && t.status === '배정됨').slice(0, 5).forEach((t, i) => {
  notify(t.assigneeId, '배정', `${t.key} 가 배정되었습니다. 마감 ${t.dueDate}.`, `ticket.html?id=${t.id}`, i);
});
openOpps.slice(0, 6).forEach((o, i) => {
  notify(o.ownerId, '딜', `“${o.name}” 마감일이 ${o.closeDate}로 다가옵니다.`, `opportunity.html?id=${o.id}`, i);
});

/* ── audit log ──────────────────────────────────────────────────────── */
let alIdx = 1;
S.opportunities.slice(0, 30).forEach(o => {
  S.auditLogs.push({
    id: `al${String(alIdx++).padStart(3, '0')}`, at: o.stageEnteredAt, actorId: o.ownerId,
    action: '변경', objectType: 'opportunities', objectId: o.id,
    detail: `stage: (이전 단계) → ${o.stage}`
  });
});
S.auditLogs.sort((a, b) => (a.at < b.at ? 1 : -1));

/* ── saved list views (Salesforce list view의 축소판) ────────────────── */
/* ── 이메일 템플릿 — 레코드에서 바로 보내고 활동으로 남긴다 ─────────── */
S.emailTemplates = [
  { id: 'et1', name: '첫 접촉 — 미팅 요청', folder: '영업', subject: '{{광고주}} 마케팅 담당자님께 — 미디어 제안 미팅 요청',
    body: '{{담당자}}님, 안녕하세요.\n{{광고주}}의 {{분기}} 미디어 운영과 관련해 30분만 시간을 내주실 수 있을까요.\n동종 업계에서 자주 쓰이는 매체 구성과, 최근 단가 흐름을 정리해 가겠습니다.\n\n{{보낸사람}} 드림' },
  { id: 'et2', name: '제안서 발송', folder: '영업', subject: '[{{광고주}}] 미디어 제안서 송부드립니다',
    body: '{{담당자}}님,\n말씀 주신 목표에 맞춰 미디어플랜과 예상 성과를 정리했습니다.\n첨부의 2안 중 어느 쪽이 가까운지 알려주시면 단가와 일정을 확정하겠습니다.\n\n{{보낸사람}} 드림' },
  { id: 'et3', name: '견적서 송부', folder: '거래', subject: '[{{광고주}}] 견적서 {{견적번호}} 송부',
    body: '{{담당자}}님,\n협의한 조건으로 견적서를 보내드립니다. 유효기간은 발행일로부터 14일입니다.\n집행 개시 전 50% 선금, 종료 후 30일 이내 잔금 조건입니다.\n\n{{보낸사람}} 드림' },
  { id: 'et4', name: '집행 개시 안내', folder: '운영', subject: '[{{광고주}}] {{캠페인}} 집행을 시작합니다',
    body: '{{담당자}}님,\n오늘부터 집행을 시작합니다. 주간 리포트는 매주 월요일 오전에 보내드립니다.\n소재 교체나 예산 조정이 필요하시면 언제든 말씀해 주세요.\n\n{{보낸사람}} 드림' },
  { id: 'et5', name: '주간 성과 리포트', folder: '운영', subject: '[{{광고주}}] {{캠페인}} 주간 리포트',
    body: '{{담당자}}님,\n지난 주 집행 결과를 정리해 보내드립니다.\n· 노출/클릭/전환 요약\n· 개선 제안 2건\n다음 주 운영안은 회신 주시는 대로 반영하겠습니다.\n\n{{보낸사람}} 드림' },
  { id: 'et6', name: '갱신 제안', folder: '영업', subject: '[{{광고주}}] 계약 만료 전 갱신 제안드립니다',
    body: '{{담당자}}님,\n현재 계약이 {{만료일}}에 종료됩니다. 이번 집행에서 확인된 효율을 바탕으로\n다음 기간 운영안을 정리했습니다. 검토 후 일정 잡아주시면 방문드리겠습니다.\n\n{{보낸사람}} 드림' },
  { id: 'et7', name: '제작 일정 안내', folder: '제작', subject: '[{{광고주}}] 제작 일정 공유',
    body: '{{담당자}}님,\n요청 주신 제작 건의 일정을 공유드립니다.\n· 1차 시안: {{시안일}}\n· 피드백 반영본: 시안 확인 후 3영업일\n· 최종 납품: {{납기일}}\n\n{{보낸사람}} 드림' }
];

S.listViews = [
  { id: 'lv1', object: 'opportunities', name: '내 진행 딜', filter: 'mine-open', shared: false },
  { id: 'lv2', object: 'opportunities', name: '이번 분기 마감', filter: 'closing-quarter', shared: true },
  { id: 'lv3', object: 'opportunities', name: '정체 딜', filter: 'stalled', shared: true },
  { id: 'lv4', object: 'accounts', name: '이탈 위험 광고주', filter: 'risk', shared: true },
  { id: 'lv5', object: 'accounts', name: 'Key 광고주', filter: 'key', shared: true },
  { id: 'lv6', object: 'tickets', name: '내 담당 의뢰', filter: 'assigned-me', shared: false },
  { id: 'lv7', object: 'tickets', name: 'SLA 초과', filter: 'breach', shared: true }
];

/* 데모는 영업사원 시점에서 열린다 — 요구사항 1이 그 자리이기 때문이다.
   달성률·파이프라인·담당 광고주·제작 의뢰가 모두 중간값에 가까운 담당자를
   고른다. 극단값인 사람으로 열면 첫 화면이 사실을 왜곡한다. */
S.session = { userId: 'u05' };

/* ── write ──────────────────────────────────────────────────────────── */
const out = `/* CLOSER · seed.js — GENERATED by tools/gen-seed.js. Do not edit by hand.
 * ${Object.keys(S).map(k => Array.isArray(S[k]) ? k + ':' + S[k].length : null).filter(Boolean).join(' · ')}
 * 모든 회사·인물·연락처는 가상의 데모 데이터입니다. 전화번호는 마스킹되어 있습니다.
 */
window.CLOSER_SEED = ${JSON.stringify(S)};
`;
const target = path.join(__dirname, '..', 'assets', 'js', 'seed.js');
fs.writeFileSync(target, out, 'utf8');
const stats = Object.keys(S).filter(k => Array.isArray(S[k])).map(k => `${k}=${S[k].length}`).join(' ');
console.log('wrote', target, Math.round(out.length / 1024) + 'KB');
console.log(stats);
