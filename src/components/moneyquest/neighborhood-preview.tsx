const buildings = [
  { x: 152, y: 160, h: 66, roof: "#53b5ed", wall: "#c6e5f4", name: "BANK", number: "01" },
  { x: 316, y: 170, h: 52, roof: "#5ee1c3", wall: "#b0e3d6", name: "STORE", number: "02" },
  { x: 152, y: 279, h: 85, roof: "#91a6e4", wall: "#d5ddf7", name: "HOME", number: "03" },
  { x: 316, y: 289, h: 46, roof: "#f1bf66", wall: "#f8e3b8", name: "ADVISOR", number: "04" },
];

/** A repo-native illustration, deliberately labeled as a concept rather than a game screenshot. */
export function NeighborhoodPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-lg">
      <svg viewBox="0 0 480 380" role="img" aria-labelledby="moneyquest-map-title" className="h-auto w-full">
        <title id="moneyquest-map-title">MoneyQuest neighborhood concept: bank, store, home, and advisor around a central plaza.</title>
        <defs>
          <linearGradient id="mq-ground" x2="0" y2="1">
            <stop stopColor="#1f7086" /><stop offset="1" stopColor="#14536d" />
          </linearGradient>
        </defs>
        <ellipse cx="240" cy="323" rx="205" ry="33" fill="#001f35" opacity=".3" />
        <path d="M28 211 240 92 452 211 240 338Z" fill="url(#mq-ground)" />
        <path d="M28 211v14l212 127v-14Z" fill="#0e435c" />
        <path d="m240 338 212-127v14L240 352Z" fill="#0a354d" />
        <path d="m43 218 197-111 197 111M240 107v230M49 221l191 111 190-111" fill="none" stroke="#83cbcc" strokeOpacity=".25" strokeWidth="2" />
        <path d="m77 183 288 172M400 175 100 346" stroke="#b4d4e2" strokeWidth="24" />
        <path d="m77 183 288 172M400 175 100 346" stroke="#437d94" strokeWidth="1.5" strokeDasharray="5 7" />
        {buildings.map(({ x, y, h, roof, wall, name, number }) => (
          <g key={name}>
            <path d={`M${x - 46} ${y}l46 26 46-26v-${h}l-46-26-46 26Z`} fill={wall} />
            <path d={`M${x} ${y + 26}l46-26v-${h}l-46 26Z`} fill={roof} />
            <path d={`M${x - 50} ${y - h}l50-29 50 29-50 29Z`} fill={roof} stroke="#fff" strokeOpacity=".4" />
            <path d={`M${x - 35} ${y - 22}l10 6v-18l-10-6Zm18 10 10 6v-18l-10-6Z`} fill="#16607d" />
            <path d={`M${x + 14} ${y + 12}l15-9v-24l-15 9Z`} fill="#07506b" />
            <rect x={x - 40} y={y - h - 56} width="80" height="24" rx="8" fill="#f5f8fc" />
            <text x={x} y={y - h - 40} textAnchor="middle" fill="#004977" fontSize="10" fontWeight="700">{number} · {name}</text>
          </g>
        ))}
        <path d="m236 214 11-6 11 6v17l-11 7-11-7Z" fill="#f1bf66" />
        <circle cx="247" cy="202" r="9" fill="#f9e2b5" />
        <path d="M247 194v-16" stroke="#fff" strokeWidth="2" strokeDasharray="3 3" />
        <path d="m242 181 5 5 5-5" fill="none" stroke="#fff" strokeWidth="2" />
      </svg>
      <figcaption className="text-center text-xs text-sky-100/90">Neighborhood concept · four stops, one financial future</figcaption>
    </figure>
  );
}
