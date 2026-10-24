/**
 * Command palette (M52): the commands it lists and how a typed query narrows them. Pure, so the
 * matching is unit-tested; the dialog lives in CommandPalette.tsx and the list is built in Editor.
 */
export type Command = {
  id: string;
  /** What the command does, as it reads in the list ("Add Business Application"). */
  label: string;
  /** Where the same action lives in the toolbar ("Export", "View"); shown beside the label and matched. */
  group: string;
  /** Extra words that should find it, not shown. */
  keywords?: string;
  /** Its keyboard shortcut, as shown ("Shift+1"). */
  keys?: string;
  /** Why it cannot run now; the command stays listed, with this note. */
  disabled?: string;
  run: () => void;
};

/** Lowercase, typographic quotes dropped, so "order api" finds “Order API”. */
const fold = (s: string) => s.toLowerCase().replace(/[“”‘’"']/g, "");

/** 0: the label starts with the query; 1: a word of the label starts with its first word; 2: any other match. */
function rank(c: Command, q: string, first: string) {
  const label = fold(c.label);
  if (label.startsWith(q)) return 0;
  if (label.split(/[\s,()/.:-]+/).some((w) => w.startsWith(first))) return 1;
  return 2;
}

/**
 * The commands whose label, group or keywords contain every word of the query (any case), best
 * first: label starts with the query, then a label word starts with its first word, then the rest;
 * ties keep the list's own order. A blank query lists everything as given.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const q = fold(query).trim().replace(/\s+/g, " ");
  if (!q) return commands;
  const words = q.split(" ");
  return commands
    .map((c, i) => ({ c, i, text: fold(`${c.label} ${c.group} ${c.keywords ?? ""}`) }))
    .filter(({ text }) => words.every((w) => text.includes(w)))
    .map((x) => ({ ...x, r: rank(x.c, q, words[0]!) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ c }) => c);
}
