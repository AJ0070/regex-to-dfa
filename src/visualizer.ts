import type { NFA, Transition } from './automata/nfa';
import type { DFA } from './automata/dfa';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    flowchart: {
        nodeSpacing: 70,
        rankSpacing: 80,
        curve: 'cardinal',
        htmlLabels: false,
        padding: 18
    }
});

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeMermaidLabel(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ');
}

function wrapSymbols(symbols: string[], maxLineLength = 16): string {
    const lines: string[] = [];
    let current = '';

    for (const symbol of symbols) {
        const next = current.length === 0 ? symbol : `${current}, ${symbol}`;
        if (next.length > maxLineLength && current.length > 0) {
            lines.push(current);
            current = symbol;
        } else {
            current = next;
        }
    }

    if (current.length > 0) {
        lines.push(current);
    }

    return lines.join('\\n');
}

function createStateNameMapper(states: Set<string>): (state: string) => string {
    const ids = new Map<string, string>();
    const used = new Set<string>();
    let counter = 0;

    for (const state of states) {
        const base = state === ''
            ? 'STATE_EMPTY'
            : `STATE_${state.replace(/[^A-Za-z0-9_]/g, '_')}`;
        let candidate = base;
        while (used.has(candidate)) {
            counter += 1;
            candidate = `${base}_${counter}`;
        }
        ids.set(state, candidate);
        used.add(candidate);
    }

    return (state: string): string => ids.get(state) ?? 'STATE_UNKNOWN';
}

function stateSortOrder(a: string, b: string, startState: string): number {
    if (a === startState && b !== startState) return -1;
    if (b === startState && a !== startState) return 1;
    return a.localeCompare(b);
}

function withNodePadding(label: string): string {
    // Extra horizontal padding prevents clipping for bold start/final labels.
    return `  ${label}  `;
}

export function toMermaid(automaton: NFA | DFA, title: string): string {
    const direction = automaton.states.size > 8 ? 'TB' : 'LR';
    let diagram = `flowchart ${direction}\n`;
    diagram += `  %% ${title}\n`;

    // Class definitions for clearer graph semantics.
    diagram += `  classDef accept fill:#11261f,stroke:#34d399,stroke-width:3px,color:#ffffff\n`;
    diagram += `  classDef normal fill:#111827,stroke:#94a3b8,stroke-width:2px,color:#e2e8f0\n`;
    diagram += `  classDef startNode fill:#2b1d63,stroke:#a78bfa,stroke-width:3px,color:#ffffff\n`;
    diagram += `  classDef startAccept fill:#163428,stroke:#4ade80,stroke-width:4px,color:#ffffff\n`;
    diagram += `  classDef invisible fill:none,stroke:none,color:transparent\n\n`;

    const toStateId = createStateNameMapper(automaton.states);
    const sortedStates = Array.from(automaton.states).sort((a, b) => stateSortOrder(a, b, automaton.startState));

    // Invisible start node pointing to start state
    const startId = toStateId(automaton.startState);
    diagram += `  __start[ ]:::invisible --> ${startId}\n`;
    diagram += `  style __start width:0px,height:0px\n\n`;

    const transitionsMap = new Map<string, Set<string>>();

    for (const t of automaton.transitions) {
        const key = `${toStateId(t.from)}:::${toStateId(t.to)}`;
        if (!transitionsMap.has(key)) transitionsMap.set(key, new Set<string>());
        transitionsMap.get(key)!.add(t.symbol);
    }

    const sortedTransitionKeys = Array.from(transitionsMap.keys()).sort();
    for (const key of sortedTransitionKeys) {
        const symbols = transitionsMap.get(key)!;
        const [from, to] = key.split(':::');
        const uniqueSymbols = Array.from(new Set(symbols)).sort();
        const wrapped = wrapSymbols(uniqueSymbols);
        const label = escapeMermaidLabel(wrapped);
        diagram += `  ${from} -->|"${label}"| ${to}\n`;
    }

    // Apply shapes and classes
    for (const state of sortedStates) {
        const sName = toStateId(state);
        const baseLabel = escapeMermaidLabel(state === '' ? '∅' : state);
        const label = withNodePadding(baseLabel);
        const isStart = state === automaton.startState;
        const isAccept = automaton.acceptStates.has(state);

        if (isAccept) {
            diagram += `  ${sName}((("${label}")))\n`; // Double circle
        } else {
            diagram += `  ${sName}(("${label}"))\n`; // Single circle
        }

        let cls = 'normal';
        if (isStart && isAccept) cls = 'startAccept';
        else if (isStart) cls = 'startNode';
        else if (isAccept) cls = 'accept';
        diagram += `  class ${sName} ${cls}\n`;
    }

    return diagram;
}

export function generateTransitionTableHTML(automaton: NFA | DFA): string {
    const alphabet = Array.from(automaton.alphabet).sort();
    if (automaton.transitions.some((t: Transition) => t.symbol === 'ε') && !alphabet.includes('ε')) {
        alphabet.push('ε');
    }

    let html = `<table class="transition-table">\n`;
    html += `  <thead>\n`;
    html += `    <tr>\n`;
    html += `      <th>State</th>\n`;
    for (const sym of alphabet) {
        html += `      <th>${escapeHtml(sym)}</th>\n`;
    }
    html += `    </tr>\n`;
    html += `  </thead>\n`;
    html += `  <tbody>\n`;

    const sortedStates = Array.from(automaton.states).sort();

    for (const state of sortedStates) {
        let prefix = '';
        if (automaton.startState === state) prefix += '→ ';
        if (automaton.acceptStates.has(state)) prefix += '* ';
        const displayState = escapeHtml(state || '∅');

        html += `    <tr>\n`;
        html += `      <td><b>${prefix}${displayState}</b></td>\n`;

        for (const sym of alphabet) {
            const targets = automaton.transitions
                .filter(t => t.from === state && t.symbol === sym)
                .map(t => t.to);
            const displayTargets = targets.length > 0 ? targets.map(t => escapeHtml(t)).join(', ') : '-';
            html += `      <td>${displayTargets}</td>\n`;
        }

        html += `    </tr>\n`;
    }

    html += `  </tbody>\n`;
    html += `</table>\n`;

    return html;
}
