/* RoboGaze project page: demo player, autoplay loops, navigation. No dependencies. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ data
     Example reports shown in the demo. Edit here to update the page.
     Severity values marked "proposed" were filled in for display and should be
     checked against the RoboGaze output files. */
  var DIM = {
    tp:  { name: 'Task Progress',            color: '#d9822b' },
    ic:  { name: 'Instruction Consistency',  color: '#2f6fdf' },
    osc: { name: 'Object–Scene Consistency', color: '#0f9d76' },
    rbc: { name: 'Robot-Body Consistency',   color: '#7c4ddb' },
    pp:  { name: 'Physical Plausibility',    color: '#d6453d' },
    vq:  { name: 'Visual Quality',           color: '#1596b3' }
  };
  var EXAMPLES = [
    {
      id: 'button', title: 'A button vanishes', sub: '20 s clip from DreamDojo',
      video: 'static/video/demo/button.mp4', poster: 'static/video/demo/button.jpg', duration: 20.07,
      generator: 'DreamDojo', robot: 'Single arm',
      instruction: 'Press the pink and then the blue and then the green button.',
      events: [
        { dim: 'osc', type: 'Object disappearance', start: 12.0, end: 19.0, severity: 4 /* proposed */,
          why: 'The pink button disappears when the gripper passes through it.',
          marker: { x: 0.654, y: 0.494, r: 0.062, label: 'pink button was here' },
          evidence: [['button-e0-0', 'Before', 11.0], ['button-e0-1', 'During', 15.5], ['button-e0-2', 'After', 19.6]] }
      ]
    },
    {
      id: 'switch', title: 'Four failures in 12 s', sub: '12 s clip from DreamGen',
      video: 'static/video/demo/switch.mp4', poster: 'static/video/demo/switch.jpg', duration: 11.56,
      generator: 'DreamGen', robot: 'Gripper',
      instruction: 'Turn on the third switch from the left.',
      events: [
        { dim: 'osc', type: 'Object identity swap', start: 0.3, end: 2.0, severity: 3 /* proposed */,
          why: 'The light at the far left turns into a light with a white cover.',
          evidence: [['switch-e0-0', 'Before', 0.0], ['switch-e0-1', 'During', 1.15], ['switch-e0-2', 'After', 2.4]] },
        { dim: 'osc', type: 'Object disappearance', start: 3.5, end: 4.2, severity: 3 /* proposed */,
          why: 'The white cover of the light disappears.',
          evidence: [['switch-e1-0', 'Before', 3.0], ['switch-e1-1', 'During', 3.85], ['switch-e1-2', 'After', 4.6]] },
        { dim: 'ic', type: 'Wrong object', start: 5.8, end: 7.6, severity: 4 /* proposed */,
          why: 'The gripper presses the plug socket instead of the third switch.',
          evidence: [['switch-e2-0', 'Before', 5.2], ['switch-e2-1', 'During', 6.7], ['switch-e2-2', 'After', 8.0]] },
        { dim: 'tp', type: 'Task incompletion', start: 7.6, end: 11.56, severity: 4 /* proposed */,
          why: 'Because the wrong object is pressed, the switch light never changes state.',
          evidence: [['switch-e3-0', 'Before', 7.0], ['switch-e3-1', 'During', 9.6], ['switch-e3-2', 'End', 11.4]] }
      ]
    },
    {
      id: 'clean', title: 'A clean execution', sub: '6 s clip from Cosmos-Predict2.5',
      video: 'static/video/demo/clean.mp4', poster: 'static/video/demo/clean.jpg', duration: 5.81,
      generator: 'Cosmos-Predict2.5', robot: 'Humanoid',
      instruction: 'Use the right hand to pick up the white mug from right of the pink plate and move it to the center of the teal plate.',
      events: [],
      evidence: [['clean-e0-0', 'Start', 0.0], ['clean-e0-1', 'Middle', 2.9], ['clean-e0-2', 'End', 5.7]]
    }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  var fmt = function (x) { return x.toFixed(1); };
  var ALERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r=".6" fill="currentColor"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  var PAUSE = 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', PLAY = 'M8 5.5v13l11-6.5z';

  /* ------------------------------------------------------------------ demo */
  function Demo() {
    var v = $('dv'); if (!v) return;
    var vbox = $('vbox'), tabs = $('tabs'), findings = $('findings'), watching = $('watching'), count = $('count');
    var track = $('track'), head = $('head'), spans = $('spans'), ttime = $('ttime'), pp = $('pp');
    var cur = 0, shown = [], spanEls = [], cleanShown = false, manual = false, userTouched = false, inView = false, userPaused = false, endTimer = null;

    EXAMPLES.forEach(function (ex, i) {
      var b = el('button', 'tab', '<img src="' + ex.poster + '" alt="" loading="lazy"><span><b>' + ex.title + '</b><span>' + ex.sub + '</span></span>');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'tab-' + ex.id;
      b.addEventListener('click', function () { userTouched = true; select(i, true); });
      tabs.appendChild(b);
    });

    function setPP() { $('ppIcon').setAttribute('d', v.paused ? PLAY : PAUSE); pp.setAttribute('aria-label', v.paused ? 'Play' : 'Pause'); vbox.classList.toggle('paused', v.paused && v.currentTime > 0.05); }
    function play() { if (reduce && !userTouched) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); }

    function select(i, autoplay) {
      clearTimeout(endTimer);
      cur = i; var ex = EXAMPLES[i];
      [].forEach.call(tabs.children, function (b, k) { b.setAttribute('aria-selected', k === i ? 'true' : 'false'); b.tabIndex = k === i ? 0 : -1; });
      v.poster = ex.poster; v.src = ex.video; v.load();
      $('instr').innerHTML = '<small>Instruction</small>“' + ex.instruction + '”';
      $('meta').innerHTML = '<span>Generator <b>' + ex.generator + '</b></span><span>Robot <b>' + ex.robot + '</b></span><span>Length <b>' + fmt(ex.duration) + ' s</b></span>';
      spans.innerHTML = ''; spanEls = ex.events.map(function (e) {
        var s = el('div', 'span'); s.style.left = (e.start / ex.duration * 100) + '%'; s.style.background = DIM[e.dim].color; spans.appendChild(s); return s;
      });
      reset();
      if (autoplay && inView) { userPaused = false; play(); }
      setPP();
    }

    function reset() {
      findings.innerHTML = ''; shown = EXAMPLES[cur].events.map(function () { return null; }); cleanShown = false; manual = false;
      watching.hidden = false; count.textContent = '0 findings so far';
      vbox.classList.remove('alert');
    }

    function findingCard(e, k) {
      var d = DIM[e.dim];
      var c = el('article', 'finding'); c.style.setProperty('--c', d.color);
      var sev = ''; for (var j = 1; j <= 5; j++) sev += '<i class="' + (j <= e.severity ? 'on' : '') + '"></i>';
      var head = el('button', 'f-head', '<i class="fdot"></i><span class="f-what">' + e.type + '</span><span class="f-when mono">' + fmt(e.start) + '–' + fmt(e.end) + ' s</span>');
      head.type = 'button'; head.setAttribute('aria-expanded', 'false');
      var body = el('div', 'f-body',
        '<dl class="f-grid"><dt>Dimension</dt><dd><span class="dimchip" style="--c:' + d.color + '"><i></i>' + d.name + '</span></dd>' +
        '<dt>Severity</dt><dd><span class="sev" aria-label="Severity ' + e.severity + ' of 5">' + sev + '</span> <span class="mono sevn">' + e.severity + '/5</span></dd></dl>' +
        '<p class="f-why">' + e.why + '</p>');
      var btn = el('button', 'evbtn', CHEV + 'Show evidence frames'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
      var grid = el('div', 'evgrid'); grid.hidden = true;
      btn.addEventListener('click', function () {
        var open = grid.hidden; userTouched = true; manual = true;
        if (open && !grid.childElementCount) e.evidence.forEach(function (f) { grid.appendChild(el('figure', null, '<img src="static/img/evidence/' + f[0] + '.jpg" alt="' + f[1] + ' frame at ' + fmt(f[2]) + ' s" loading="lazy"><figcaption><b>' + f[1] + '</b>' + fmt(f[2]) + ' s</figcaption>')); });
        grid.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.lastChild.textContent = open ? 'Hide evidence frames' : 'Show evidence frames';
      });
      head.addEventListener('click', function () { manual = true; userTouched = true; openCard(c, !c.classList.contains('open')); });
      body.appendChild(btn); body.appendChild(grid);
      c.appendChild(head); c.appendChild(body);
      return c;
    }
    var mk = el('div', 'vmark'), mkl = el('div', 'vmark-l'); vbox.appendChild(mk); vbox.appendChild(mkl);
    function placeMarker(m) {
      if (!m || !v.videoWidth) { mk.style.opacity = 0; mkl.style.opacity = 0; return; }
      var W = vbox.clientWidth, H = vbox.clientHeight, s = Math.max(W / v.videoWidth, H / v.videoHeight);
      var dw = v.videoWidth * s, dh = v.videoHeight * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
      var x = ox + m.x * dw, y = oy + m.y * dh, r = m.r * dw;
      mk.style.cssText = 'opacity:1;left:' + (x - r) + 'px;top:' + (y - r) + 'px;width:' + 2 * r + 'px;height:' + 2 * r + 'px';
      mkl.textContent = m.label; mkl.style.cssText = 'opacity:1;left:' + x + 'px;top:' + (y + r + 8) + 'px';
    }
    function openCard(c, on) {
      if (on) shown.forEach(function (x) { if (x && x !== c) { x.classList.remove('open'); x.firstChild.setAttribute('aria-expanded', 'false'); } });
      c.classList.toggle('open', on); c.firstChild.setAttribute('aria-expanded', on ? 'true' : 'false');
    }

    function tick() {
      var ex = EXAMPLES[cur], D = ex.duration;
      var t = v.duration ? v.currentTime / v.duration * D : 0;
      head.style.left = (t / D * 100) + '%'; ttime.textContent = fmt(t) + ' s';
      track.setAttribute('aria-valuenow', Math.round(t / D * 100));
      var live = null, n = 0;
      ex.events.forEach(function (e, k) {
        var reached = t >= e.start - 0.02;
        spanEls[k].style.width = reached ? ((Math.min(t, e.end) - e.start) / D * 100) + '%' : '0';
        if (reached && !shown[k]) { shown[k] = findingCard(e, k); findings.appendChild(shown[k]); if (!manual) openCard(shown[k], true); }
        if (!reached && shown[k]) { shown[k].remove(); shown[k] = null; }
        if (shown[k]) { n++; var on = t >= e.start && t <= e.end + 0.05; shown[k].classList.toggle('live', on); if (on) live = e; }
      });
      if (ex.events.length) {
        watching.hidden = n > 0;
        count.textContent = n ? (n + (n === 1 ? ' finding' : ' findings') + (n < ex.events.length || t < D - 0.2 ? ' so far' : '')) : '0 findings so far';
      } else {
        var done = t >= D - 0.25 || v.ended;
        if (done && !cleanShown) {
          cleanShown = true; watching.hidden = true; count.textContent = 'empty report';
          var ok = el('div', 'clean-ok', '<b><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6"/></svg>No supported visible failure</b><p>The correct answer for this clip is an empty report. Prompted VLMs return one on only 17% of failure-free clips; RoboGaze on 85%.</p>');
          var e0 = { evidence: ex.evidence };
          var btn = el('button', 'evbtn', CHEV + 'Show the frames it checked'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
          var grid = el('div', 'evgrid'); grid.hidden = true;
          btn.addEventListener('click', function () { var open = grid.hidden; userTouched = true; if (open && !grid.childElementCount) e0.evidence.forEach(function (f) { grid.appendChild(el('figure', null, '<img src="static/img/evidence/' + f[0] + '.jpg" alt="' + f[1] + ' frame at ' + fmt(f[2]) + ' s" loading="lazy"><figcaption><b>' + f[1] + '</b>' + fmt(f[2]) + ' s</figcaption>')); }); grid.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
          ok.appendChild(btn); ok.appendChild(grid); findings.appendChild(ok);
        }
        if (!done && cleanShown) reset();
      }
      placeMarker(live && live.marker);
      if (live) { vbox.style.setProperty('--c', DIM[live.dim].color); $('vchipText').innerHTML = live.type + ' <span class="mono">' + fmt(live.start) + '–' + fmt(live.end) + ' s</span>'; }
      vbox.classList.toggle('alert', !!live);
      requestAnimationFrame(tick);
    }

    v.addEventListener('ended', function () {
      setPP();
      endTimer = setTimeout(function () {
        if (!inView || userPaused) return;
        if (!userTouched) select((cur + 1) % EXAMPLES.length, true);
        else { v.currentTime = 0; reset(); play(); }
      }, 2600);
    });
    v.addEventListener('play', setPP); v.addEventListener('pause', setPP);
    function toggle() { userTouched = true; if (v.paused) { userPaused = false; if (v.ended) { v.currentTime = 0; reset(); } play(); } else { userPaused = true; v.pause(); } }
    vbox.addEventListener('click', toggle); pp.addEventListener('click', toggle);
    function seek(clientX) {
      var r = track.getBoundingClientRect(), f = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
      userTouched = true; clearTimeout(endTimer); if (v.duration) v.currentTime = f * v.duration * 0.999;
    }
    track.addEventListener('click', function (e) { seek(e.clientX); });
    track.addEventListener('keydown', function (e) {
      if (!v.duration) return; var step = v.duration / 20;
      if (e.key === 'ArrowRight') { v.currentTime = Math.min(v.duration - .05, v.currentTime + step); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { v.currentTime = Math.max(0, v.currentTime - step); e.preventDefault(); }
    });
    tabs.addEventListener('keydown', function (e) {
      var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!k) return;
      var i = (cur + k + EXAMPLES.length) % EXAMPLES.length; userTouched = true; select(i, true); tabs.children[i].focus(); e.preventDefault();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { en.forEach(function (x) { inView = x.isIntersecting; if (inView && !userPaused && v.paused && !v.ended) play(); if (!inView) v.pause(); }); }, { threshold: 0.35 }).observe(vbox);
    } else { inView = true; }
    select(0, false);
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------- autoplay loops */
  function Loops() {
    var vids = [].slice.call(document.querySelectorAll('video.autoplay'));
    if (!vids.length) return;
    vids.forEach(function (v) { v.setAttribute('preload', 'none'); });
    if (reduce || !('IntersectionObserver' in window)) { vids.forEach(function (v) { v.controls = true; }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        var v = x.target;
        if (x.isIntersecting) { if (!v.dataset.userPaused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
        else v.pause();
      });
    }, { threshold: 0.25, rootMargin: '120px 0px' });
    vids.forEach(function (v) { io.observe(v); });
    [].forEach.call(document.querySelectorAll('.vctl'), function (b) {
      var v = $(b.getAttribute('data-for'));
      var path = b.querySelector('path');
      function sync() { path.setAttribute('d', v.paused ? PLAY : PAUSE); b.setAttribute('aria-label', v.paused ? 'Play animation' : 'Pause animation'); }
      b.addEventListener('click', function () { if (v.paused) { delete v.dataset.userPaused; v.play(); } else { v.dataset.userPaused = '1'; v.pause(); } });
      v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
    });
  }

  /* ------------------------------------------------------------- nav + progress */
  function Nav() {
    var nav = $('nav'), bar = $('progress');
    var links = [].slice.call(document.querySelectorAll('.nav li a, .toc a'));
    var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    function onScroll() {
      var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? y / h * 100 : 0) + '%';
      nav.classList.toggle('stuck', y > 8);
      var line = window.innerHeight * 0.3, topId = null, subId = null, bestTop = -Infinity, bestSub = -Infinity;
      links.forEach(function (a, i) {
        var t = targets[i]; if (!t) return;
        var top = t.getBoundingClientRect().top, isSub = !!a.closest('.toc ol');
        // the active section is the one whose start is closest above the reading line
        if (top < line) {
          if (isSub) { if (top > bestSub) { bestSub = top; subId = a.getAttribute('href'); } }
          else if (top > bestTop) { bestTop = top; topId = a.getAttribute('href'); }
        }
      });
      if (y < 40) topId = '#top';
      if (topId !== '#benchmark') subId = null;
      links.forEach(function (a) { var href = a.getAttribute('href'); a.classList.toggle('on', href === topId || href === subId); });
    }
    window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); onScroll();
  }

  /* ------------------------------------------------------------- overview video
     Muted autoplay while on screen (browsers only autoplay muted video). Pauses when
     scrolled away, never restarts after the viewer pauses it. The video is narrated:
     data-audio on the <video> shows the "Sound on" button, which unmutes and restarts
     from the beginning. */
  function Overview() {
    var v = $('ovVideo');
    if (!v) return;
    var auto = false, userPaused = false;
    v.addEventListener('pause', function () { if (auto) auto = false; else if (!v.ended) userPaused = true; });
    v.addEventListener('play', function () { userPaused = false; });
    function play() { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    if (!reduce && 'IntersectionObserver' in window) {
      v.preload = 'metadata';
      new IntersectionObserver(function (en) {
        en.forEach(function (x) {
          if (x.isIntersecting) { if (!userPaused && v.paused) play(); }
          else if (!v.paused) { auto = true; v.pause(); }
        });
      }, { threshold: 0.4 }).observe(v);
    }
    var btn = $('ovSound');
    if (btn && v.hasAttribute('data-audio')) {
      var restarted = false, label = btn.querySelector('span');
      function sync() { btn.classList.toggle('on', !v.muted); label.textContent = v.muted ? 'Sound on' : 'Mute'; btn.setAttribute('aria-pressed', String(!v.muted)); }
      btn.hidden = false;
      btn.addEventListener('click', function () {
        v.muted = !v.muted;
        if (!v.muted && !restarted) { restarted = true; v.currentTime = 0; }
        if (!v.muted) { userPaused = false; play(); }
        sync();
      });
      v.addEventListener('volumechange', sync); sync();
    }
  }

  function init() { Demo(); Loops(); Nav(); Overview(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
