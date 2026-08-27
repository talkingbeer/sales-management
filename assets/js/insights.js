/* CLOSER · insights.js — the analytic opinion layer.
 * Charts show what happened. This says what it means and what to do next.
 * Every rule is IF <measurable condition> THEN <one Korean sentence + evidence +
 * an action>. No rule fires without evidence it can print.
 */
(function (w) {
  'use strict';
  var C = w.CLOSER, U = C.util, db = C.db, D = C.domain, M = C.metrics;
  var RANK = { risk: 0, warn: 1, act: 2, good: 3 };

  function won(n) { return U.won(n); }
  function link(href, label) { return '<a class="btn btn--sm" href="' + href + '">' + U.esc(label) + '</a>'; }

  /* ══ 규칙 ═══════════════════════════════════════════════════════════ */
  var RULES = [

    /* ── 목표와 파이프라인 ─────────────────────────────────────────── */
    { id: 'coverage-low', kind: 'risk', label: '파이프라인 커버리지',
      run: function (s) {
        var cov = M.coverage(s);
        if (cov === Infinity || cov >= 3) return null;
        var remain = Math.max(0, M.quota(s) - M.wonAmount(s));
        var need = Math.max(0, remain * 3 - M.pipelineValue(s));
        return {
          say: '이번 분기 목표를 채우려면 파이프라인이 <strong>' + won(need) + '</strong> 더 필요합니다.',
          why: '남은 목표 ' + won(remain) + ' · 현재 진행 파이프라인 ' + won(M.pipelineValue(s)) +
               ' → 커버리지 ' + cov.toFixed(1) + '배 (건강 기준 3배)',
          actions: link('leads.html', '리드 확인') + link('pipeline.html', '파이프라인 보기')
        };
      } },

    { id: 'coverage-ok', kind: 'good', label: '파이프라인 커버리지',
      run: function (s) {
        var cov = M.coverage(s);
        if (cov === Infinity || cov < 3.5) return null;
        return {
          say: '파이프라인 커버리지가 <strong>' + cov.toFixed(1) + '배</strong>로 목표 대비 여유가 있습니다.',
          why: '진행 파이프라인 ' + won(M.pipelineValue(s)) + ' · 남은 목표 ' + won(Math.max(0, M.quota(s) - M.wonAmount(s))),
          actions: link('forecast.html', '예측 보기')
        };
      } },

    { id: 'pace', kind: 'warn', label: '목표 진척',
      run: function (s) {
        var q = M.quota(s); if (!q) return null;
        var elapsed = U.clamp(U.days(s.from, C.today) / Math.max(1, U.days(s.from, s.to)), 0, 1) * 100;
        var att = M.attainment(s) || 0;
        var gap = att - elapsed;
        if (gap > -8) return null;
        return {
          say: '분기 진행률 <strong>' + Math.round(elapsed) + '%</strong>에 실적은 <strong>' + Math.round(att) + '%</strong> — ' +
               Math.round(Math.abs(gap)) + '%p 뒤처져 있습니다.',
          why: '확정 실적 ' + won(M.wonAmount(s)) + ' / 목표 ' + won(q) + ' · 남은 기간 ' + U.days(C.today, s.to) + '일',
          actions: link('performance.html', '내 실적') + link('pipeline.html', '마감 임박 딜')
        };
      } },

    /* ── 딜 위생 ───────────────────────────────────────────────────── */
    { id: 'stalled', kind: 'warn', label: '정체 딜',
      run: function (s) {
        var st = M.open(s).filter(D.isStalled);
        if (!st.length) return null;
        var top = U.sortBy(st, 'amount', 'desc')[0];
        return {
          say: '단계에서 멈춰 있는 영업기회가 <strong>' + st.length + '건</strong> 있습니다. 합계 ' + won(U.sum(st, 'amount')) + '.',
          why: '가장 큰 건: “' + U.esc(top.name) + '” — ' + top.stage + ' 단계에서 ' + D.daysInStage(top) + '일 (기준 ' + (D.STAGE_MAX_DAYS[top.stage] || 14) + '일)',
          actions: link('pipeline.html?filter=stalled', '정체 딜만 보기')
        };
      } },

    { id: 'overdue-close', kind: 'risk', label: '마감일 경과',
      run: function (s) {
        var od = M.open(s).filter(D.isOverdue);
        if (!od.length) return null;
        return {
          say: '예상 마감일이 지났는데 열려 있는 딜이 <strong>' + od.length + '건</strong>입니다.',
          why: '합계 ' + won(U.sum(od, 'amount')) + ' · 예측 정확도를 직접 훼손합니다. 마감일을 다시 잡거나 단계를 옮기세요.',
          actions: link('opportunities.html?filter=overdue', '해당 딜 보기')
        };
      } },

    { id: 'no-activity', kind: 'warn', label: '접촉 공백',
      run: function (s) {
        var quiet = M.open(s).filter(function (o) {
          var acts = db.activitiesOf('opportunity', o.id);
          var last = acts.length ? acts[0].dueDate : o.createdAt;
          return U.days(last, C.today) > 14;
        });
        if (!quiet.length) return null;
        var amt = U.sum(quiet, 'amount');
        var interval = M.avgContactInterval(s);
        return {
          say: '14일 넘게 아무 활동이 없는 딜이 <strong>' + quiet.length + '건</strong>, ' + won(amt) + ' 규모입니다.',
          why: interval
            ? '이 범위에서 성사된 딜의 평균 접촉 간격은 ' + interval.toFixed(1) + '일이었습니다. 지금 이 딜들은 그보다 ' +
              Math.round(14 / interval * 10) / 10 + '배 이상 벌어져 있습니다.'
            : '비교할 성사 이력이 아직 부족합니다. 접촉 기록을 남기면 다음 분기부터 기준값이 생깁니다.',
          actions: link('activities.html', '활동 등록')
        };
      } },

    { id: 'concentration', kind: 'warn', label: '집중 리스크',
      run: function (s) {
        var open = M.open(s); if (open.length < 3) return null;
        var total = U.sum(open, 'amount'); if (!total) return null;
        var top = U.sortBy(open, 'amount', 'desc')[0];
        var share = (top.amount / total) * 100;
        if (share < 35) return null;
        return {
          say: '파이프라인의 <strong>' + Math.round(share) + '%</strong>가 “' + U.esc(top.name) + '” 한 건에 실려 있습니다.',
          why: '이 딜 하나가 밀리면 분기 예측이 ' + won(D.weighted(top)) + ' 흔들립니다. 현재 단계 ' + top.stage + '.',
          actions: link('opportunity.html?id=' + encodeURIComponent(top.id), '딜 열기')
        };
      } },

    /* ── 전환과 실주 ───────────────────────────────────────────────── */
    { id: 'bottleneck', kind: 'act', label: '단계 병목',
      run: function (s) {
        var conv = M.stageConversion(s).filter(function (c) { return c.rate > 0; });
        if (conv.length < 2) return null;
        var worst = U.sortBy(conv, 'rate')[0];
        if (worst.rate > 55) return null;
        var dwell = M.stageDwell(s)[worst.from];
        return {
          say: '<strong>' + worst.from + ' → ' + worst.to + '</strong> 전환율이 ' + Math.round(worst.rate) + '%로 가장 낮습니다.',
          why: '이 단계 평균 체류 ' + Math.round(dwell || 0) + '일. 여기서 새는 건수가 분기 성사율을 좌우합니다.',
          actions: link('reports.html?r=funnel', '퍼널 리포트')
        };
      } },

    { id: 'big-deal-loss', kind: 'risk', label: '금액 성사율',
      run: function (s) {
        var byCount = M.winRate(s), byAmount = M.winRateByAmount(s);
        if (byCount === null || byAmount === null) return null;
        if (byCount - byAmount < 12) return null;
        return {
          say: '건수 성사율 ' + Math.round(byCount) + '%인데 금액 성사율은 <strong>' + Math.round(byAmount) + '%</strong> — 큰 딜을 놓치고 있습니다.',
          why: '성사 ' + M.won(s).length + '건 평균 ' + won(M.avgDealSize(s) || 0) +
               ' vs 실주 ' + M.lost(s).length + '건 평균 ' + won(M.lost(s).length ? U.sum(M.lost(s), 'amount') / M.lost(s).length : 0) +
               ' — 잃은 딜이 이긴 딜보다 큽니다.',
          actions: link('reports.html?r=winloss', '승패 분석')
        };
      } },

    { id: 'loss-reason', kind: 'act', label: '실주 사유',
      run: function (s) {
        var ls = M.lost(s); if (ls.length < 3) return null;
        var g = U.groupBy(ls, 'lossReason');
        var top = Object.keys(g).filter(function (k) { return k && k !== 'undefined'; })
          .sort(function (a, b) { return g[b].length - g[a].length; })[0];
        if (!top) return null;
        var share = (g[top].length / ls.length) * 100;
        if (share < 34) return null;
        return {
          say: '이번 분기 실주의 <strong>' + Math.round(share) + '%</strong>가 “' + U.esc(top) + '” 때문이었습니다.',
          why: '실주 ' + ls.length + '건 중 ' + g[top].length + '건 · 잃은 금액 ' + won(U.sum(g[top], 'amount')),
          actions: link('reports.html?r=winloss', '실주 상세')
        };
      } },

    { id: 'cycle-drift', kind: 'warn', label: '영업 사이클',
      run: function (s) {
        var cur = M.salesCycle(s);
        var prev = M.salesCycle(Object.assign({}, s, {
          from: new Date(s.from.getFullYear(), s.from.getMonth() - 3, 1),
          to: new Date(s.from.getFullYear(), s.from.getMonth(), 0)
        }));
        if (!cur || !prev || cur - prev < 8) return null;
        return {
          say: '영업 사이클이 지난 분기 ' + Math.round(prev) + '일에서 <strong>' + Math.round(cur) + '일</strong>로 늘었습니다.',
          why: '+' + Math.round(cur - prev) + '일. 사이클이 길어지면 같은 목표에 더 많은 파이프라인이 필요합니다.',
          actions: link('reports.html?r=velocity', '속도 리포트')
        };
      } },

    { id: 'new-mix', kind: 'act', label: '신규·기존 비중',
      run: function (s) {
        var mix = M.newVsExisting(s);
        var total = mix.newAmount + mix.existingAmount;
        if (!total || mix.total < 3) return null;
        var share = (mix.newAmount / total) * 100;
        if (share >= 25) return null;
        return {
          say: '이번 분기 매출의 <strong>' + Math.round(share) + '%</strong>만 신규 광고주에서 나왔습니다.',
          why: '신규 ' + won(mix.newAmount) + ' / 기존 ' + won(mix.existingAmount) + '. 기존 의존도가 높으면 한 곳의 이탈이 분기를 흔듭니다.',
          actions: link('leads.html', '신규 리드')
        };
      } },

    /* ── 광고주 ────────────────────────────────────────────────────── */
    { id: 'at-risk', kind: 'risk', label: '이탈 위험 광고주',
      run: function (s) {
        var risky = M.atRiskAccounts(s);
        if (!risky.length) return null;
        var top = risky[0];
        return {
          say: '이탈 위험 광고주가 <strong>' + risky.length + '개사</strong>. 가장 시급한 곳은 “' + U.esc(top.account.name) + '”입니다.',
          why: '건강도 ' + top.health.score + '점 · ' + top.health.reasons.slice(0, 2).join(' · '),
          actions: link('account.html?id=' + encodeURIComponent(top.account.id), '광고주 열기') + link('accounts.html?filter=risk', '전체 보기')
        };
      } },

    { id: 'silent-account', kind: 'warn', label: '무접촉 광고주',
      run: function (s) {
        var quiet = db.all('accounts').filter(function (a) {
          return (!s.userIds || s.userIds.indexOf(a.ownerId) > -1) &&
            a.lastActivityDate && U.days(a.lastActivityDate, C.today) > 45;
        });
        if (!quiet.length) return null;
        var rev = U.sum(quiet, function (a) { return M.accountRevenue(a.id, 365); });
        return {
          say: '45일 넘게 접촉이 없는 광고주가 <strong>' + quiet.length + '개사</strong> 있습니다.',
          why: '이 광고주들의 최근 1년 매출 합계는 ' + won(rev) + '입니다.',
          actions: link('accounts.html?sort=lastActivity', '오래된 순 보기')
        };
      } },

    { id: 'renewal', kind: 'act', label: '갱신 임박',
      run: function (s) {
        var soon = db.where('contracts', function (c) {
          return c.status === '유효' && c.endDate && U.days(C.today, c.endDate) >= 0 && U.days(C.today, c.endDate) <= 60;
        });
        if (!soon.length) return null;
        var amt = U.sum(soon, 'amount');
        var nearest = U.sortBy(soon, 'endDate')[0];
        var acc = db.get('accounts', nearest.accountId);
        return {
          say: '60일 안에 만료되는 계약이 <strong>' + soon.length + '건</strong>, ' + won(amt) + ' 규모입니다.',
          why: '가장 임박: ' + (acc ? U.esc(acc.name) : '—') + ' — ' + U.fmtDate(nearest.endDate) + ' 만료 (' + U.days(C.today, nearest.endDate) + '일 남음)',
          actions: link('contracts.html?filter=renewal', '갱신 대상 보기')
        };
      } },

    /* ── 리드 ──────────────────────────────────────────────────────── */
    { id: 'cold-leads', kind: 'warn', label: '리드 응답 지연',
      run: function (s) {
        var cold = db.where('leads', function (l) {
          return (!s.userIds || s.userIds.indexOf(l.ownerId) > -1) &&
            l.status === '신규' && U.days(l.createdAt, C.today) > 3;
        });
        if (!cold.length) return null;
        return {
          say: '접수 후 3일 넘게 손대지 않은 리드가 <strong>' + cold.length + '건</strong> 있습니다.',
          why: '가장 오래된 건은 ' + U.days(U.sortBy(cold, 'createdAt')[0].createdAt, C.today) + '일 경과 · 이 중 인바운드 문의가 ' +
               cold.filter(function (x) { return x.source === '인바운드 문의'; }).length + '건입니다.',
          actions: link('leads.html?filter=new', '미처리 리드')
        };
      } },

    /* ── 승인 ──────────────────────────────────────────────────────── */
    { id: 'approval-wait', kind: 'act', label: '승인 대기',
      run: function (s) {
        var meId = db.me() && db.me().id;
        var mine = db.where('approvals', function (a) { return a.status === '대기' && a.approverId === meId; });
        if (!mine.length) return null;
        var oldest = U.sortBy(mine, 'submittedAt')[0];
        return {
          say: '내 결재를 기다리는 요청이 <strong>' + mine.length + '건</strong> 있습니다.',
          why: '가장 오래된 건은 ' + U.days(oldest.submittedAt, C.today) + '일째 대기 중입니다.',
          actions: link('approvals.html', '승인함 열기')
        };
      } },

    { id: 'approval-blocking', kind: 'warn', label: '승인이 딜을 잡고 있음',
      run: function (s) {
        var blocked = M.open(s).filter(function (o) {
          return o.stage === '내부승인' && db.where('approvals', function (a) {
            return a.objectType === 'opportunities' && a.objectId === o.id && a.status === '대기';
          }).length;
        });
        if (!blocked.length) return null;
        return {
          say: '내부 승인 대기 때문에 멈춰 있는 딜이 <strong>' + blocked.length + '건</strong>, ' + won(U.sum(blocked, 'amount')) + '입니다.',
          why: '승인 단계에서의 지연은 광고주에게 보이지 않지만 마감일에는 그대로 반영됩니다.',
          actions: link('approvals.html', '승인 현황')
        };
      } },

    /* ── 제작 티켓 ─────────────────────────────────────────────────── */
    { id: 'sla-breach', kind: 'risk', label: 'SLA 초과',
      run: function (s) {
        var st = M.ticketStats(s);
        if (!st.breach) return null;
        return {
          say: 'SLA를 넘긴 제작 의뢰가 <strong>' + st.breach + '건</strong> 있습니다.',
          why: '진행 중 ' + st.open + '건 중 ' + st.breach + '건 초과 · SLA 준수율 ' + (st.slaRate === null ? '—' : Math.round(st.slaRate) + '%'),
          actions: link('tickets.html?filter=breach', 'SLA 초과 건')
        };
      } },

    { id: 'unassigned', kind: 'warn', label: '미배정 의뢰',
      run: function (s) {
        var st = M.ticketStats(s);
        if (!st.unassigned) return null;
        var wait = M.avgAssignWait();
        var waiting = db.where('tickets', function (t) {
          return !t.assigneeId && D.TICKET_OPEN.indexOf(t.status) > -1;
        });
        var oldest = waiting.length ? U.sortBy(waiting, 'createdAt')[0] : null;
        return {
          say: '담당자가 정해지지 않은 제작 의뢰가 <strong>' + st.unassigned + '건</strong> 대기 중입니다.',
          why: (oldest ? '가장 오래된 건은 ' + U.days(oldest.createdAt, C.today) + '일 대기(' + U.esc(oldest.key) + ') · ' : '') +
               (wait !== null ? '평균 배정 소요 ' + wait.toFixed(1) + '일' : '배정 이력이 아직 없습니다') +
               ' · 배정 전 대기도 납기 시계에 포함됩니다.',
          actions: link('tickets.html?filter=unassigned', '미배정 보기')
        };
      } },

    { id: 'rework', kind: 'act', label: '재작업률',
      run: function (s) {
        var st = M.ticketStats(s);
        if (st.reworkRate === null || st.reworkRate < 25) return null;
        /* 재작업이 실제로 얼마나 비싼지 — 리드타임 차이로 값을 매긴다. */
        var done = db.where('tickets', function (t) { return t.status === '완료' && t.doneAt; });
        var withRw = done.filter(function (t) { return (t.reworkCount || 0) > 0; });
        var without = done.filter(function (t) { return !(t.reworkCount || 0); });
        var cycOf = function (list) { return list.length ? U.avg(list.map(function (t) { return U.days(t.createdAt, t.doneAt); })) : null; };
        var a = cycOf(withRw), b = cycOf(without);
        return {
          say: '완료된 제작 건의 <strong>' + Math.round(st.reworkRate) + '%</strong>가 수정요청을 한 번 이상 거쳤습니다.',
          why: '재작업 ' + withRw.length + '건 평균 ' + (a === null ? '—' : a.toFixed(1) + '일') +
               ' vs 무재작업 ' + without.length + '건 평균 ' + (b === null ? '—' : b.toFixed(1) + '일') +
               (a !== null && b !== null ? ' → 건당 ' + (a - b).toFixed(1) + '일 더 걸립니다.' : ''),
          actions: link('tickets.html', '의뢰 보드')
        };
      } },

    { id: 'ticket-vs-close', kind: 'risk', label: '제작 일정 충돌',
      run: function (s) {
        var bad = [];
        M.open(s).forEach(function (o) {
          db.ticketsOf(o.id).forEach(function (t) {
            if (D.TICKET_OPEN.indexOf(t.status) > -1 && t.dueDate && o.closeDate && U.days(o.closeDate, t.dueDate) > 0) bad.push({ o: o, t: t });
          });
        });
        if (!bad.length) return null;
        return {
          say: '제작 완료 예정일이 딜 마감일보다 늦는 건이 <strong>' + bad.length + '건</strong> 있습니다.',
          why: '예: “' + U.esc(bad[0].o.name) + '” 마감 ' + U.fmtDate(bad[0].o.closeDate) + ' vs 제작 ' + U.fmtDate(bad[0].t.dueDate),
          actions: link('ticket.html?id=' + encodeURIComponent(bad[0].t.id), '티켓 열기')
        };
      } },

    /* ── 리소스 ────────────────────────────────────────────────────── */
    { id: 'overloaded', kind: 'risk', label: '리소스 과부하',
      run: function () {
        var load = M.resourceLoad().filter(function (r) { return r.rate > 100; });
        if (!load.length) return null;
        var top = load[0];
        return {
          say: '향후 4주 가동률이 100%를 넘는 인력이 <strong>' + load.length + '명</strong>입니다.',
          why: U.esc(top.user.name) + ' ' + Math.round(top.rate) + '% (' + Math.round(top.hours) + 'h / ' + Math.round(top.capacity) + 'h) · 배정 ' + top.jobs + '건',
          actions: link('resources.html', '캐파 보기')
        };
      } },

    { id: 'idle', kind: 'act', label: '여유 리소스',
      run: function () {
        var load = M.resourceLoad().filter(function (r) { return r.rate < 45; });
        if (load.length < 2) return null;
        return {
          say: '가동률 45% 미만인 인력이 <strong>' + load.length + '명</strong> 있습니다. 대기 중인 의뢰를 여기로 돌릴 수 있습니다.',
          why: load.slice(0, 3).map(function (r) { return U.esc(r.user.name) + ' ' + Math.round(r.rate) + '%'; }).join(' · '),
          actions: link('resources.html', '배정 조정')
        };
      } },

    { id: 'req-pending', kind: 'act', label: '공수 승인 대기',
      run: function () {
        var p = M.pendingRequests();
        if (!p.length) return null;
        return {
          say: '승인을 기다리는 공수 신청이 <strong>' + p.length + '건</strong>, 합계 ' + U.num(U.sum(p, 'hours')) + '시간입니다.',
          why: '가장 오래된 건은 ' + U.days(U.sortBy(p, 'createdAt')[0].createdAt, C.today) + '일 대기 중입니다.',
          actions: link('resources.html?tab=requests', '신청 목록')
        };
      } },

    /* ── 캠페인 ────────────────────────────────────────────────────── */
    { id: 'roas-low', kind: 'warn', label: '캠페인 효율',
      run: function (s) {
        var bad = db.where('campaigns', function (c) { return c.status === '집행중' && c.spend > 0; })
          .map(function (c) { return { c: c, p: M.campaignPerf(c) }; })
          .filter(function (x) { return x.p.roas !== null && x.p.roas < 180; });
        if (!bad.length) return null;
        var worst = U.sortBy(bad, function (x) { return x.p.roas; })[0];
        var acc = db.get('accounts', worst.c.accountId);
        return {
          say: 'ROAS 180% 미만으로 집행 중인 캠페인이 <strong>' + bad.length + '건</strong>입니다.',
          why: '가장 낮은 건: “' + U.esc(worst.c.name) + '” ROAS ' + Math.round(worst.p.roas) + '% · ' + (acc ? U.esc(acc.name) : '—') +
               ' · 소진 ' + won(worst.c.spend),
          actions: link('campaigns.html', '캠페인 보기')
        };
      } },

    { id: 'pace-overspend', kind: 'warn', label: '예산 소진 속도',
      run: function () {
        var fast = db.where('campaigns', function (c) { return c.status === '집행중' && c.budget > 0; })
          .map(function (c) {
            var total = U.days(c.startDate, c.endDate) || 1;
            var gone = U.clamp(U.days(c.startDate, C.today) / total, 0, 1) * 100;
            return { c: c, spendPace: (c.spend / c.budget) * 100, timePace: gone };
          })
          .filter(function (x) { return x.spendPace - x.timePace > 22; });
        if (!fast.length) return null;
        var w0 = fast[0];
        return {
          say: '기간 대비 예산이 빠르게 소진되는 캠페인이 <strong>' + fast.length + '건</strong> 있습니다.',
          why: '“' + U.esc(w0.c.name) + '” 기간 ' + Math.round(w0.timePace) + '% 경과에 예산 ' + Math.round(w0.spendPace) + '% 소진',
          actions: link('campaigns.html', '집행 현황')
        };
      } },

    /* ── 실적 입력 위생 ────────────────────────────────────────────── */
    { id: 'actual-missing', kind: 'act', label: '실적 미제출',
      run: function () {
        var me = db.me(); if (!me || me.role === '제작인력') return null;
        var p = U.ymOf(C.today);
        var drafts = db.where('actuals', function (a) { return a.ownerId === me.id && a.period === p && a.status === '임시저장'; });
        var submitted = M.actualsFor(me.id, p);
        if (submitted.length && !drafts.length) return null;
        return {
          say: drafts.length
            ? '이번 달 실적 <strong>' + drafts.length + '건</strong>이 임시저장 상태로 남아 있습니다.'
            : '이번 달 실적이 아직 한 건도 제출되지 않았습니다.',
          why: '기준월 ' + p + ' · 제출된 실적만 목표 달성률과 예측에 반영됩니다.',
          actions: link('performance.html', '실적 입력')
        };
      } },

    { id: 'quota-hit', kind: 'good', label: '목표 달성',
      run: function (s) {
        var att = M.attainment(s);
        if (att === null || att < 100) return null;
        return {
          say: '분기 목표를 <strong>' + Math.round(att) + '%</strong> 달성했습니다.',
          why: '확정 ' + won(M.wonAmount(s)) + ' / 목표 ' + won(M.quota(s)) + ' · 성사 ' + M.won(s).length + '건',
          actions: link('performance.html', '실적 상세')
        };
      } }
  ];

  /* ══ 실행 ═══════════════════════════════════════════════════════════ */
  function run(scope, opt) {
    var s = scope || M.scope();
    var out = [];
    RULES.forEach(function (r) {
      var res;
      try { res = r.run(s); } catch (e) { res = null; }
      if (res) out.push({ id: r.id, kind: r.kind, label: r.label, say: res.say, why: res.why, actions: res.actions });
    });
    out.sort(function (a, b) { return RANK[a.kind] - RANK[b.kind]; });
    return opt && opt.limit ? out.slice(0, opt.limit) : out;
  }

  /** 한 광고주에 대한 의견 — 레코드 페이지용. */
  function forAccount(acc) {
    var out = [];
    var h = D.accountHealth(acc);
    out.push({
      kind: h.score >= 70 ? 'good' : h.score >= 55 ? 'warn' : 'risk', label: '광고주 건강도',
      say: '건강도 <strong>' + h.score + '점</strong> — ' + (h.score >= 70 ? '안정적입니다.' : h.score >= 55 ? '주의가 필요합니다.' : '이탈 위험 구간입니다.'),
      why: h.reasons.join(' · ') || '판단 근거가 될 활동 기록이 부족합니다.'
    });
    var rev12 = M.accountRevenue(acc.id, 365), rev24 = M.accountRevenue(acc.id, 730) - rev12;
    if (rev24 > 0) {
      var delta = ((rev12 - rev24) / rev24) * 100;
      out.push({
        kind: delta >= 0 ? 'good' : delta < -25 ? 'risk' : 'warn', label: '매출 추세',
        say: '최근 1년 매출이 직전 1년 대비 <strong>' + (delta >= 0 ? '+' : '−') + Math.abs(Math.round(delta)) + '%</strong>입니다.',
        why: '최근 1년 ' + won(rev12) + ' / 직전 1년 ' + won(rev24)
      });
    }
    var open = db.where('opportunities', function (o) { return o.accountId === acc.id && D.isOpen(o); });
    if (!open.length) {
      out.push({ kind: 'act', label: '다음 기회', say: '현재 진행 중인 영업기회가 없습니다.', why: '집행이 끝난 광고주는 3주 안에 다음 제안이 없으면 대체로 다른 대행사로 넘어갑니다.' });
    }
    return out;
  }

  /** 한 딜에 대한 의견 — 레코드 페이지용. */
  function forOpportunity(opp) {
    var out = [], st = D.stage(opp.stage);
    if (D.isOpen(opp)) {
      var missing = (st.requires || []).filter(function (f) { return !opp[f]; });
      if (missing.length) out.push({
        kind: 'act', label: '단계 요건',
        say: '<strong>' + opp.stage + '</strong> 단계를 마치려면 ' + missing.length + '개 필드가 더 필요합니다.',
        why: '누락: ' + missing.join(', ') + ' · 기준: ' + st.exit
      });
      if (D.isStalled(opp)) out.push({
        kind: 'warn', label: '체류 기간',
        say: '이 딜은 <strong>' + D.daysInStage(opp) + '일째</strong> 같은 단계에 있습니다.',
        why: opp.stage + ' 단계 기준 체류일은 ' + (D.STAGE_MAX_DAYS[opp.stage] || 14) + '일입니다.'
      });
      if (D.isOverdue(opp)) out.push({
        kind: 'risk', label: '마감일',
        say: '예상 마감일이 <strong>' + Math.abs(U.days(opp.closeDate, C.today)) + '일</strong> 지났습니다.',
        why: '마감일 ' + U.fmtDate(opp.closeDate) + ' · 예측에서 제외되거나 다음 분기로 밀립니다.'
      });
      var acts = db.activitiesOf('opportunity', opp.id);
      var last = acts.length ? acts[0].dueDate : opp.createdAt;
      if (U.days(last, C.today) > 10) out.push({
        kind: 'warn', label: '접촉 공백',
        say: '마지막 활동 이후 <strong>' + U.days(last, C.today) + '일</strong>이 지났습니다.',
        why: '마지막 기록: ' + (acts.length ? U.esc(acts[0].subject) : '없음') + ' (' + U.fmtDate(last) + ')'
      });
      var tks = db.ticketsOf(opp.id).filter(function (t) { return D.TICKET_OPEN.indexOf(t.status) > -1; });
      if (tks.length) {
        var late = tks.filter(function (t) { return D.slaState(t) === 'breach' || D.slaState(t) === 'risk'; });
        if (late.length) out.push({
          kind: 'risk', label: '제작 리스크',
          say: '이 딜에 걸린 제작 의뢰 ' + tks.length + '건 중 <strong>' + late.length + '건</strong>이 일정 위험입니다.',
          why: late.map(function (t) { return t.key + ' ' + t.title; }).slice(0, 2).join(' · ')
        });
      }
    }
    return out;
  }

  C.insights = { run: run, forAccount: forAccount, forOpportunity: forOpportunity, rules: RULES };
})(window);
