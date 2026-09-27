import type { ArchimateElementType } from "./archimate";

/**
 * Small ArchiMate notation icons, drawn for this app (not copied artwork): the shape a modeler
 * expects in the corner of each element. Decorative; the element name is always shown as text.
 */
export function ArchimateGlyph({ type, className = "" }: { type: ArchimateElementType; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" as const };
  let body: React.ReactNode;
  switch (type) {
    case "Capability":
      body = <path {...common} d="M2 11h4V8h4V5h4v6H2z M6 11V8 M10 11V5" />;
      break;
    case "BusinessProcess":
      body = <path {...common} d="M1.5 5h8V2.5L14.5 7l-5 4.5V9h-8z" />;
      break;
    case "BusinessService":
    case "TechnologyService":
      body = <rect {...common} x="1.5" y="3.5" width="13" height="7" rx="3.5" />;
      break;
    case "BusinessObject":
      body = <path {...common} d="M1.5 2.5h13v9h-13z M1.5 5.5h13" />;
      break;
    case "Product":
      body = <path {...common} d="M1.5 2.5h13v9h-13z M1.5 5.5h6v-3" />;
      break;
    case "ApplicationComponent":
      body = <path {...common} d="M4 2.5h10.5v9H4z M2 4h4v2H2z M2 8h4v2H2z" />;
      break;
    case "ApplicationInterface":
      body = <path {...common} d="M1 7h7 M11 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />;
      break;
    case "SystemSoftware":
      body = <path {...common} d="M6.5 7.5m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0 M9 3.2a4.5 4.5 0 0 1 4.8 6.6" />;
      break;
    case "Node":
      body = <path {...common} d="M1.5 4.5h10v7h-10z M1.5 4.5l2.5-2.5h10l-2.5 2.5 M14 2v7l-2.5 2.5" />;
      break;
    case "TechnologyInterface":
      body = <path {...common} d="M1 7h6 M10.5 7m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0" />;
      break;
    case "Grouping":
      body = <path {...common} strokeDasharray="2 1.5" d="M1.5 4.5h13v7h-13z M1.5 4.5v-2h6v2" />;
      break;
    case "CommunicationNetwork":
      body = <path {...common} d="M1.5 9.5h13 M4 9.5V5.5 M12 9.5V5.5 M4 5.5h8" />;
      break;
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 16 14" width="16" height="14" className={`shrink-0 ${className}`}>
      {body}
    </svg>
  );
}
