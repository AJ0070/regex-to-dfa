import './style.css';
import { parseGrammar } from './automata/parser';
import { grammarToNFA } from './automata/nfa';
import { nfaToDFA } from './automata/dfa';
import { minimizeDFA } from './automata/minimize';
import { toMermaid, generateTransitionTableHTML } from './visualizer';
import mermaid from 'mermaid';

// UI Elements
const inputEl = document.getElementById('grammar-input') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const errorMsg = document.getElementById('error-message') as HTMLDivElement;
const tabBtns = document.querySelectorAll('.tab-btn');

// Views
const nfaView = document.getElementById('nfa-view')!;
const dfaView = document.getElementById('dfa-view')!;
const minDfaView = document.getElementById('min-dfa-view')!;

type ZoomState = {
  scale: number;
  x: number;
  y: number;
  isDragging: boolean;
  lastX: number;
  lastY: number;
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.12;
const graphZoomState = new Map<string, ZoomState>();
const pendingFit = new Set<string>();

function getZoomState(graphId: string): ZoomState {
  let state = graphZoomState.get(graphId);
  if (!state) {
    state = { scale: 1, x: 0, y: 0, isDragging: false, lastX: 0, lastY: 0 };
    graphZoomState.set(graphId, state);
  }
  return state;
}

function getGraphContainer(graphId: string): HTMLElement | null {
  return document.getElementById(graphId);
}

function getGraphSvg(graphId: string): SVGSVGElement | null {
  const container = getGraphContainer(graphId);
  if (!container) return null;
  return container.querySelector('svg');
}

function clampScale(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function applyGraphTransform(graphId: string): void {
  const svg = getGraphSvg(graphId);
  if (!svg) return;
  const state = getZoomState(graphId);
  svg.style.transformOrigin = '0 0';
  svg.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
}

function getSvgNaturalSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const box = svg.getBBox();
  const width = box.width > 0 ? box.width : svg.clientWidth;
  const height = box.height > 0 ? box.height : svg.clientHeight;
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function zoomBy(graphId: string, factor: number, anchorX?: number, anchorY?: number): void {
  const container = getGraphContainer(graphId);
  if (!container) return;

  const state = getZoomState(graphId);
  const rect = container.getBoundingClientRect();
  const px = anchorX ?? rect.width / 2;
  const py = anchorY ?? rect.height / 2;

  const oldScale = state.scale;
  const newScale = clampScale(oldScale * factor);
  if (newScale === oldScale) return;

  // Keep zoom anchored under the pointer/center.
  state.x = px - ((px - state.x) * (newScale / oldScale));
  state.y = py - ((py - state.y) * (newScale / oldScale));
  state.scale = newScale;

  applyGraphTransform(graphId);
}

function resetGraphView(graphId: string): void {
  const state = getZoomState(graphId);
  state.scale = 1;
  state.x = 0;
  state.y = 0;
  state.isDragging = false;
  applyGraphTransform(graphId);
}

function fitGraphToView(graphId: string): void {
  const container = getGraphContainer(graphId);
  const svg = getGraphSvg(graphId);
  if (!container || !svg) return;

  const state = getZoomState(graphId);
  const natural = getSvgNaturalSize(svg);
  const padding = 32;
  const availableWidth = Math.max(1, container.clientWidth - padding);
  const availableHeight = Math.max(1, container.clientHeight - padding);

  const fitScale = clampScale(Math.min(availableWidth / natural.width, availableHeight / natural.height));
  state.scale = fitScale;
  state.x = (container.clientWidth - natural.width * fitScale) / 2;
  state.y = (container.clientHeight - natural.height * fitScale) / 2;
  state.isDragging = false;

  applyGraphTransform(graphId);
}

function ensureGraphControls(graphId: string): void {
  const container = getGraphContainer(graphId);
  if (!container) return;

  const graphSection = container.closest('.graph-container');
  if (!graphSection) return;

  const existing = graphSection.querySelector(`.diagram-controls[data-graph-id="${graphId}"]`);
  if (existing) return;

  const controls = document.createElement('div');
  controls.className = 'diagram-controls';
  controls.setAttribute('data-graph-id', graphId);
  controls.innerHTML = `
    <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
    <button type="button" data-action="zoom-out" aria-label="Zoom out">-</button>
    <button type="button" data-action="fit" aria-label="Fit diagram">Fit</button>
    <button type="button" data-action="reset" aria-label="Reset view">Reset</button>
  `;

  controls.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    if (action === 'zoom-in') {
      zoomBy(graphId, ZOOM_STEP);
    } else if (action === 'zoom-out') {
      zoomBy(graphId, 1 / ZOOM_STEP);
    } else if (action === 'fit') {
      fitGraphToView(graphId);
    } else if (action === 'reset') {
      resetGraphView(graphId);
    }
  });

  const title = graphSection.querySelector('h3');
  if (title) {
    title.insertAdjacentElement('afterend', controls);
  } else {
    graphSection.prepend(controls);
  }
}

function initializeGraphInteractions(graphId: string): void {
  const container = getGraphContainer(graphId);
  if (!container) return;

  ensureGraphControls(graphId);

  if (container.dataset.interactiveReady === 'true') {
    return;
  }

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const anchorX = e.clientX - rect.left;
    const anchorY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomBy(graphId, factor, anchorX, anchorY);
  }, { passive: false });

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const state = getZoomState(graphId);
    state.isDragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    container.classList.add('dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    const state = getZoomState(graphId);
    if (!state.isDragging) return;

    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.x += dx;
    state.y += dy;
    applyGraphTransform(graphId);
  });

  window.addEventListener('mouseup', () => {
    const state = getZoomState(graphId);
    if (!state.isDragging) return;
    state.isDragging = false;
    container.classList.remove('dragging');
  });

  container.addEventListener('dblclick', () => {
    fitGraphToView(graphId);
  });

  container.dataset.interactiveReady = 'true';
}

// Tab Switching
tabBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Remove active from all tabs
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Add active to clicked target
    const target = (e.target as HTMLElement).getAttribute('data-target')!;
    (e.target as HTMLElement).classList.add('active');
    document.getElementById(target)!.classList.add('active');

    // Run any deferred fit calls now that the tab is visible.
    const tabEl = document.getElementById(target);
    if (tabEl) {
      tabEl.querySelectorAll<HTMLElement>('.mermaid-diagram').forEach(el => {
        if (el.id && pendingFit.has(el.id)) {
          pendingFit.delete(el.id);
          fitGraphToView(el.id);
        }
      });
    }
  });
});

async function renderMermaid(id: string, code: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.innerHTML = '';
  try {
    const { svg } = await mermaid.render(`${id}-svg`, code);
    element.innerHTML = svg;
  } catch (err: any) {
    console.error('Mermaid render error: ', err);
    element.innerHTML = `<p style="color:var(--error)">Error rendering diagram</p>`;
  }
}

function updateView(viewEl: HTMLElement, graphId: string, tableId: string, automaton: any, title: string) {
  const noData = viewEl.querySelector('.no-data') as HTMLElement;
  const content = viewEl.querySelector('.flex-row') as HTMLElement;

  noData.classList.add('hidden');
  content.classList.remove('hidden');

  // Generate table
  const tableContainer = document.getElementById(tableId);
  if (tableContainer) {
    tableContainer.innerHTML = generateTransitionTableHTML(automaton);
  }

  // Generate Graph
  const mermaidGraph = toMermaid(automaton, title);
  void renderMermaid(graphId, mermaidGraph).then(() => {
    initializeGraphInteractions(graphId);
    const container = getGraphContainer(graphId);
    if (container && container.clientWidth > 0) {
      fitGraphToView(graphId);
    } else {
      // Tab is hidden — defer fit until it becomes visible.
      pendingFit.add(graphId);
    }
  });
}

generateBtn.addEventListener('click', () => {
  const text = inputEl.value.trim();
  errorMsg.classList.add('hidden');

  if (!text) {
    errorMsg.textContent = 'Please enter a formal grammar first.';
    errorMsg.classList.remove('hidden');
    return;
  }

  try {
    // 1. Parse Grammar
    const grammar = parseGrammar(text);
    if (grammar.rules.length === 0) {
      throw new Error("No valid rules found. Example: S -> aA | b");
    }

    // 2. NFA
    const nfa = grammarToNFA(grammar);
    updateView(nfaView, 'nfa-graph', 'nfa-table', nfa, 'NFA');

    // 3. DFA
    const dfa = nfaToDFA(nfa);
    updateView(dfaView, 'dfa-graph', 'dfa-table', dfa, 'DFA');

    // 4. Minimized DFA
    const minDfa = minimizeDFA(dfa);
    updateView(minDfaView, 'min-dfa-graph', 'min-dfa-table', minDfa, 'Minimal DFA');

  } catch (err: any) {
    console.error(err);
    errorMsg.textContent = err.message || 'Error processing grammar. Please check your syntax.';
    errorMsg.classList.remove('hidden');
  }
});

// Optionally trigger on load if there's default text
if (inputEl.value.trim()) {
  generateBtn.click();
}
