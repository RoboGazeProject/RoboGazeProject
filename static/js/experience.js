/* Presentation controls around the original RoboGaze example viewer.
 * All reports and metrics are precomputed; these controls never run inference.
 */
(function () {
  'use strict';
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var demo = window.RoboGazeDemo;
  var byId = function (id) { return document.getElementById(id); };

  // A small, source-timestamped excerpt. Load only when it is near the viewport.
  var cover = byId('cover-video');
  var play = byId('cover-play');
  var seek = byId('cover-seek');
  var coverInView = false;
  var coverUserPaused = false;
  var coverLoaded = false;
  var coverFrame = null;
  function loadCover() {
    if (coverLoaded) return;
    var source = cover.querySelector('source');
    source.src = source.dataset.src;
    cover.load();
    coverLoaded = true;
  }
  function paintCover() {
    var time = Math.max(0, Math.min(12, cover.currentTime || 0));
    var original = time + 8;
    byId('cover-time').textContent = '00:' + original.toFixed(1).padStart(4, '0');
    seek.value = time;
    seek.setAttribute('aria-valuetext', original.toFixed(1) + ' seconds in the source clip');
    var event = original >= 12 && original <= 19;
    cover.parentElement.classList.toggle('is-event', event);
    cover.parentElement.querySelector('.cover-target span').textContent = event ? 'Reported disappearance' : 'Pink button';
    if (!cover.paused) coverFrame = requestAnimationFrame(paintCover);
    else coverFrame = null;
  }
  function tryCoverPlay() {
    if (!coverInView || document.hidden || motion.matches || coverUserPaused) return;
    loadCover();
    cover.play().catch(function () {});
  }
  play.addEventListener('click', function () {
    loadCover();
    if (cover.paused) {
      coverUserPaused = false;
      cover.play().catch(function () { play.textContent = 'Try playback again ▶'; });
    } else {
      coverUserPaused = true;
      cover.pause();
    }
  });
  cover.addEventListener('play', function () {
    play.textContent = 'Pause excerpt Ⅱ';
    play.setAttribute('aria-label', 'Pause evidence video');
    if (coverFrame === null) paintCover();
  });
  cover.addEventListener('pause', function () {
    play.textContent = 'Play excerpt ▶';
    play.setAttribute('aria-label', 'Play evidence video');
    if (coverFrame !== null) cancelAnimationFrame(coverFrame);
    coverFrame = null;
    paintCover();
  });
  cover.addEventListener('seeked', function () { if (cover.paused) paintCover(); });
  cover.addEventListener('error', function () {
    play.textContent = 'Video unavailable';
    play.disabled = true;
    byId('cover-time').textContent = 'Inspect the stills →';
  });
  seek.addEventListener('input', function () {
    loadCover();
    var requested = Number(seek.value);
    var apply = function () { cover.currentTime = Math.min(cover.duration - .02, requested); };
    if (cover.readyState) apply();
    else cover.addEventListener('loadedmetadata', apply, { once: true });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      coverInView = entries[0].isIntersecting;
      if (coverInView) tryCoverPlay();
      else cover.pause();
    }, { threshold: .15 }).observe(cover);
  } else { coverInView = true; }
  if (motion.addEventListener) motion.addEventListener('change', function () {
    if (motion.matches) cover.pause();
    else tryCoverPlay();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) document.querySelectorAll('video').forEach(function (video) { video.pause(); });
    else tryCoverPlay();
  });
  paintCover();

  // Reuse the main viewer from every example entry point.
  function connectExampleLinks(scope) {
    scope.querySelectorAll('[data-open-clip]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        if (!demo || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var index = link.hasAttribute('data-event') ? Number(link.dataset.event) : undefined;
        if (!demo.select(link.dataset.openClip, index)) return;
        var targetUrl = new URL(location.href);
        targetUrl.hash = 'demo';
        history.replaceState(null, '', targetUrl);
        if (!link.closest('#demo')) byId('demo').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
      });
    });
  }

  // The six perspectives are connected to existing, labeled example events.
  var dimensions = [
    { name: 'Task Progress', question: 'Did the task reach the required state?', clip: 'cp_tp_placement', event: 1, type: 'Failed placement', group: 'Task semantics' },
    { name: 'Instruction Consistency', question: 'Did it follow the instruction and constraints?', clip: 'cp_ic_dispenser', event: 0, type: 'Wrong target location', group: 'Task semantics' },
    { name: 'Object–Scene Consistency', question: 'Did the objects remain coherent?', clip: 'dd_osc_button', event: 0, type: 'Object disappearance', group: 'Entity consistency' },
    { name: 'Robot-Body Consistency', question: 'Did the robot keep its visible structure?', clip: 'cp_rbc_fingers', event: 0, type: 'Robot body deformation', group: 'Entity consistency' },
    { name: 'Physical Plausibility', question: 'Is the visible interaction physically supportable?', clip: 'cp_pp_grape', event: 0, type: 'Grasp without visible support', group: 'Physics & observability' },
    { name: 'Visual Quality', question: 'Is the evidence clear enough to judge?', clip: 'dd_vq_lowvis', event: 0, type: 'Low visibility', group: 'Physics & observability' }
  ];
  byId('dimension-grid').innerHTML = dimensions.map(function (d, i) {
    return '<a class="dimension-card" href="?clip=' + d.clip + '&amp;event=' + d.event + '#demo" data-open-clip="' + d.clip + '" data-event="' + d.event + '">' +
      '<div class="dimension-card-image"><img src="static/images/evidence/' + d.clip + '-e' + d.event + '-1.jpg" width="480" height="300" loading="lazy" alt="Selected example: ' + d.type + '"><span>' + d.group + '</span></div>' +
      '<h4>' + d.name + ' <span aria-hidden="true">→</span></h4>' +
      '<p class="dimension-name">' + d.type + '</p><p>' + d.question + '</p></a>';
  }).join('');
  connectExampleLinks(document);

  var currentClip = demo ? demo.getClip() : null;
  var currentEvent = 0;
  var frameManifest = null;
  var highlight = byId('evidence-toggle');
  var box = byId('v-evidence-box');
  function syncEvidence() {
    if (!currentClip) return;
    document.querySelectorAll('.case-selector [data-open-clip]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.openClip === currentClip.id ? 'true' : 'false');
    });
    var canHighlight = currentClip.id === 'dd_osc_button' && currentEvent === 0;
    highlight.hidden = !canHighlight;
    if (!canHighlight) { box.hidden = true; highlight.setAttribute('aria-pressed', 'false'); }
    byId('evidence-provenance').hidden = true;
    var finding = currentClip.glitches[currentEvent];
    byId('evidence-title').textContent = 'Visual evidence';
    byId('evidence-description').textContent = finding ? finding.type + ', ' + finding.start.toFixed(1) + '–' + finding.end.toFixed(1) + ' s' : 'Initial state, execution and final state';
    if (!frameManifest || !frameManifest[currentClip.id]) return;
    var frames = frameManifest[currentClip.id][currentEvent] || frameManifest[currentClip.id][0];
    byId('evidence-frames').replaceChildren();
    frames.forEach(function (frame) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'evidence-frame';
      button.setAttribute('aria-label', 'Inspect ' + frame.label.toLowerCase() + ' at ' + frame.time_s.toFixed(1) + ' seconds');
      var image = document.createElement('img');
      image.src = frame.src;
      image.alt = (finding ? finding.type : 'Clean execution') + ': ' + frame.label.toLowerCase() + ' at ' + frame.time_s.toFixed(1) + ' seconds';
      image.width = 480;
      image.height = 300;
      image.loading = 'lazy';
      var caption = document.createElement('span');
      caption.className = 'frame-caption';
      var label = document.createElement('b');
      label.textContent = frame.label;
      var time = document.createElement('span');
      time.textContent = frame.time_s.toFixed(1) + ' s';
      caption.append(label, time);
      button.append(image, caption);
      button.addEventListener('click', function () { demo.seek(frame.time_s); });
      byId('evidence-frames').append(button);
    });
  }
  document.addEventListener('robogaze:clipchange', function (event) {
    currentClip = event.detail.clip;
    currentEvent = 0;
    box.hidden = true;
    highlight.setAttribute('aria-pressed', 'false');
    highlight.textContent = 'Highlight evidence';
    syncEvidence();
  });
  document.addEventListener('robogaze:eventchange', function (event) {
    currentClip = event.detail.clip;
    currentEvent = event.detail.eventIndex;
    syncEvidence();
  });
  fetch('static/data/evidence_frames.json').then(function (response) {
    if (!response.ok) throw new Error('Evidence frames unavailable');
    return response.json();
  }).then(function (data) {
    frameManifest = data.clips;
    syncEvidence();
  }).catch(function () { var status = byId('evidence-provenance'); status.hidden = false; status.textContent = 'Evidence frames are unavailable. Use the video timeline above.'; });
  highlight.addEventListener('click', function () {
    var enabled = highlight.getAttribute('aria-pressed') !== 'true';
    highlight.setAttribute('aria-pressed', String(enabled));
    box.hidden = !enabled;
    highlight.textContent = enabled ? 'Hide highlight' : 'Highlight evidence';
  });
  byId('share-example').addEventListener('click', function () {
    var button = this;
    var url = new URL(location.href);
    url.searchParams.set('clip', currentClip.id);
    if (currentClip.glitches[currentEvent]) url.searchParams.set('event', currentEvent);
    else url.searchParams.delete('event');
    url.hash = 'demo';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url.href).then(function () {
        button.textContent = 'Link copied';
        setTimeout(function () { button.textContent = 'Copy link'; }, 2200);
      }).catch(function () { showLink(url.href, button); });
    } else showLink(url.href, button);
  });
  function showLink(url, after) {
    var field = byId('example-link-fallback');
    if (!field) {
      field = document.createElement('input');
      field.id = 'example-link-fallback';
      field.type = 'text';
      field.readOnly = true;
      field.setAttribute('aria-label', 'Example link to copy');
      field.style.cssText = 'width:100%;padding:10px;border:1px solid #cad1be;border-radius:3px;font:12px Arial;margin-top:8px;';
      after.parentElement.append(field);
    }
    field.value = url;
    field.focus();
    field.select();
  }
  syncEvidence();

  // Compare matched regions from two real source frames.
  var compare = byId('critic-frame-compare');
  var compareSlider = byId('critic-frame-slider');
  function updateCompare() {
    var split = Number(compareSlider.value);
    compare.style.setProperty('--compare-split', split + '%');
    compare.classList.toggle('only-before', split === 100);
    compare.classList.toggle('only-after', split === 0);
    compareSlider.setAttribute('aria-valuetext', split === 100 ? 'Before frame at 8 seconds' : split === 0 ? 'After frame at 17 seconds' : 'Before frame ' + split + ' percent, after frame ' + (100 - split) + ' percent');
  }
  compareSlider.addEventListener('input', updateCompare);
  updateCompare();

  // Original qualitative image assets with a shared source-time cursor.
  var qualTabs = Array.from(document.querySelectorAll('[data-qual-case]'));
  function selectQualCase(index, focus) {
    qualTabs.forEach(function (tab, i) {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      byId('qual-panel-' + i).hidden = i !== index;
    });
    if (focus) qualTabs[index].focus();
  }
  function tabKeys(event, index, count, select) {
    if (event.key === 'ArrowRight') { event.preventDefault(); select((index + 1) % count, true); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); select((index + count - 1) % count, true); }
    if (event.key === 'Home') { event.preventDefault(); select(0, true); }
    if (event.key === 'End') { event.preventDefault(); select(count - 1, true); }
  }
  qualTabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { selectQualCase(index, false); });
    tab.addEventListener('keydown', function (event) { tabKeys(event, index, qualTabs.length, selectQualCase); });
  });
  document.querySelectorAll('.qual-panel').forEach(function (panel, caseIndex) {
    var frameTabs = Array.from(panel.querySelectorAll('[data-qual-frame]'));
    var duration = Number(panel.dataset.duration);
    function selectFrame(index, focus) {
      var button = frameTabs[index];
      var thumbnail = button.querySelector('img');
      var image = byId('qual-image-' + caseIndex);
      image.src = button.dataset.src;
      image.width = Number(thumbnail.getAttribute('width'));
      image.height = Number(thumbnail.getAttribute('height'));
      image.alt = panel.querySelector('h3').textContent + ': ' + button.dataset.label + ' at ' + Number(button.dataset.time).toFixed(1) + ' seconds';
      byId('qual-caption-' + caseIndex).textContent = button.dataset.label;
      byId('qual-time-' + caseIndex).textContent = Number(button.dataset.time).toFixed(1) + ' s';
      byId('qual-stage-' + caseIndex).setAttribute('aria-labelledby', button.id);
      frameTabs.forEach(function (frameTab, i) {
        frameTab.setAttribute('aria-selected', String(i === index));
        frameTab.tabIndex = i === index ? 0 : -1;
      });
      panel.querySelectorAll('.qual-frame-cursor').forEach(function (cursor) { cursor.style.left = Number(button.dataset.time) / duration * 100 + '%'; });
      if (focus) button.focus();
    }
    frameTabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { selectFrame(index, false); });
      tab.addEventListener('keydown', function (event) { tabKeys(event, index, frameTabs.length, selectFrame); });
    });
    panel.querySelector('[data-qual-zoom]').addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('robogaze:zoom', { detail: { image: byId('qual-image-' + caseIndex), src: byId('qual-image-' + caseIndex).src, trigger: this } }));
    });
  });

  // Three explicit, keyboard-accessible phases; no simulated inference.
  var phase = 0;
  var phases = ['Ground', 'Analyze', 'Verify'];
  var tabs = Array.from(document.querySelectorAll('[data-phase]'));
  function setPhase(index, focus) {
    phase = index;
    tabs.forEach(function (tab, i) {
      tab.setAttribute('aria-selected', String(index === i));
      tab.tabIndex = index === i ? 0 : -1;
      byId('phase-panel-' + i).hidden = index !== i;
    });
    byId('next-phase').textContent = phase === 2 ? 'Back to Ground ↺' : 'Next: ' + phases[phase + 1] + ' →';
    if (focus) tabs[index].focus();
  }
  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { setPhase(index, false); });
    tab.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') { event.preventDefault(); setPhase((index + 1) % 3, true); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); setPhase((index + 2) % 3, true); }
      if (event.key === 'Home') { event.preventDefault(); setPhase(0, true); }
      if (event.key === 'End') { event.preventDefault(); setPhase(2, true); }
    });
  });
  byId('next-phase').addEventListener('click', function () { setPhase((phase + 1) % 3, false); });
  document.querySelector('.walkthrough-details').addEventListener('toggle', function () {
    var video = byId('rg-video');
    var source = video.querySelector('source');
    if (this.open && !source.getAttribute('src')) { source.src = source.dataset.src; video.load(); }
    if (!this.open) video.pause();
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) byId('rg-video').pause();
  }, { threshold: .1 }).observe(byId('rg-video'));

  // Native responsive plot, generated from the exact data used by the paper table.
  if (window.MAIN) {
    var plot = byId('backbone-plot');
    var position = function (value) { return (value - 30) / 50 * 100; };
    MAIN.forEach(function (row) {
      var item = document.createElement('div');
      item.className = 'backbone-row';
      item.setAttribute('aria-label', row.m + ': GLiDE+ ' + row.f[1].toFixed(1) + ', RoboGaze ' + row.f[2].toFixed(1) + ' description F1');
      var start = position(row.f[1]);
      var end = position(row.f[2]);
      item.innerHTML = '<span class="backbone-name">' + row.m + '</span><div class="backbone-track" aria-hidden="true"><span class="backbone-connection" style="left:' + start + '%;width:' + (end - start) + '%"></span><i class="plot-dot baseline" style="left:' + start + '%"></i><i class="plot-dot" style="left:' + end + '%"></i><span class="plot-value baseline" style="left:' + start + '%">' + row.f[1].toFixed(1) + '</span><span class="plot-value ours" style="left:' + end + '%">' + row.f[2].toFixed(1) + '</span></div>';
      plot.append(item);
    });
    var axis = document.createElement('div');
    axis.className = 'backbone-axis';
    axis.setAttribute('aria-hidden', 'true');
    axis.innerHTML = '<span></span><div><span>30</span><span>40</span><span>50</span><span>60</span><span>70</span><span>80</span></div>';
    plot.append(axis);
  }
  document.querySelectorAll('[data-critic]').forEach(function (button) {
    button.addEventListener('click', function () {
      var on = button.dataset.critic === 'on';
      document.querySelectorAll('[data-critic]').forEach(function (option) { option.setAttribute('aria-pressed', String(option === button)); });
      document.querySelector('.critic-lab').classList.toggle('without-critic', !on);
      byId('critic-clean').textContent = on ? '86%' : '21%';
      byId('critic-recall').textContent = on ? '91%' : '94%';
      byId('critic-clean-bar').style.width = on ? '86%' : '21%';
      byId('critic-recall-bar').style.width = on ? '91%' : '94%';
      byId('critic-explanation').textContent = on ? 'Verification filters unsupported findings while retaining most severe events.' : 'More severe events are recalled, but unsupported reports on clean clips become much more frequent.';
    });
  });
})();
