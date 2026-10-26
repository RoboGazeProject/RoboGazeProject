/* Use & extend walkthrough: replays saved RoboGaze reports; no inference runs in the browser. */
(function () {
  'use strict';
  var section = document.getElementById('howto');
  if (!section) return;
  var byId = function (id) { return document.getElementById(id); };
  var tabs = Array.from(section.querySelectorAll('[data-use-route]'));
  var video = byId('use-video');
  var currentClip;
  var eventIndex = 0;
  var usageData = window.RoboGazeUsageData;
  var evidence = usageData.evidence;
  var pendingSeek = null;
  var inView = false;
  var caseButtons = Array.from(section.querySelectorAll('[data-use-example]'));
  var eventSelect = byId('use-event');

  function tabKeys(event, index, items, select) {
    var next;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    select(next);
    items[next].focus();
  }
  function selectRoute(index) {
    tabs.forEach(function (tab, i) {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      byId(tab.getAttribute('aria-controls')).hidden = i !== index;
    });
    if (index !== 0) video.pause();
    else if (inView) loadVideo();
  }
  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { selectRoute(index); });
    tab.addEventListener('keydown', function (event) { tabKeys(event, index, tabs, selectRoute); });
  });

  function plainText(markup) {
    var template = document.createElement('template');
    template.innerHTML = markup;
    return template.content.textContent;
  }
  function loadVideo() {
    if (!currentClip || video.getAttribute('src') === video.dataset.src) return;
    video.src = video.dataset.src;
    video.load();
  }
  function seekTo(time, trigger) {
    pendingSeek = time;
    loadVideo();
    if (video.readyState >= 1) {
      video.currentTime = Math.min(time, video.duration - .02);
      pendingSeek = null;
    }
    // Evidence inspection stays paused so the selected frame can be read.
    video.pause();
    section.querySelectorAll('[data-use-time]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button === trigger));
    });
  }
  video.addEventListener('loadedmetadata', function () {
    if (pendingSeek !== null) {
      video.currentTime = Math.min(pendingSeek, video.duration - .02);
      pendingSeek = null;
    }
  });
  video.addEventListener('timeupdate', function () {
    byId('use-source-time').textContent = (video.currentTime || 0).toFixed(1) + ' s';
  });
  video.addEventListener('play', function () {
    document.querySelectorAll('video').forEach(function (other) { if (other !== video) other.pause(); });
    section.querySelectorAll('[data-use-time]').forEach(function (button) { button.setAttribute('aria-pressed', 'false'); });
  });
  video.addEventListener('error', function () {
    byId('use-video-status').hidden = false;
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView && !byId('use-panel-diagnose').hidden) loadVideo();
      else video.pause();
    }, { threshold: 0 }).observe(video);
  } else { inView = true; }
  document.addEventListener('visibilitychange', function () { if (document.hidden) video.pause(); });

  function paintEvidence() {
    if (!currentClip || !evidence || !evidence[currentClip.id]) return;
    var frames = evidence[currentClip.id][eventIndex] || evidence[currentClip.id][0];
    var selected = currentClip.clean ? [frames[0], frames[frames.length - 1]] : [frames[0], frames[1]];
    var target = byId('use-evidence');
    target.replaceChildren();
    selected.forEach(function (frame) {
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.useTime = frame.time_s;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'Inspect ' + frame.label.toLowerCase() + ' at ' + frame.time_s.toFixed(1) + ' seconds in the input video');
      var image = document.createElement('img');
      image.src = frame.src;
      image.width = 480;
      image.height = 300;
      image.loading = 'lazy';
      image.alt = '';
      var caption = document.createElement('span');
      var label = document.createElement('b');
      label.textContent = currentClip.clean ? (frame === frames[0] ? 'Initial state' : 'Final state') : frame.label;
      var time = document.createElement('time');
      time.textContent = frame.time_s.toFixed(1) + ' s';
      caption.append(label, time);
      button.append(image, caption);
      button.addEventListener('click', function () { seekTo(frame.time_s, button); });
      target.append(button);
    });
  }
  function reportHref() {
    return currentClip.clean ? 'static/reports/cp_clean_b.report.json' : 'static/reports/cp_ic_dispenser.report.json';
  }
  function paintEvent() {
    var finding = currentClip.glitches[eventIndex];
    byId('use-finding').hidden = !finding;
    byId('use-empty').hidden = !!finding;
    byId('use-event-field').hidden = !finding;
    byId('use-report-count').textContent = currentClip.clean ? '0 events' : currentClip.glitches.length + ' events';
    if (finding) {
      byId('use-dimension').textContent = finding.dim;
      byId('use-finding-title').textContent = finding.type;
      byId('use-finding-description').textContent = finding.desc;
      byId('use-span').textContent = finding.start.toFixed(1) + '–' + finding.end.toFixed(1) + ' s';
      byId('use-span').dataset.useTime = finding.start;
      byId('use-span').setAttribute('aria-pressed', 'false');
      byId('use-severity').textContent = finding.severity + ' / 5';
      byId('use-severity-bars').replaceChildren();
      for (var i = 1; i <= 5; i++) {
        var bar = document.createElement('i');
        bar.className = i <= finding.severity ? 'filled' : '';
        byId('use-severity-bars').append(bar);
      }
    }
    byId('use-report-download').href = reportHref();
    byId('use-gallery-link').href = '?clip=' + currentClip.id + (finding ? '&event=' + eventIndex : '') + '#demo';
    byId('use-gallery-link').dataset.openClip = currentClip.id;
    if (finding) byId('use-gallery-link').dataset.event = eventIndex;
    else byId('use-gallery-link').removeAttribute('data-event');
    byId('use-format-code').textContent = JSON.stringify(finding ? usageData.reports[currentClip.id].events[eventIndex] : { clip_id: currentClip.id, events: [] }, null, 2);
    paintEvidence();
  }
  function selectExample(index) {
    var clipId = caseButtons[index].dataset.useExample;
    currentClip = window.CLIPS.find(function (clip) { return clip.id === clipId; });
    eventIndex = 0;
    video.pause();
    pendingSeek = null;
    video.removeAttribute('src');
    video.load();
    video.dataset.src = 'static/videos/clips/' + clipId + '.mp4';
    video.poster = 'static/images/usage/' + (currentClip.clean ? 'mug' : 'dispenser') + '-initial.jpg';
    byId('use-initial-frame').src = video.poster;
    byId('use-initial-frame').alt = 'Initial scene for ' + plainText(currentClip.task);
    byId('use-instruction').textContent = plainText(currentClip.task);
    byId('use-source-time').textContent = '0.0 s';
    byId('use-source-duration').textContent = currentClip.duration.toFixed(2) + ' s';
    byId('use-video-status').hidden = true;
    byId('use-input-download').href = currentClip.clean ? 'static/reports/cp_clean_b.input.json' : 'static/reports/cp_ic_dispenser.input.json';
    caseButtons.forEach(function (button, i) { button.setAttribute('aria-pressed', String(i === index)); });
    eventSelect.replaceChildren();
    currentClip.glitches.forEach(function (event, i) {
      var option = document.createElement('option');
      option.value = i;
      option.textContent = (i + 1) + '. ' + event.type;
      eventSelect.append(option);
    });
    paintEvent();
    if (inView && !byId('use-panel-diagnose').hidden) loadVideo();
  }
  caseButtons.forEach(function (button, i) { button.addEventListener('click', function () { selectExample(i); }); });
  eventSelect.addEventListener('change', function () {
    eventIndex = Number(eventSelect.value);
    paintEvent();
    seekTo(currentClip.glitches[eventIndex].start, byId('use-span'));
  });
  byId('use-span').addEventListener('click', function () { seekTo(Number(this.dataset.useTime), this); });
  selectExample(0);

  // A worked pair from the published qualitative comparison; no invented judge score.
  var benchmarkButtons = Array.from(section.querySelectorAll('[data-use-benchmark]'));
  function selectBenchmark(index) {
    benchmarkButtons.forEach(function (button, i) { button.setAttribute('aria-pressed', String(index === i)); });
    byId('use-benchmark-pair').hidden = index !== 0;
    byId('use-benchmark-clean').hidden = index !== 1;
    byId('use-pair-result').hidden = index !== 0;
    byId('use-clean-result').hidden = index !== 1;
  }
  benchmarkButtons.forEach(function (button, index) { button.addEventListener('click', function () { selectBenchmark(index); }); });
  var human = [2.4, 4.3], predicted = [2.7, 4.8];
  var intersection = Math.max(0, Math.min(human[1], predicted[1]) - Math.max(human[0], predicted[0]));
  var union = Math.max(human[1], predicted[1]) - Math.min(human[0], predicted[0]);
  byId('use-iou').textContent = (intersection / union).toFixed(2);
  byId('use-iou-formula').textContent = intersection.toFixed(1) + ' s intersection / ' + union.toFixed(1) + ' s union';

  var extensionTabs = Array.from(section.querySelectorAll('[data-use-extension]'));
  function selectExtension(index) {
    extensionTabs.forEach(function (button, i) {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      byId(button.getAttribute('aria-controls')).hidden = i !== index;
    });
    byId('use-extension-map').dataset.active = index;
  }
  extensionTabs.forEach(function (button, index) {
    button.addEventListener('click', function () { selectExtension(index); });
    button.addEventListener('keydown', function (event) { tabKeys(event, index, extensionTabs, selectExtension); });
  });
})();
