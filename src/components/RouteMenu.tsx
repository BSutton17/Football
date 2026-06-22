import type { RouteType } from "../types/routes.ts";

interface RouteOption {
  route: RouteType;
  label: string;
}

const WR_ROUTES: RouteOption[] = [
  { route: "slant", label: "Slant" },
  { route: "zig", label: "Zig" },
  { route: "quick_out", label: "Quick" },
  { route: "curl", label: "Curl" },
  { route: "out", label: "Out" },
  { route: "comeback", label: "Comeback" },
  { route: "return", label: "Return" },
  { route: "dig", label: "Dig" },
  { route: "deep_cross", label: "D-Cross" },
  { route: "go", label: "Go" },
  { route: "post", label: "Post" },
  { route: "corner", label: "Corner" },
  { route: "screen", label: "Screen" },
];

const TE_ROUTES: RouteOption[] = [
  { route: "drag", label: "Drag" },
  { route: "flat", label: "Flat" },
  { route: "angle", label: "Angle" },
  { route: "out", label: "Out" },
  { route: "cross", label: "Cross" },
  { route: "deep_cross", label: "D-Cross" },
  { route: "zig", label: "Zig" },
  { route: "seam", label: "Seam" },
  { route: "go", label: "Go" },
  { route: "post", label: "Post" },
  { route: "corner", label: "Corner" },
  { route: "screen", label: "Screen" },
  { route: "block", label: "Block" },
];

const RB_ROUTES: RouteOption[] = [
  { route: "flat", label: "Flat" },
  { route: "swing", label: "Swing" },
  { route: "flare", label: "Flare" },
  { route: "screen", label: "Screen" },
  { route: "out", label: "Out" },
  { route: "texas", label: "Texas" },
  { route: "go", label: "Go" },
  { route: "wheel", label: "Wheel" },
  { route: "block", label: "Block" },
];

const ROUTES_BY_POSITION: Record<string, RouteOption[]> = {
  WR: WR_ROUTES,
  TE: TE_ROUTES,
  RB: RB_ROUTES,
};

interface Props {
  playerId: string;
  position: string;
  currentRoute: RouteType | undefined;
  onSelect: (playerId: string, route: RouteType) => void;
}

export default function RouteMenu({
  playerId,
  position,
  currentRoute,
  onSelect,
}: Props) {
  const options = ROUTES_BY_POSITION[position] ?? WR_ROUTES;

  return (
    <div className="route-menu">
      <div className="route-menu-header">{position}</div>
      {options.map(({ route, label }) => (
        <button
          key={route}
          className={`route-btn${currentRoute === route ? " route-btn--active" : ""}`}
          onPointerDown={() => onSelect(playerId, route)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
