import * as flags from 'country-flag-icons/string/3x2';

interface FlagIconProps {
  code?: string;
  size?: number;
}

export default function FlagIcon({ code, size = 20 }: FlagIconProps) {
  if (!code || code.length !== 2) return null;
  const svg = (flags as Record<string, string>)[code.toUpperCase()];
  if (!svg) return null;
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={code}
      width={size}
      height={h}
      style={{ verticalAlign: 'middle', marginRight: 3 }}
    />
  );
}
