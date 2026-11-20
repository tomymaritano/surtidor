import Svg, { Circle, Path } from "react-native-svg";

type IconProps = { color?: string; size?: number };

export function SearchIcon({ color = "#98A2B3", size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth={2} />
      <Path d="M16 16.5L20.5 21" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function SlidersIcon({ color = "#1C1E24", size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8h16M4 16h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="9" cy="8" r="2.2" fill="#fff" stroke={color} strokeWidth={2} />
      <Circle cx="15" cy="16" r="2.2" fill="#fff" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function LocateIcon({ color = "#1C1E24", size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} />
      <Path
        d="M12 3.5v2.2M12 18.3V20.5M3.5 12h2.2M18.3 12H20.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="12" r="7.2" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function BackIcon({ color = "#1C1E24", size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 5.5L8 12l6.5 6.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ color = "#1C1E24", size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function BookmarkIcon({ color = "#1C1E24", filled = false, size = 18 }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4.5h10a1 1 0 011 1V20l-6-3.4L6 20V5.5a1 1 0 011-1z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DirectionsIcon({ color = "#FFFFFF", size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.2l7.2 17.2-7.2-3.6-7.2 3.6L12 3.2z" fill={color} />
    </Svg>
  );
}

export function CameraIcon({ color = "#1C1E24", size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.2 7.2L9.4 5.2h5.2l1.2 2h3a1.6 1.6 0 011.6 1.6v8.4a1.6 1.6 0 01-1.6 1.6H5.2A1.6 1.6 0 013.6 17.2V8.8A1.6 1.6 0 015.2 7.2h3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="13" r="3" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
