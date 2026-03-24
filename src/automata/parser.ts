export interface Rule {
  left: string;
  right: string[]; // e.g., ['a', 'A'] or ['a'] or ['ε']
}

export interface Grammar {
  nonTerminals: Set<string>;
  terminals: Set<string>;
  rules: Rule[];
  startSymbol: string | null;
}

export function parseGrammar(input: string): Grammar {
  const grammar: Grammar = {
    nonTerminals: new Set(),
    terminals: new Set(),
    rules: [],
    startSymbol: null,
  };

  const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (const line of lines) {
    // Expected format: A -> aA | bB | ε
    // Alternative symbols for arrow: ->, →, =, ::=
    const parts = line.split(/->|=|→|::=/).map(p => p.trim());
    if (parts.length !== 2) continue;

    const leftName = parts[0];
    if (!grammar.startSymbol) {
      grammar.startSymbol = leftName;
    }
    grammar.nonTerminals.add(leftName);

    const rightOptions = parts[1].split('|').map(p => p.trim());
    
    for (const option of rightOptions) {
      // Split into tokens: lowercase for terminals, uppercase for non-terminals.
      // Epsilon is commonly represented by: ε, epsilon, \epsilon, or lambda.
      const tokens: string[] = [];
      const normalizedOption = option.toLowerCase();
      
      if (
        option === '' ||
        option === 'ε' ||
        normalizedOption === 'epsilon' ||
        normalizedOption === '\\epsilon' ||
        normalizedOption === 'lambda'
      ) {
        tokens.push('ε');
      } else {
        // Simple tokenization: assume uppercase words are non-terminals, anything else are terminals
        // Or character by character analysis:
        for (let i = 0; i < option.length; i++) {
          const char = option[i];
          if (char === ' ') continue;
          tokens.push(char);
          if (char.toUpperCase() === char && char.toLowerCase() !== char) {
             grammar.nonTerminals.add(char);
          } else {
             if (char !== 'ε') {
               grammar.terminals.add(char);
             }
          }
        }
      }

      grammar.rules.push({
        left: leftName,
        right: tokens
      });
    }
  }

  return grammar;
}
