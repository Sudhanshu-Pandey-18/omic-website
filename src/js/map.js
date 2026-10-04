/* ---------------------------------------------------------------- abstract map of Goshi Warehouse City */
export function map() {
  const el = document.querySelector('[data-map]');
  if (!el) return;
  // a stylised block plan: rows of warehouses, one of them is OMIC (Warehouse 110)
  let blocks = '';
  const cols = 9, rows = 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 40 + c * 92 + (r % 2) * 18, y = 40 + r * 86;
      const isOmic = r === 3 && c === 4;
      blocks += `<rect x="${x}" y="${y}" width="74" height="60" rx="6" fill="${isOmic ? '#4a6fe8' : 'rgba(244,237,225,0.07)'}" stroke="rgba(244,237,225,0.14)"/>`;
    }
  }
  el.innerHTML = `
    <svg viewBox="0 0 880 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Stylised plan of Goshi Warehouse City with OMIC at Warehouse 110">
      ${blocks}
      <g transform="translate(445 328)">
        <circle r="70" fill="none" stroke="#4a6fe8" stroke-opacity=".5"><animate attributeName="r" from="30" to="120" dur="2.4s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" from=".7" to="0" dur="2.4s" repeatCount="indefinite"/></circle>
        <circle r="26" fill="#f4ede1"/>
        <text y="7" text-anchor="middle" font-family="Oswald, sans-serif" font-size="20" fill="#17140f">O</text>
      </g>
      <text x="40" y="540" font-family="Outfit, sans-serif" font-size="13" letter-spacing="3" fill="rgba(244,237,225,.5)">GOSHI WAREHOUSE CITY · AL QUOZ</text>
      <text x="500" y="300" font-family="Outfit, sans-serif" font-size="13" letter-spacing="2" fill="#f4ede1">WAREHOUSE 110 — OMIC</text>
    </svg>`;
}
