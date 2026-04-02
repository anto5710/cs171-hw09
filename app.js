const TOTAL_STEPS = 4;
const MEASURED_TRIALS_PER_BLOCK = 8;
const PRACTICE_TRIALS_PER_BLOCK = 1;
const FIXED_VIEWPORT_MIN_W = 1420;
const FIXED_VIEWPORT_MIN_H = 860;
const GOOGLE_APPS_SCRIPT_URL = ''; // paste your deployed Apps Script web app URL here
const SHARED_SECRET = ''; // optional: same secret used in Apps Script backend

const BASE_MENU = [
  { id: 'file', label: 'File', items: ['New', 'Open', 'Save', 'Save As'] },
  { id: 'edit', label: 'Edit', items: ['Copy', 'Paste', 'Cut', 'Undo'] },
  { id: 'insert', label: 'Insert', items: ['Hyperlink', 'Image', 'Table'] },
  { id: 'view', label: 'View', items: ['Zoom In', 'Zoom Out', 'Fullscreen'] },
  { id: 'tools', label: 'Tools', items: ['Settings', 'Preferences', 'Extensions'] },
  { id: 'help', label: 'Help', items: ['Documentation', 'About'] }
];

const MEASURED_TARGETS = [
  { category: 'File', item: 'Open' },
  { category: 'Edit', item: 'Copy' },
  { category: 'Edit', item: 'Paste' },
  { category: 'Insert', item: 'Hyperlink' },
  { category: 'Insert', item: 'Image' },
  { category: 'Tools', item: 'Settings' },
  { category: 'Tools', item: 'Preferences' },
  { category: 'View', item: 'Fullscreen' }
];

const PRACTICE_TARGETS = [
  { category: 'Help', item: 'About' },
  { category: 'View', item: 'Zoom In' }
];

const state = {
  ovStep: 0,
  consentOk: false,
  participantId: '',
  sessionId: '',
  orientationOrder: [],
  blockIndex: 0,
  trialIndex: 0,
  active: false,
  experimentStarted: false,
  timerStart: null,
  raf: null,
  blockPlans: [],
  allResults: [],
  currentTrial: null,
  currentMenuLayout: null,
  posted: false,
};

function shuffle(arr, rng = Math.random) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickInitialOrientation() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] % 2 === 0) ? 'horizontal' : 'vertical';
}

function makeSessionId() {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `S${Date.now().toString(36)}${values[0].toString(36)}${values[1].toString(36)}`;
}

function updateOverlayStep(n) {
  document.querySelectorAll('.ov-panel').forEach((panel, idx) => panel.classList.toggle('active', idx === n));
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.className = 'ov-dot' + (i < n ? ' done' : i === n ? ' active' : '');
  }
  document.getElementById('step-lbl').textContent = `Step ${n + 1} of ${TOTAL_STEPS}`;
  document.getElementById('btn-back').style.display = n > 0 ? 'inline-block' : 'none';
  const isLast = n === TOTAL_STEPS - 1;
  document.getElementById('btn-next').style.display = isLast ? 'none' : 'inline-block';
  document.getElementById('btn-begin').style.display = isLast ? 'inline-block' : 'none';

  const nextBtn = document.getElementById('btn-next');
  if (n === 2) {
    nextBtn.disabled = !state.consentOk;
    nextBtn.style.opacity = state.consentOk ? '1' : '0.4';
  } else {
    nextBtn.disabled = false;
    nextBtn.style.opacity = '1';
  }
  state.ovStep = n;
}

function ovNext() { if (state.ovStep < TOTAL_STEPS - 1) updateOverlayStep(state.ovStep + 1); }
function ovBack() { if (state.ovStep > 0) updateOverlayStep(state.ovStep - 1); }

function checkConsent() {
  state.consentOk = ['c1', 'c2', 'c3', 'c4', 'c5'].every(id => document.getElementById(id).checked);
  if (state.ovStep === 2) {
    const btn = document.getElementById('btn-next');
    btn.disabled = !state.consentOk;
    btn.style.opacity = state.consentOk ? '1' : '0.4';
  }
}

function checkLaunch() {
  document.getElementById('btn-begin').disabled = !document.getElementById('ov-pid').value.trim();
}

function beginExp() {
  const pid = document.getElementById('ov-pid').value.trim();
  if (!pid) return;
  state.participantId = pid;
  state.sessionId = makeSessionId();
  const first = pickInitialOrientation();
  state.orientationOrder = [first, first === 'horizontal' ? 'vertical' : 'horizontal'];
  state.blockPlans = buildBlockPlans();
  state.blockIndex = 0;
  state.trialIndex = 0;
  state.allResults = [];
  state.posted = false;

  document.getElementById('exp-pid-display').textContent = `Participant: ${pid}`;
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('experiment-shell').classList.add('visible');
  document.getElementById('experiment-shell').setAttribute('aria-hidden', 'false');

  state.experimentStarted = true;
  fitExperimentShell();
  resetVisibleState();
  fitExperimentShell();
  prepareCurrentTrial();
}

function buildBlockPlans() {
  return state.orientationOrder.map((orientation, blockIdx) => {
    const measuredTargets = shuffle(MEASURED_TARGETS).slice(0, MEASURED_TRIALS_PER_BLOCK);
    const trials = measuredTargets.map((target, idx) => makeTrialDefinition(orientation, 'measured', idx + 1, target));
    const practiceTarget = PRACTICE_TARGETS[blockIdx % PRACTICE_TARGETS.length];
    const practice = [makeTrialDefinition(orientation, 'practice', 1, practiceTarget)];
    return { orientation, practice, trials };
  });
}

function makeTrialDefinition(orientation, phase, ordinal, target) {
  const categories = shuffle(BASE_MENU).map(category => ({
    label: category.label,
    items: shuffle(category.items)
  }));
  const targetCategory = categories.find(category => category.label === target.category);
  if (!targetCategory || !targetCategory.items.includes(target.item)) {
    throw new Error('Target generation failed.');
  }
  return {
    orientation,
    phase,
    ordinal,
    targetCategory: target.category,
    targetItem: target.item,
    instructionPath: `${target.category} → ${target.item}`,
    categories,
  };
}

function getBlockPlan() {
  return state.blockPlans[state.blockIndex];
}

function getCombinedTrials(plan) {
  return [...plan.practice, ...plan.trials];
}

function prepareCurrentTrial() {
  const plan = getBlockPlan();
  const combined = getCombinedTrials(plan);
  if (state.trialIndex >= combined.length) {
    finishCurrentBlock();
    return;
  }
  state.currentTrial = combined[state.trialIndex];
  renderStage(state.currentTrial);
  updateStatusText();
  showStartOverlay();
}

function renderStage(trialDef) {
  const root = document.getElementById('stage-root');
  root.innerHTML = '';
  const menuBar = document.createElement('div');
  menuBar.className = `menu-bar ${trialDef.orientation} disabled`;
  menuBar.id = 'menu-bar';

  trialDef.categories.forEach(category => {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'menu-category';

    const button = document.createElement('button');
    button.className = 'category-button';
    button.type = 'button';
    button.textContent = category.label;
    button.setAttribute('aria-haspopup', 'true');

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';

    category.items.forEach(item => {
      const itemBtn = document.createElement('button');
      itemBtn.className = 'dropdown-button';
      itemBtn.type = 'button';
      itemBtn.textContent = item;
      itemBtn.dataset.category = category.label;
      itemBtn.dataset.item = item;
      itemBtn.dataset.path = `${category.label} → ${item}`;
      itemBtn.addEventListener('click', () => recordSelection(itemBtn.dataset.category, itemBtn.dataset.item, itemBtn.dataset.path));
      dropdown.appendChild(itemBtn);
    });

    categoryEl.appendChild(button);
    categoryEl.appendChild(dropdown);
    menuBar.appendChild(categoryEl);
  });

  root.appendChild(menuBar);
  state.currentMenuLayout = menuBar;
  fitExperimentShell();
}

function updateStatusText() {
  const plan = getBlockPlan();
  const practiceTotal = plan.practice.length;
  const measuredTotal = plan.trials.length;
  const practiceDone = Math.min(state.trialIndex, practiceTotal);
  const measuredDone = Math.max(0, state.trialIndex - practiceTotal);

  document.getElementById('block-status').textContent = `Block ${state.blockIndex + 1} of ${state.blockPlans.length}`;
  document.getElementById('progress').textContent = `Practice ${practiceDone} of ${practiceTotal} · Trial ${measuredDone} of ${measuredTotal}`;
  document.getElementById('task-text').textContent = `Prepare for: ${state.currentTrial.instructionPath}`;
  const banner = document.getElementById('task-banner-text');
  if (banner) banner.textContent = state.currentTrial.instructionPath;
}

function showStartOverlay() {
  document.getElementById('start-path').textContent = state.currentTrial.instructionPath;
  document.getElementById('start-overlay').classList.remove('hidden');
  if (state.currentMenuLayout) state.currentMenuLayout.classList.add('disabled');
  document.getElementById('start-button').focus();
}

function beginTrialFromCenter() {
  document.getElementById('start-overlay').classList.add('hidden');
  if (state.currentMenuLayout) state.currentMenuLayout.classList.remove('disabled');
  state.timerStart = performance.now();
  state.active = true;
  tick();
}

function tick() {
  if (!state.active || state.timerStart === null) return;
  const elapsed = (performance.now() - state.timerStart) / 1000;
  state.raf = requestAnimationFrame(tick);
}

function recordSelection(clickedCategory, clickedItem, clickedPath) {
  if (!state.active || !state.currentTrial) return;
  cancelAnimationFrame(state.raf);
  const rt = Math.round(performance.now() - state.timerStart);
  state.active = false;
  state.timerStart = null;
  if (state.currentMenuLayout) state.currentMenuLayout.classList.add('disabled');

  const correct = clickedCategory === state.currentTrial.targetCategory && clickedItem === state.currentTrial.targetItem;
  const row = {
    sessionId: state.sessionId,
    participantId: state.participantId,
    block: state.blockIndex + 1,
    orderIndex: state.orientationOrder.join('→'),
    orientation: state.currentTrial.orientation,
    phase: state.currentTrial.phase,
    trialOrdinal: state.currentTrial.ordinal,
    targetCategory: state.currentTrial.targetCategory,
    targetItem: state.currentTrial.targetItem,
    targetPath: state.currentTrial.instructionPath,
    clickedCategory,
    clickedItem,
    clickedPath,
    correct,
    rt,
    timestamp: new Date().toISOString(),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    menuLayout: state.currentTrial.categories,
  };

  state.allResults.push(row);
  setFeedback(row);
  state.trialIndex += 1;
  updateSummary();
  setTimeout(() => prepareCurrentTrial(), 250);
}

function appendLogRow(row) {
  return;
}

function setFeedback(row) {
  const feedback = document.getElementById('feedback');
  feedback.textContent = row.correct
    ? `Recorded: ${row.clickedPath} in ${row.rt} ms.`
    : `Recorded error: expected ${row.targetPath}, but clicked ${row.clickedPath}. (${row.rt} ms)`;
}

function updateSummary() {
  const measured = state.allResults.filter(r => r.phase === 'measured');
  if (!measured.length) {
    return;
  }
  const rts = measured.map(r => r.rt);
  const n = rts.length;
  const mean = rts.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(rts.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / n);
  const acc = measured.filter(r => r.correct).length / n * 100;}

function finishCurrentBlock() {
  if (state.blockIndex < state.blockPlans.length - 1) {
    document.getElementById('transition-title').textContent = 'Layout Switch';
    document.getElementById('transition-text').textContent = 'The next block uses the alternate menu layout. The task format stays exactly the same.';
    document.getElementById('transition-overlay').classList.remove('hidden');
    document.getElementById('transition-button').onclick = () => {
      document.getElementById('transition-overlay').classList.add('hidden');
      state.blockIndex += 1;
      state.trialIndex = 0;
      prepareCurrentTrial();
    };
  } else {
    completeExperiment();
  }
}

async function completeExperiment() {
  document.getElementById('task-text').textContent = 'Experiment complete. Thank you.';
  document.getElementById('start-overlay').classList.add('hidden');
  document.getElementById('transition-title').textContent = 'Experiment Complete';
  document.getElementById('transition-text').textContent = 'Your CSV file is downloading automatically.';
  document.getElementById('transition-button').textContent = 'Close Message';
  document.getElementById('transition-button').onclick = () => {
    document.getElementById('transition-overlay').classList.add('hidden');
  };
  document.getElementById('transition-overlay').classList.remove('hidden');
  exportCSV();
  await postResults();
}

function resetVisibleState() {
  cancelAnimationFrame(state.raf);
  state.active = false;
  state.timerStart = null;
  document.getElementById('post-status').textContent = '';
  document.getElementById('transition-button').textContent = 'Continue';
  document.getElementById('transition-overlay').classList.add('hidden');
}

function resetExperiment() {
  if (!state.experimentStarted) return;
  state.sessionId = makeSessionId();
  const first = pickInitialOrientation();
  state.orientationOrder = [first, first === 'horizontal' ? 'vertical' : 'horizontal'];
  state.blockPlans = buildBlockPlans();
  state.blockIndex = 0;
  state.trialIndex = 0;
  state.allResults = [];
  state.posted = false;
  resetVisibleState();
  fitExperimentShell();
  prepareCurrentTrial();
}

function getExportPayload() {
  return {
    participantId: state.participantId,
    sessionId: state.sessionId,
    conditionOrder: state.orientationOrder,
    timestamp: new Date().toISOString(),
    experimentVersion: 'ghpages-controlled-v1',
    practiceTrialsPerBlock: PRACTICE_TRIALS_PER_BLOCK,
    measuredTrialsPerBlock: MEASURED_TRIALS_PER_BLOCK,
    results: state.allResults,
    summary: summarizeByOrientation(),
  };
}

function summarizeByOrientation() {
  const out = {};
  ['horizontal', 'vertical'].forEach(orientation => {
    const rows = state.allResults.filter(r => r.orientation === orientation && r.phase === 'measured');
    if (!rows.length) {
      out[orientation] = { n: 0, mean: null, sd: null, accuracy: null, errors: 0 };
      return;
    }
    const rts = rows.map(r => r.rt);
    const mean = rts.reduce((a, b) => a + b, 0) / rows.length;
    const sd = Math.sqrt(rts.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / rows.length);
    const errors = rows.filter(r => !r.correct).length;
    out[orientation] = {
      n: rows.length,
      mean: Number(mean.toFixed(2)),
      sd: Number(sd.toFixed(2)),
      accuracy: Number((((rows.length - errors) / rows.length) * 100).toFixed(1)),
      errors,
    };
  });
  return out;
}

function exportCSV() {
  if (!state.allResults || !state.allResults.length) return;

  const headers = Object.keys(state.allResults[0]);
  const csvRows = [
    headers.join(','),
    ...state.allResults.map(row =>
      headers.map(h => {
        const val = row[h] ?? '';
        return `"${val.toString().replace(/"/g, '""')}"`;
      }).join(',')
    )
  ];

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dropdown_experiment_${state.participantId || 'data'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function postResults() {
  const status = document.getElementById('post-status');
  if (!GOOGLE_APPS_SCRIPT_URL) {
    status.textContent = 'Spreadsheet posting is not configured yet. Add your Apps Script URL in app.js.';
    return;
  }
  try {
    status.textContent = 'Posting results to spreadsheet…';
    const payload = getExportPayload();
    if (SHARED_SECRET) payload.secret = SHARED_SECRET;
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, raw: text };
    }
    status.textContent = data.ok
      ? `Posted successfully. Rows written: ${data.rows_written ?? 'n/a'}.`
      : `Post failed. ${data.error || data.raw || 'Unknown error.'}`;
  } catch (err) {
    status.textContent = `Post failed. ${String(err)}`;
  }
}

function fitExperimentShell() {
  const layout = document.getElementById('frame-layout');
  if (!layout) return;
  layout.style.transform = 'scale(1)';
  const shell = document.getElementById('experiment-shell');
  const availableW = Math.max(320, window.innerWidth - 48);
  const availableH = Math.max(320, window.innerHeight - 48);
  const rect = layout.getBoundingClientRect();
  const scale = Math.min(1, availableW / rect.width, availableH / rect.height);
  layout.style.transform = `scale(${scale})`;
  shell.style.paddingBottom = `${Math.max(24, rect.height * scale < availableH ? 24 : 48)}px`;
}

window.addEventListener('resize', () => {
  if (state.experimentStarted) fitExperimentShell();
});

document.getElementById('start-button').addEventListener('click', beginTrialFromCenter);
document.getElementById('btn-reset').addEventListener('click', resetExperiment);
document.getElementById('btn-export').addEventListener('click', exportCSV);

window.ovNext = ovNext;
window.ovBack = ovBack;
window.checkConsent = checkConsent;
window.checkLaunch = checkLaunch;
window.beginExp = beginExp;

updateOverlayStep(0);
