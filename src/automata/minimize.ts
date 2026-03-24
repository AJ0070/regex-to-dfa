import type { DFA } from './dfa';

export function minimizeDFA(dfa: DFA): DFA {
    const states = Array.from(dfa.states);
    if (states.length === 0) return dfa;

    // 1. Initial partition: Accept states and Non-Accept states
    const acceptStates = new Set(Array.from(dfa.acceptStates));
    const nonAcceptStates = new Set(states.filter(s => !acceptStates.has(s)));

    let partitions: Set<string>[] = [];
    if (acceptStates.size > 0) partitions.push(acceptStates);
    if (nonAcceptStates.size > 0) partitions.push(nonAcceptStates);

    const getTransitionTarget = (state: string, symbol: string): string | null => {
        const t = dfa.transitions.find(tr => tr.from === state && tr.symbol === symbol);
        return t ? t.to : null;
    };

    const getPartitionIndex = (state: string | null, currentPartitions: Set<string>[]): number => {
        if (state === null) return -1;
        return currentPartitions.findIndex(p => p.has(state));
    };

    let changed = true;
    while (changed) {
        changed = false;
        const newPartitions: Set<string>[] = [];

        for (const partition of partitions) {
            if (partition.size <= 1) {
                newPartitions.push(partition);
                continue;
            }

            // We need to split this partition if elements behave differently for any symbol
            const partitionArr = Array.from(partition);
            const splitGroups = new Map<string, Set<string>>();

            for (const state of partitionArr) {
                // Create a signature for the state based on where it goes for each symbol
                const signature = Array.from(dfa.alphabet).map(symbol => {
                    const target = getTransitionTarget(state, symbol);
                    return getPartitionIndex(target, partitions).toString();
                }).join('|');

                if (!splitGroups.has(signature)) {
                    splitGroups.set(signature, new Set());
                }
                splitGroups.get(signature)!.add(state);
            }

            for (const group of splitGroups.values()) {
                newPartitions.push(group);
            }

            if (splitGroups.size > 1) {
                changed = true;
            }
        }
        partitions = newPartitions;
    }

    // Construct new DFA based on partitions
    const minDfa: DFA = {
        states: new Set(),
        alphabet: new Set(dfa.alphabet),
        transitions: [],
        startState: '',
        acceptStates: new Set(),
    };

    // Map old state to new partition name
    const stateToPartitionName = new Map<string, string>();

    partitions.forEach((partition, index) => {
        // Name the partition arbitrarily
        // Ideally we can use the states joined, but if it's too long, just P0, P1...
        // Let's use simplified names like '{A,B}'
        const name = "P" + index;

        // Set start state if this partition contains the original start state
        if (partition.has(dfa.startState)) {
            minDfa.startState = name;
        }

        // Set accept state if this partition contains an original accept state
        const hasAccept = Array.from(partition).some(s => dfa.acceptStates.has(s));
        if (hasAccept) {
            minDfa.acceptStates.add(name);
        }

        minDfa.states.add(name);

        for (const state of partition) {
            stateToPartitionName.set(state, name);
        }
    });

    // Rebuild transitions
    const addedTransitions = new Set<string>();

    for (const t of dfa.transitions) {
        const fromP = stateToPartitionName.get(t.from)!;
        const toP = stateToPartitionName.get(t.to)!;

        const key = `${fromP}-${t.symbol}-${toP}`;
        if (!addedTransitions.has(key)) {
            minDfa.transitions.push({
                from: fromP,
                symbol: t.symbol,
                to: toP,
            });
            addedTransitions.add(key);
        }
    }

    return minDfa;
}
