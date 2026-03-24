import type { NFA, Transition } from './nfa';

export interface DFA {
    states: Set<string>;
    alphabet: Set<string>;
    transitions: Transition[];
    startState: string;
    acceptStates: Set<string>;
}

export function epsilonClosure(nfa: NFA, states: Set<string>): Set<string> {
    const closure = new Set(states);
    const stack = Array.from(states);

    while (stack.length > 0) {
        const currentState = stack.pop()!;
        for (const transition of nfa.transitions) {
            if (transition.from === currentState && transition.symbol === 'ε') {
                if (!closure.has(transition.to)) {
                    closure.add(transition.to);
                    stack.push(transition.to);
                }
            }
        }
    }

    return closure;
}

export function move(nfa: NFA, states: Set<string>, symbol: string): Set<string> {
    const result = new Set<string>();
    for (const state of states) {
        for (const transition of nfa.transitions) {
            if (transition.from === state && transition.symbol === symbol) {
                result.add(transition.to);
            }
        }
    }
    return result;
}

export function nfaToDFA(nfa: NFA): DFA {
    const dfa: DFA = {
        states: new Set(),
        alphabet: new Set(Array.from(nfa.alphabet).filter(a => a !== 'ε')),
        transitions: [],
        startState: '',
        acceptStates: new Set(),
    };

    const startClosure = epsilonClosure(nfa, new Set([nfa.startState]));
    const startStateName = Array.from(startClosure).sort().join(',');

    dfa.startState = startStateName;
    dfa.states.add(startStateName);

    const unmarkedStates = [startClosure];

    if (Array.from(startClosure).some(s => nfa.acceptStates.has(s))) {
        dfa.acceptStates.add(startStateName);
    }

    while (unmarkedStates.length > 0) {
        const currentSet = unmarkedStates.shift()!;
        const currentName = Array.from(currentSet).sort().join(',');

        for (const symbol of dfa.alphabet) {
            const moveResult = move(nfa, currentSet, symbol);
            if (moveResult.size === 0) continue;

            const eClosure = epsilonClosure(nfa, moveResult);
            if (eClosure.size === 0) continue;

            const nextName = Array.from(eClosure).sort().join(',');

            dfa.transitions.push({
                from: currentName,
                symbol: symbol,
                to: nextName,
            });

            if (!dfa.states.has(nextName)) {
                dfa.states.add(nextName);
                unmarkedStates.push(eClosure);

                if (Array.from(eClosure).some(s => nfa.acceptStates.has(s))) {
                    dfa.acceptStates.add(nextName);
                }
            }
        }
    }

    return dfa;
}
