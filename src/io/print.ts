/**
 * Print (M51): the image placed in a print-only sheet in the page, then the browser's own print
 * dialog, which also saves a PDF. No library, no new window (which popup blockers stop). The sheet
 * is removed after printing; `globals.css` hides the app while it is there.
 */
export const PRINT_SHEET_ID = "bm-print";

export function printSvg(svg: string, title: string) {
  document.getElementById(PRINT_SHEET_ID)?.remove();
  const sheet = document.createElement("div");
  sheet.id = PRINT_SHEET_ID;
  sheet.setAttribute("aria-hidden", "true");
  // Our own generated markup, parsed as SVG (never as HTML) and imported as nodes.
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  sheet.append(document.importNode(parsed, true));
  document.body.append(sheet);
  const was = document.title;
  document.title = title; // The print dialog's default file name.
  const done = () => {
    window.removeEventListener("afterprint", done);
    sheet.remove();
    document.title = was;
  };
  window.addEventListener("afterprint", done);
  window.print();
  // Browsers that never fire afterprint (or a dialog dismissed at once): tidy up on the next tick after the dialog closes.
  setTimeout(() => sheet.isConnected && done(), 1000);
}
