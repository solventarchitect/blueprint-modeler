/** Toolbar icons: 16px line drawings in the text color. Decorative — every button keeps its text label. */
const paths = {
  manage: "M3 4h10M3 8h10M3 12h6",
  new: "M8 3v10M3 8h10",
  import: "M8 10V2M5 5l3-3 3 3M3 10v3h10v-3",
  export: "M8 2v8M5 7l3 3 3-3M3 10v3h10v-3",
  undo: "M6 4 3 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H7",
  redo: "M10 4l3 3-3 3M13 7H6.5a3.5 3.5 0 0 0 0 7H9",
  layout: "M6.5 2h3v3h-3zM2.5 11h3v3h-3zM10.5 11h3v3h-3zM8 5v3M4 11V8h8v3",
  view: "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  present: "M5 3.5v9l7-4.5z",
} as const;

export type ToolbarIconName = keyof typeof paths;

export function ToolbarIcon({ name }: { name: ToolbarIconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0" fill={name === "present" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
