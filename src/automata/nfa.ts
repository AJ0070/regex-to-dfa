import type { Grammar } from './parser';

export interface Transition {
    from: string;
    symbol: string;
    to: string;
}

export interface NFA {
    states: Set<string>;
    alphabet: Set<string>;
    transitions: Transition[];
    startState: string;
    acceptStates: Set<string>;
}

// Convert a regular grammar to NFA
// Assuming Right Linear Grammar parsing.
export function grammarToNFA(grammar: Grammar): NFA {
    const nfa: NFA = {
        states: new Set(grammar.nonTerminals),
        alphabet: new Set(grammar.terminals),
        transitions: [],
        startState: grammar.startSymbol || '',
        acceptStates: new Set(),
    };

    // Use a reserved name that cannot appear as a user-defined non-terminal.
    const FINAL_STATE = '__final__';
    nfa.states.add(FINAL_STATE);
    nfa.acceptStates.add(FINAL_STATE);

    let stateCounter = 0;
    const getNewState = () => `Q${stateCounter++}`;

    for (const rule of grammar.rules) {
        const left = rule.left;
        const right = rule.right;

        if (right.length === 1 && right[0] === 'ε') {
            // rule like A -> ε makes A an accept state directly
            nfa.acceptStates.add(left);
            continue;
        }

        let currentState = left;

        // Process all symbols in the right-hand side
        for (let i = 0; i < right.length; i++) {
            const isLast = i === right.length - 1;
            const symbol = right[i];
            const isTerminal = grammar.terminals.has(symbol);
            const isNonTerminal = grammar.nonTerminals.has(symbol);

            if (isNonTerminal) {
                nfa.transitions.push({ from: currentState, symbol: 'ε', to: symbol });
                if (!isLast) {
                    // Remain permissive for non-strict inputs by continuing from that non-terminal.
                    currentState = symbol;
                }
            } else if (isTerminal) {
                if (isLast) {
                    // Rule A -> a
                    nfa.transitions.push({ from: currentState, symbol: symbol, to: FINAL_STATE });
                } else {
                    // Next symbol is there
                    const nextToken = right[i + 1];
                    if (i + 1 === right.length - 1 && grammar.nonTerminals.has(nextToken)) {
                        // Rule A -> aB
                        nfa.transitions.push({ from: currentState, symbol: symbol, to: nextToken });
                        break; // processed nextToken
                    } else {
                        // Rule A -> abC or other longer permissive forms
                        const nextState = getNewState();
                        nfa.states.add(nextState);
                        nfa.transitions.push({ from: currentState, symbol: symbol, to: nextState });
                        currentState = nextState;
                    }
                }
            } else {
                // Unknown symbol class: treat as terminal to keep conversion permissive.
                if (isLast) {
                    nfa.transitions.push({ from: currentState, symbol: symbol, to: FINAL_STATE });
                } else {
                    const nextState = getNewState();
                    nfa.states.add(nextState);
                    nfa.transitions.push({ from: currentState, symbol: symbol, to: nextState });
                    currentState = nextState;
                }
            }
        }
    }

    return nfa;
}
