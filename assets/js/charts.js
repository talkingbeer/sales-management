/* CLOSER · charts.js — hand-built SVG. No chart library.
 * Every mark takes its colour from a token class in app.css, never an inline value.
 * Charts return an SVG string; callers drop it into a panel body.
 */
(function (w) {
  'use strict';
  var C = w.CLOSER, U = C.util, esc = U.esc;
  var ch = {};

  /* preserveAspectRatio="none" 을 걷어냈다. 그 값은 패널 폭에 따라 SVG를
     가로로만 늘리거나 눌러서, 축 라벨과 값이 실제로 찌그러져 보이게 했다.
     이제 균일 배율로 그리고 높이는 폭을 따라간다. */
  function svg(vbW, vbH, inner, extra) {
    return '<svg class="chart" viewBox="0 0 ' + vbW + ' ' + vbH + '" role="img" ' +
      'style="width:100%;height:auto" ' +
      'aria-label="' + esc((extra && extra.label) || '차트') + '">' + inner + '</svg>';
  }
  function nice(max) {
    if (max <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(max)));
    var n = max / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  /**
   * 세로 막대 — data: [{label, value, kind}]  opt: {h, fmt, target}
   * `target` draws a dashed goal line across the plot.
   */
  ch.bars = function (data, opt) {
    opt = opt || {};
    var W = 640, H = opt.h || 200, padL = 58, padB = 34, padT = 14, padR = 10;
    var max = nice(Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1])));
    if (opt.target) max = nice(Math.max(max, opt.target));
    var pw = W - padL - padR, phh = H - padT - padB;
    var bw = pw / data.length;
    var out = '';
    [0, 0.5, 1].forEach(function (t) {
      var y = padT + phh * (1 - t);
      out += '<line class="grid-line" x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '"/>';
      out += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + esc(opt.fmt ? opt.fmt(max * t) : U.num(max * t)) + '</text>';
    });
    data.forEach(function (d, i) {
      var hgt = Math.max(1, (d.value / max) * phh);
      var x = padL + i * bw + bw * 0.2;
      var y = padT + phh - hgt;
      out += '<rect class="bar' + (d.kind ? ' bar--' + d.kind : '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
        '" width="' + (bw * 0.6).toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="0"><title>' +
        esc(d.label + ' · ' + (opt.fmt ? opt.fmt(d.value) : U.num(d.value))) + '</title></rect>';
      out += '<text x="' + (padL + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>';
    });
    if (opt.target) {
      var ty = padT + phh * (1 - opt.target / max);
      out += '<line class="line--ghost" x1="' + padL + '" y1="' + ty.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty.toFixed(1) + '" stroke="currentColor"/>';
    }
    out += '<line class="axis-line" x1="' + padL + '" y1="' + (padT + phh) + '" x2="' + (W - padR) + '" y2="' + (padT + phh) + '"/>';
    return svg(W, H, out, { h: H, label: opt.label });
  };

  /** 누적 막대 — data:[{label, parts:[{value, series}]}] series is 1..8 */
  ch.stacked = function (data, opt) {
    opt = opt || {};
    var W = 640, H = opt.h || 200, padL = 58, padB = 34, padT = 14, padR = 10;
    var totals = data.map(function (d) { return U.sum(d.parts, 'value'); });
    var max = nice(Math.max.apply(null, totals.concat([1])));
    var pw = W - padL - padR, phh = H - padT - padB, bw = pw / data.length;
    var out = '';
    [0, 0.5, 1].forEach(function (t) {
      var y = padT + phh * (1 - t);
      out += '<line class="grid-line" x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '"/>';
      out += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + esc(opt.fmt ? opt.fmt(max * t) : U.num(max * t)) + '</text>';
    });
    data.forEach(function (d, i) {
      var acc = 0;
      d.parts.forEach(function (p) {
        var hgt = (p.value / max) * phh;
        var y = padT + phh - acc - hgt;
        out += '<rect x="' + (padL + i * bw + bw * 0.18).toFixed(1) + '" y="' + y.toFixed(1) +
          '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(0, hgt).toFixed(1) +
          '" fill="var(--color-series-' + (p.series || 1) + ')"><title>' + esc(p.name + ' ' + (opt.fmt ? opt.fmt(p.value) : U.num(p.value))) + '</title></rect>';
        acc += hgt;
      });
      out += '<text x="' + (padL + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>';
    });
    out += '<line class="axis-line" x1="' + padL + '" y1="' + (padT + phh) + '" x2="' + (W - padR) + '" y2="' + (padT + phh) + '"/>';
    return svg(W, H, out, { h: H, label: opt.label });
  };

  /** 선/영역 — series: [{name, points:[{label,value}], ghost}] */
  ch.line = function (series, opt) {
    opt = opt || {};
    var W = 640, H = opt.h || 210, padL = 58, padB = 34, padT = 14, padR = 12;
    var allV = [];
    series.forEach(function (s) { s.points.forEach(function (p) { allV.push(p.value); }); });
    var max = nice(Math.max.apply(null, allV.concat([1])));
    var pw = W - padL - padR, phh = H - padT - padB;
    var n = series[0] ? series[0].points.length : 0;
    var stepX = n > 1 ? pw / (n - 1) : pw;
    var out = '';
    [0, 0.5, 1].forEach(function (t) {
      var y = padT + phh * (1 - t);
      out += '<line class="grid-line" x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '"/>';
      out += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + esc(opt.fmt ? opt.fmt(max * t) : U.num(max * t)) + '</text>';
    });
    series.forEach(function (s, si) {
      var pts = s.points.map(function (p, i) {
        return [padL + i * stepX, padT + phh * (1 - p.value / max)];
      });
      var dPath = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      if (opt.area && si === 0) {
        out += '<path class="area" d="' + dPath + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (padT + phh) +
          ' L' + pts[0][0].toFixed(1) + ' ' + (padT + phh) + ' Z"/>';
      }
      out += '<path class="line' + (s.ghost ? ' line--ghost' : '') + '" d="' + dPath + '"' +
        (s.series ? ' stroke="var(--color-series-' + s.series + ')"' : '') + '/>';
      if (!s.ghost) pts.forEach(function (p, i) {
        out += '<circle class="pt" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.5"><title>' +
          esc(s.points[i].label + ' · ' + (opt.fmt ? opt.fmt(s.points[i].value) : U.num(s.points[i].value))) + '</title></circle>';
      });
    });
    if (series[0]) series[0].points.forEach(function (p, i) {
      if (n > 8 && i % 2) return;
      out += '<text x="' + (padL + i * stepX).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(p.label) + '</text>';
    });
    out += '<line class="axis-line" x1="' + padL + '" y1="' + (padT + phh) + '" x2="' + (W - padR) + '" y2="' + (padT + phh) + '"/>';
    return svg(W, H, out, { h: H, label: opt.label });
  };

  /** 퍼널 — stages:[{label, value}] 위에서 아래로 좁아지는 사다리꼴 */
  ch.funnel = function (stages, opt) {
    opt = opt || {};
    var W = 640, rowH = 38, H = stages.length * rowH + 10;
    var max = Math.max.apply(null, stages.map(function (s) { return s.value; }).concat([1]));
    var labelW = 168, barMax = W - labelW - 108;
    var out = '';
    stages.forEach(function (s, i) {
      var y = i * rowH + 6;
      var wdt = Math.max(2, (s.value / max) * barMax);
      var conv = i > 0 && stages[i - 1].value > 0 ? (s.value / stages[i - 1].value) * 100 : null;
      out += '<text x="0" y="' + (y + 14) + '">' + esc(s.label) + '</text>';
      out += '<rect class="funnel-seg" x="' + labelW + '" y="' + y + '" width="' + wdt.toFixed(1) + '" height="20" rx="0" ' +
        'opacity="' + (0.35 + 0.65 * (1 - i / Math.max(1, stages.length))).toFixed(2) + '"><title>' +
        esc(s.label + ' · ' + U.num(s.value)) + '</title></rect>';
      out += '<text x="' + (labelW + wdt + 6).toFixed(1) + '" y="' + (y + 14) + '">' + esc(opt.fmt ? opt.fmt(s.value) : U.num(s.value)) +
        (conv !== null ? '  (' + conv.toFixed(0) + '%)' : '') + '</text>';
    });
    return svg(W, H, out, { h: H, label: opt.label });
  };

  /** 도넛 링 — 하나의 달성률. value/max, 가운데에 라벨. */
  ch.ring = function (value, max, opt) {
    opt = opt || {};
    var S = opt.size || 132, r = S / 2 - 9, cx = S / 2, cy = S / 2;
    var p = max > 0 ? U.clamp(value / max, 0, 1.3) : 0;
    var circ = 2 * Math.PI * r;
    var stroke = p >= 1 ? 'var(--color-pos)' : p >= 0.7 ? 'var(--color-accent)' : 'var(--color-warn)';
    var out =
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--color-paper-3)" stroke-width="9"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + stroke + '" stroke-width="9" ' +
      'stroke-linecap="butt" stroke-dasharray="' + (circ * Math.min(p, 1)).toFixed(1) + ' ' + circ.toFixed(1) + '" ' +
      'transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
      '<text x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle" style="font-size:21px;fill:var(--color-ink);font-weight:600">' +
      esc(Math.round(p * 100) + '%') + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 17) + '" text-anchor="middle">' + esc(opt.caption || '달성률') + '</text>';
    return '<svg class="chart" viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="' + esc(opt.label || '달성률') +
      '" style="width:' + S + 'px;height:' + S + 'px">' + out + '</svg>';
  };

  /** 스파크라인 — 인라인 추세, 축 없음 */
  ch.spark = function (values, opt) {
    opt = opt || {};
    var W = opt.w || 84, H = opt.h || 22;
    if (!values.length) return '';
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = max - min || 1;
    var d = values.map(function (v, i) {
      var x = (i / Math.max(1, values.length - 1)) * (W - 2) + 1;
      var y = H - 2 - ((v - min) / span) * (H - 4);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    var up = values[values.length - 1] >= values[0];
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" style="width:' + W + 'px;height:' + H + 'px" aria-hidden="true">' +
      '<path d="' + d + '" fill="none" stroke="' + (up ? 'var(--color-pos)' : 'var(--color-neg)') + '" stroke-width="1.75" stroke-linejoin="miter"/></svg>';
  };

  /** 워터폴 — 파이프라인 변동(시작 → 유입/증액/감액/성사/실주 → 종료) */
  ch.waterfall = function (steps, opt) {
    opt = opt || {};
    var W = 640, H = opt.h || 220, padL = 62, padB = 42, padT = 14, padR = 10;
    var run = 0, mins = [0], maxs = [0];
    steps.forEach(function (s) {
      if (s.total) { mins.push(Math.min(0, s.value)); maxs.push(Math.max(0, s.value)); run = s.value; }
      else { var nxt = run + s.value; mins.push(Math.min(run, nxt)); maxs.push(Math.max(run, nxt)); run = nxt; }
    });
    var lo = Math.min.apply(null, mins), hi = nice(Math.max.apply(null, maxs));
    var pw = W - padL - padR, phh = H - padT - padB, bw = pw / steps.length;
    function yOf(v) { return padT + phh * (1 - (v - lo) / ((hi - lo) || 1)); }
    var out = '';
    [0, 0.5, 1].forEach(function (t) {
      var v = lo + (hi - lo) * t, y = yOf(v);
      out += '<line class="grid-line" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>';
      out += '<text x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + esc(opt.fmt ? opt.fmt(v) : U.num(v)) + '</text>';
    });
    run = 0;
    steps.forEach(function (s, i) {
      var start = s.total ? 0 : run;
      var end = s.total ? s.value : run + s.value;
      var y1 = yOf(Math.max(start, end)), y2 = yOf(Math.min(start, end));
      var cls = s.total ? 'bar' : s.value >= 0 ? 'bar--pos' : 'bar--neg';
      out += '<rect class="' + cls + '" x="' + (padL + i * bw + bw * 0.2).toFixed(1) + '" y="' + y1.toFixed(1) +
        '" width="' + (bw * 0.6).toFixed(1) + '" height="' + Math.max(1.5, y2 - y1).toFixed(1) + '" rx="0"><title>' +
        esc(s.label + ' ' + (opt.fmt ? opt.fmt(s.value) : U.num(s.value))) + '</title></rect>';
      out += '<text x="' + (padL + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 16) + '" text-anchor="middle">' + esc(s.label) + '</text>';
      out += '<text x="' + (padL + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' +
        esc((s.value > 0 && !s.total ? '+' : '') + (opt.fmt ? opt.fmt(s.value) : U.num(s.value))) + '</text>';
      if (!s.total) run = end; else run = s.value;
    });
    return svg(W, H, out, { h: H, label: opt.label });
  };

  ch.legend = function (items) {
    return '<div class="chart-legend">' + items.map(function (it) {
      return '<span><i style="background:' + (it.color || 'var(--color-series-' + (it.series || 1) + ')') + '"></i>' + esc(it.label) + '</span>';
    }).join('') + '</div>';
  };

  C.charts = ch;
})(window);
