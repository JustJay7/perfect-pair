/* =====================================================================
   Customer photos for the test returns.
   Every photo is a drawing made here, not a real product photo: a generic
   shoe of the right type and colour, on the kind of floor a customer would
   shoot on, with what the photo findings describe drawn in (a scuff, a
   crushed box, dirt in the tread). Each case has three shots: the whole
   pair, a close-up of what matters, and the sole or the box.
   ===================================================================== */
let PHOTO_UID = 0;
const SHOE_COLOURS = {
  Black: { base: '#25221F', shade: '#121110', hi: '#55504A', line: '#0A0909', sole: '#191817', lining: '#7A6E62' },
  White: { base: '#F5F3EF', shade: '#D9D4CC', hi: '#FFFFFF', line: '#B9B1A6', sole: '#ECE8E1', lining: '#E6DDD0' },
  Tan: { base: '#B9814F', shade: '#8E5F38', hi: '#D9A578', line: '#6E4728', sole: '#6B4A31', lining: '#E8CDA8' },
  Nude: { base: '#DDBFA6', shade: '#BF9C80', hi: '#F1DCCA', line: '#A47F64', sole: '#8F735E', lining: '#F4E6D8' },
  Gold: { base: '#D4B05A', shade: '#A9853A', hi: '#F3DB93', line: '#8A6A28', sole: '#8B6D3F', lining: '#EAD7B0' },
};
/* Which shoe, scene and findings each test case's photos show. */
const PHOTO_PLAN = {
  maya: { shape: 'ankle', floor: 'wood', box: 'open', marks: ['toe_crease'], close: 'toe', third: 'sole',
    shots: ['Both boots with the original box and tissue', 'Close-up: light creasing across the toe box', 'Outsole: clean tread, no wear'] },
  priya: { shape: 'sneaker', floor: 'tile', box: 'crushed', marks: ['scuff'], close: 'toe', third: 'box',
    shots: ['The pair as it arrived', 'Close-up: deep scuff on the left toe cap', 'The shipping box, crushed at one corner'] },
  leo: { shape: 'sandal_heel', floor: 'wood', tag: true, close: 'tag', third: 'sole',
    shots: ['The pair in daylight', 'Close-up: tags still attached', 'Soles: unworn'] },
  ana: { shape: 'flat', floor: 'carpet', marks: ['insole_marks'], close: 'insole', third: 'sole',
    shots: ['The pair on the floor', 'Inside: light marks on the insole from trying on', 'Soles: unworn'] },
  jordan: { shape: 'knee', floor: 'tile', marks: ['vamp_crease', 'dirt'], close: 'vamp', third: 'sole',
    shots: ['Both boots, side view', 'Close-up: creasing at the vamp', 'Outsole: dirt and wear in the tread'] },
  sam: { shape: 'pump', floor: 'studio', box: 'open', close: 'toe', third: 'sole',
    shots: ['The pair with the original box', 'Close-up: no marks on the toe', 'Soles: unworn'] },
  kai: { shape: 'platform', floor: 'bed', box: 'open', close: 'toe', third: 'sole',
    shots: ['The pair with the original box', 'Close-up: clean toe and laces', 'Soles: unworn'] },
  bianca: { shape: 'sandal_flat', floor: 'wood', close: 'toe', third: 'sole',
    shots: ['The pair on the floor', 'Close-up: straps and footbed', 'Soles: unworn'] },
};
const SHAPE_FOR_STYLE = s => /knee/i.test(s) ? 'knee' : /ankle|boot/i.test(s) ? 'ankle' : /platform/i.test(s) ? 'platform' : /sneaker|trainer/i.test(s) ? 'sneaker' : /pump|heel(?!ed sandal)/i.test(s) ? 'pump' : /heeled sandal/i.test(s) ? 'sandal_heel' : /sandal/i.test(s) ? 'sandal_flat' : /flat|loafer/i.test(s) ? 'flat' : 'sneaker';

function floorSVG(kind, u) {
  const wall = { wood: '#EDE7DE', tile: '#E9ECEE', carpet: '#E7E2DA', bed: '#E9E6EF', studio: '#EEEAE4', qc: '#F4F4F2', counter: '#D8D3CB' }[kind];
  const floor = { wood: '#B48C66', tile: '#D9DCDD', carpet: '#8E8D92', bed: '#DCE3EA', studio: '#E2DDD5', qc: '#FFFFFF', counter: '#4A4E52' }[kind];
  let deco = '';
  if (kind === 'wood') for (let y = 236; y < 360; y += 22) deco += `<line x1="0" x2="480" y1="${y}" y2="${y}" stroke="#9C7652" stroke-width="1.4" opacity=".55"/>` + [40, 190, 330, 120, 270, 420].filter((_, i) => (y / 22 | 0) % 2 === i % 2).map(x => `<line x1="${x}" x2="${x}" y1="${y}" y2="${y + 22}" stroke="#9C7652" stroke-width="1.2" opacity=".5"/>`).join('');
  if (kind === 'tile') { for (let y = 250; y < 360; y += 46) deco += `<line x1="0" x2="480" y1="${y}" y2="${y}" stroke="#C3C7C8" stroke-width="2"/>`; for (let x = -40; x < 520; x += 92) deco += `<line x1="${x}" x2="${x - 40}" y1="214" y2="360" stroke="#C3C7C8" stroke-width="2"/>`; }
  if (kind === 'carpet') for (let i = 0; i < 260; i++) { const x = (i * 97) % 480, y = 216 + ((i * 53) % 144); deco += `<circle cx="${x}" cy="${y}" r="1.3" fill="#77767B" opacity=".5"/>`; }
  if (kind === 'counter') { for (let x = 0; x < 480; x += 40) deco += `<line x1="${x}" x2="${x - 30}" y1="214" y2="360" stroke="#5C6166" stroke-width="1"/>`; for (let y = 240; y < 360; y += 30) deco += `<line x1="0" x2="480" y1="${y}" y2="${y}" stroke="#5C6166" stroke-width="1"/>`; deco += `<rect x="20" y="226" width="64" height="14" rx="2" fill="#E8E2D6"/><rect x="24" y="230" width="40" height="3" fill="#555"/>`; }
  if (kind === 'qc') deco = `<line x1="0" x2="480" y1="214" y2="214" stroke="#E2E2DE"/><rect x="392" y="24" width="68" height="22" rx="3" fill="#FFFFFF" stroke="#C9C9C4"/><rect x="398" y="31" width="40" height="3" fill="#444"/><rect x="398" y="37" width="28" height="3" fill="#999"/>`;
  if (kind === 'bed') deco = `<path d="M0,250 C120,232 220,262 330,240 C400,228 450,244 480,236" stroke="#C6CFDA" stroke-width="3" fill="none"/><path d="M0,312 C140,296 260,326 480,300" stroke="#C6CFDA" stroke-width="3" fill="none"/>`;
  const horizon = kind === 'studio' ? `<rect width="480" height="360" fill="url(#${u}-sweep)"/>` : `<rect width="480" height="214" fill="${wall}"/><rect y="214" width="480" height="146" fill="${floor}"/>${kind === 'bed' ? '' : `<rect y="206" width="480" height="8" fill="${kind === 'wood' ? '#F7F3EC' : '#F2F3F3'}"/>`}`;
  return `<defs><linearGradient id="${u}-sweep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="${floor}"/></linearGradient>
    <radialGradient id="${u}-vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>
    <filter id="${u}-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="${u}-soft"><feGaussianBlur stdDeviation="1.2"/></filter></defs>${horizon}${deco}`;
}
function boxSVG(kind) {
  if (kind === 'crushed') return `<g><path d="M30,262 L30,150 L180,138 L196,160 L190,266 Z" fill="#C6A27A" stroke="#8C6B48" stroke-width="2"/>
      <path d="M30,150 L60,128 L196,118 L180,138 Z" fill="#D7B78F" stroke="#8C6B48" stroke-width="2"/>
      <path d="M180,138 L196,118 L214,140 L196,160 Z" fill="#B48E66" stroke="#8C6B48" stroke-width="2"/>
      <path d="M150,140 L170,170 L160,200 L182,214" stroke="#7A5A3B" stroke-width="2.5" fill="none"/><path d="M178,150 L160,166 L176,186" stroke="#7A5A3B" stroke-width="2" fill="none"/>
      <rect x="54" y="176" width="80" height="50" fill="#FFFFFF" stroke="#999" stroke-width="1"/>${[0, 3, 5, 8, 10, 14, 16, 19, 22, 24, 27, 30, 33, 35, 38, 41, 44, 46, 49, 52, 55, 58, 60, 63, 66].map(x => `<rect x="${60 + x}" y="${200}" width="${x % 3 ? 1.2 : 2.2}" height="18" fill="#222"/>`).join('')}
      <rect x="60" y="182" width="50" height="4" fill="#555"/><rect x="60" y="190" width="34" height="3" fill="#888"/></g>`;
  return `<g opacity=".97"><path d="M300,206 L300,120 L452,112 L452,200 Z" fill="#1D1D1D"/><path d="M300,120 L320,100 L468,94 L452,112 Z" fill="#2E2E2E"/>
    <path d="M452,112 L468,94 L468,186 L452,200 Z" fill="#141414"/><path d="M306,124 C330,104 360,128 382,108 C400,96 420,120 446,104 L446,118 L306,126 Z" fill="#F4F1EA" opacity=".9"/></g>`;
}
/** One shoe, toe to the right, standing on y = 290. */
function shoeSVG(shape, c, u, marks = [], tag = false) {
  const g = `url(#${u}-sh)`;
  const defs = `<defs><linearGradient id="${u}-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.hi}" stop-opacity=".55"/><stop offset=".5" stop-color="${c.base}" stop-opacity="0"/><stop offset="1" stop-color="${c.shade}" stop-opacity=".7"/></linearGradient></defs>`;
  const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" stroke="${c.line}" stroke-width="1.6" stroke-linejoin="round" ${extra}/>`;
  const both = d => P(d, c.base) + `<path d="${d}" fill="${g}"/>`;
  let s = '';
  const sneakerUpper = (dy) => `M92,${262 - dy} C88,${232 - dy} 96,${206 - dy} 120,${200 - dy} L176,${194 - dy} C196,${172 - dy} 222,${160 - dy} 252,${160 - dy} L270,${162 - dy} C292,${182 - dy} 318,${206 - dy} 352,${220 - dy} C384,${232 - dy} 404,${246 - dy} 406,${264 - dy} L406,${272 - dy} L92,${272 - dy} Z`;
  if (shape === 'sneaker' || shape === 'platform') {
    const dy = shape === 'platform' ? 18 : 0;
    s += both(sneakerUpper(dy));
    s += `<path d="M118,${202 - dy} C140,${196 - dy} 160,${197 - dy} 178,${195 - dy}" stroke="${c.lining}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M150,${252 - dy} C210,${240 - dy} 270,${232 - dy} 336,${236 - dy}" stroke="${c.line}" stroke-width="1.2" stroke-dasharray="4 3" fill="none"/>`;
    s += `<path d="M350,${222 - dy} C374,${232 - dy} 394,${246 - dy} 400,${262 - dy}" stroke="${c.line}" stroke-width="1.4" fill="none"/>`;
    for (let i = 0; i < 5; i++) { const x = 206 + i * 20, y = 172 + i * 9 - dy; s += `<circle cx="${x}" cy="${y + 10}" r="2.6" fill="${c.line}"/><line x1="${x - 8}" y1="${y + 4}" x2="${x + 12}" y2="${y + 16}" stroke="${c === SHOE_COLOURS.White ? '#FFFFFF' : c.hi}" stroke-width="4" stroke-linecap="round"/><line x1="${x - 8}" y1="${y + 4}" x2="${x + 12}" y2="${y + 16}" stroke="${c.line}" stroke-width=".8" stroke-linecap="round" opacity=".6"/>`; }
    s += `<path d="M84,${266 - dy} L412,${266 - dy} C414,280 406,290 392,290 L100,290 C88,290 82,280 84,${266 - dy} Z" fill="#F7F6F3" stroke="#BDB7AE" stroke-width="1.6"/>`;
    s += `<path d="M92,282 L404,282" stroke="#CFC9C0" stroke-width="1.4"/>`;
  } else if (shape === 'ankle' || shape === 'knee') {
    const top = shape === 'knee' ? 34 : 104;
    const d = `M98,276 L96,${top + 14} C96,${top + 4} 104,${top} 114,${top} L192,${top} C202,${top} 206,${top + 6} 206,${top + 16} L212,196 C250,212 312,228 356,240 C388,249 404,262 404,276 Z`;
    s += both(d);
    s += `<path d="M114,${top + 3} L192,${top + 3}" stroke="${c.lining}" stroke-width="5" stroke-linecap="round"/>`;
    s += `<line x1="182" y1="${top + 8}" x2="190" y2="200" stroke="#B8B2A8" stroke-width="2.4"/><rect x="178" y="${top + 8}" width="9" height="18" rx="3" fill="#C9C3B9" stroke="#8E877D"/>`;
    s += `<path d="M212,198 C232,214 248,236 252,262" stroke="${c.line}" stroke-width="1.2" fill="none" stroke-dasharray="4 3"/>`;
    s += `<path d="M96,276 L136,276 C170,272 200,272 230,278 L404,278 L404,286 C404,289 401,290 398,290 L232,290 C204,286 168,284 140,288 L140,290 L96,290 Z" fill="${c.sole}" stroke="${c.line}" stroke-width="1.4"/>`;
  } else if (shape === 'pump') {
    s += `<path d="M98,212 L116,212 L111,290 L105,290 Z" fill="${c.sole}" stroke="${c.line}" stroke-width="1.4"/>`;
    const d = 'M96,166 C96,156 104,152 112,156 C130,188 170,212 230,224 C290,234 360,244 398,270 C410,279 404,288 392,288 L250,288 C200,262 150,228 118,216 L100,214 C94,200 93,182 96,166 Z';
    s += both(d);
    s += `<path d="M112,158 C134,192 176,214 232,226" stroke="${c.lining}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M250,288 L392,288 C404,288 408,282 404,276" stroke="${c.sole}" stroke-width="4" fill="none"/>`;
  } else if (shape === 'flat') {
    const d = 'M90,272 C88,252 100,240 122,238 C160,240 200,244 240,240 C300,234 360,240 396,258 C410,266 408,282 394,284 L104,284 C94,284 90,280 90,272 Z';
    s += both(d);
    s += `<path d="M124,240 C170,228 250,226 300,236 C250,246 170,248 124,240 Z" fill="${c.lining}" stroke="${c.line}" stroke-width="1"/>`;
    s += `<path d="M104,284 L394,284 C404,284 408,288 404,290 L100,290 C94,290 96,284 104,284 Z" fill="${c.sole}"/>`;
    s += `<ellipse cx="312" cy="238" rx="14" ry="7" fill="${c.shade}" stroke="${c.line}"/><ellipse cx="336" cy="240" rx="14" ry="7" fill="${c.shade}" stroke="${c.line}"/><circle cx="324" cy="239" r="5" fill="${c.base}" stroke="${c.line}"/>`;
  } else if (shape === 'sandal_heel') {
    s += `<path d="M100,234 L126,236 L121,290 L104,290 Z" fill="${c.shade}" stroke="${c.line}" stroke-width="1.4"/>`;
    s += P('M98,230 C140,238 220,262 300,272 C350,278 392,276 406,282 L406,288 L300,286 C230,280 150,254 102,242 Z', c.sole);
    s += `<path d="M300,286 L406,288 L406,291 L300,290 Z" fill="${c.line}"/>`;
    for (const d of ['M112,238 C100,176 160,150 174,206', 'M160,246 C160,196 214,194 226,258', 'M300,272 C300,232 362,230 374,278']) s += `<path d="${d}" stroke="${c.line}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${c.base}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    s += `<rect x="150" y="166" width="10" height="12" rx="2" fill="#D9C27E" stroke="#8A6A28"/>`;
  } else {
    s += P('M90,280 C90,272 100,268 120,268 L380,270 C400,271 410,278 408,284 L408,290 L92,290 Z', c.sole);
    s += `<path d="M92,286 L408,286" stroke="${c.line}" stroke-width="1"/>`;
    for (const d of ['M180,270 C186,226 244,222 252,272', 'M270,272 C276,236 320,234 330,272', 'M330,271 C340,250 352,248 360,272']) s += `<path d="${d}" stroke="${c.line}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${c.base}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${c.hi}" stroke-width="2" fill="none" opacity=".7"/>`;
  }
  if (marks.includes('toe_crease')) s += `<g stroke="${c.hi}" stroke-width="1.4" fill="none" opacity=".75"><path d="M330,236 C340,244 346,252 350,262"/><path d="M342,240 C350,248 356,256 358,266"/></g>`;
  if (marks.includes('vamp_crease')) s += `<g stroke="${c.hi}" stroke-width="1.8" fill="none" opacity=".9"><path d="M262,214 C270,226 274,240 276,256"/><path d="M280,220 C286,232 290,246 290,262"/><path d="M298,226 C302,238 304,250 304,264"/><path d="M246,210 C252,222 256,236 256,250"/></g>`;
  if (marks.includes('dirt')) s += `<g fill="#6B5233" opacity=".85">${[110, 128, 150, 240, 262, 290, 318, 344, 366, 388].map((x, i) => `<ellipse cx="${x}" cy="${286 - (i % 3)}" rx="${6 + (i % 3) * 3}" ry="2.6"/>`).join('')}</g>`;
  if (marks.includes('sole_split')) s += `<path d="M330,270 C350,262 380,262 404,272 L404,278 C380,272 352,272 330,278 Z" fill="#0B0A09" opacity=".85"/><path d="M336,276 C360,268 384,268 402,276" stroke="${c.hi}" stroke-width="1" fill="none" opacity=".6"/>`;
  if (marks.includes('scuff')) s += `<g stroke="#5D5850" stroke-linecap="round" fill="none"><path d="M376,238 L398,252" stroke-width="3.4"/><path d="M370,244 L396,258" stroke-width="2"/><path d="M382,234 L392,240" stroke-width="1.4"/><path d="M372,240 L400,258" stroke-width="7" opacity=".18"/></g>`;
  if (tag) s += `<path d="M300,250 C292,214 284,196 262,184" stroke="#E7E1D6" stroke-width="1.4" fill="none"/><g transform="rotate(-18 248 180)"><rect x="226" y="158" width="44" height="58" rx="4" fill="#FFFFFF" stroke="#A9A39A"/><circle cx="248" cy="166" r="3" fill="none" stroke="#A9A39A"/><rect x="234" y="178" width="28" height="3" fill="#333"/><rect x="234" y="186" width="20" height="2.4" fill="#888"/><rect x="234" y="200" width="28" height="9" fill="none" stroke="#333"/></g>`;
  return defs + s;
}
/** A top-down view of the outsole, or the inside of the shoe for insole marks. */
function soleSVG(shape, c, u, marks = [], insole = false) {
  const outline = 'M240,40 C302,40 324,108 318,168 C312,228 292,250 288,290 C284,330 264,342 240,342 C216,342 196,330 192,290 C188,250 168,228 162,168 C156,108 178,40 240,40 Z';
  if (insole) return `<defs><clipPath id="${u}-cl"><path d="${outline}"/></clipPath></defs><path d="${outline}" fill="${c.base}" stroke="${c.line}" stroke-width="3"/><path d="M240,58 C292,58 306,112 302,166 C298,222 280,244 276,286 C272,322 258,326 240,326 C222,326 208,322 204,286 C200,244 182,222 178,166 C174,112 188,58 240,58 Z" fill="${c.lining}"/>
    <g fill="#9C8C7A" opacity=".45" filter="url(#${u}-soft)"><ellipse cx="226" cy="120" rx="22" ry="12"/><ellipse cx="258" cy="128" rx="16" ry="10"/><ellipse cx="240" cy="292" rx="24" ry="16"/></g>`;
  const heeled = ['pump', 'sandal_heel', 'ankle', 'knee'].includes(shape);
  let tread = '';
  for (let y = 56; y < 336; y += 12) tread += `<path d="M150,${y} q15,-6 30,0 t30,0 t30,0 t30,0 t30,0 t30,0" stroke="${c.line}" stroke-width="2" fill="none" opacity=".55"/>`;
  const dirt = marks.includes('dirt') ? `<g fill="#6B5233" opacity=".75" filter="url(#${u}-soft)">${[[230, 80, 26, 14], [262, 110, 18, 12], [214, 136, 14, 10], [250, 300, 22, 16], [228, 318, 12, 8], [268, 70, 10, 6]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('')}</g><g stroke="#3E2F1C" stroke-width="1.6" opacity=".6"><path d="M206,96 L262,88"/><path d="M200,124 L270,118"/></g>` : '';
  return `<defs><clipPath id="${u}-cl"><path d="${outline}"/></clipPath></defs><path d="${outline}" fill="${c.sole}" stroke="${c.line}" stroke-width="3"/>
    <g clip-path="url(#${u}-cl)">${tread}${heeled ? `<rect x="150" y="250" width="180" height="${shape === 'pump' ? 0 : 6}" fill="${c.line}" opacity=".5"/>` : ''}${dirt}</g>
    ${shape === 'pump' ? `<circle cx="240" cy="306" r="12" fill="${c.line}"/>` : ''}<path d="${outline}" fill="none" stroke="${c.hi}" stroke-width="1.2" opacity=".5" transform="translate(0,-2)"/>`;
}
const CLOSE_BOX = { toe: '296 196 160 110', vamp: '200 170 160 120', tag: '196 130 160 120', insole: '0 0 480 360' };
const PHOTO_SETS = { packing: 'Packed at dispatch', customer: "Customer's photos", store: 'Store check on arrival' };
const STORE_MARKS = { A: [], B: ['toe_crease'], C: ['dirt', 'vamp_crease'], D: ['sole_split'] };
const STORE_CLOSE = { A: 'Close-up: no marks', B: 'Close-up: light creasing from trying on', C: 'Close-up: creasing and wear at the vamp', D: 'Close-up: the sole separating' };
/* Real photos: a person can replace any drawing with a real photo. With the
   artifact's asset store they are kept for everyone who opens the page;
   without it they stay in this tab only. */
const PHOTO_STORE = { real: {}, local: {}, assets: null, db: null, canUpload: true, shared: false };
const photoKey = (caseId, set, i) => `${caseId}__${set}__${i}`;
function realPhotoURL(key) { return PHOTO_STORE.local[key] || (PHOTO_STORE.real[key] ? '/_blob/' + PHOTO_STORE.real[key].asset : null); }
function planFor(caseId) {
  const { k, line } = caseCtx(caseId);
  return PHOTO_PLAN[caseId] || k.photo.plan || { shape: SHAPE_FOR_STYLE(line.product), floor: 'studio', close: 'toe', third: 'sole', shots: ['Side view', 'Close-up', 'Soles'] };
}
/** The three photos of one set for a case: [{title, svg|img, file, real}]. set: packing | customer | store */
function casePhotos(caseId, set = 'customer') {
  const { k, line } = caseCtx(caseId);
  const plan = planFor(caseId);
  const c = SHOE_COLOURS[line.colour] || SHOE_COLOURS.Black;
  const cs = typeof CASES !== 'undefined' ? CASES[caseId] : null;
  let marks = plan.marks || [], floor = plan.floor, box = plan.box, tag = plan.tag, close = plan.close, third = plan.third, shots = plan.shots, files;
  const stem = (k.photo.file || 'IMG.jpg').replace(/\.jpg$/i, '');
  if (set === 'packing') {
    marks = []; floor = 'qc'; box = 'open'; tag = true; close = 'toe'; third = 'sole';
    shots = ['Packed at the distribution centre', 'QC close-up: toe and stitching', 'QC: outsole, unworn'];
    files = [1, 2, 3].map(n => `QC_${k.order_id}_${n}.jpg`);
  } else if (set === 'store') {
    const rc = cs && cs.received; if (!rc) return [];
    marks = STORE_MARKS[rc.grade] || []; floor = 'counter'; box = null; tag = false; close = rc.grade === 'C' ? 'vamp' : 'toe'; third = 'sole';
    shots = [`At the ${IDX.loc[rc.store]?.name || 'store'} counter`, STORE_CLOSE[rc.grade], `Outsole at the counter: grade ${rc.grade}`];
    files = [1, 2, 3].map(n => `STORE_${k.return_id}_${n}.jpg`);
  } else {
    if (k.custom) return k.photo.url ? [{ title: 'The photo the customer uploaded', img: k.photo.url, file: k.photo.file, real: true }] : [];
    files = [k.photo.file, `${stem}_2.jpg`, `${stem}_3.jpg`];
  }
  const shot = (view) => {
    const u = `ph${++PHOTO_UID}`;
    if (view === 'third' && third === 'box') return `<svg viewBox="0 0 480 360" role="img">${floorSVG(floor, u)}<g transform="translate(120,40) scale(1.1)">${boxSVG('crushed')}</g><rect width="480" height="360" fill="url(#${u}-vig)"/></svg>`;
    if (view === 'third' || (view === 'close' && close === 'insole')) {
      return `<svg viewBox="0 0 480 360" role="img">${floorSVG(floor, u)}<ellipse cx="240" cy="196" rx="96" ry="160" fill="#000" opacity=".22" filter="url(#${u}-blur)"/>${soleSVG(plan.shape, c, u, marks, view === 'close')}<rect width="480" height="360" fill="url(#${u}-vig)"/></svg>`;
    }
    const scene = `${floorSVG(floor, u)}${box ? boxSVG(box) : ''}
      <ellipse cx="250" cy="292" rx="176" ry="10" fill="#000" opacity=".3" filter="url(#${u}-blur)"/>
      <g transform="translate(-30,-22) scale(.96)" opacity=".95"><g>${shoeSVG(plan.shape, { ...c, base: c.shade }, u + 'b', [], false)}</g></g>
      ${shoeSVG(plan.shape, c, u + 'a', marks, tag)}<rect width="480" height="360" fill="url(#${u}-vig)"/>`;
    return `<svg viewBox="${view === 'close' ? CLOSE_BOX[close] || CLOSE_BOX.toe : '0 0 480 360'}" preserveAspectRatio="xMidYMid slice" role="img">${scene}</svg>`;
  };
  return ['side', 'close', 'third'].map((v, i) => {
    const url = realPhotoURL(photoKey(caseId, set, i));
    return url ? { title: shots[i], img: url, file: files[i], real: true } : { title: shots[i], svg: shot(v), file: files[i], real: false };
  });
}
/** A strip of thumbnails; clicking one opens the viewer. */
function photoStrip(caseId, opts = {}) {
  const set = opts.set || 'customer';
  const ph = casePhotos(caseId, set);
  if (!ph.length) return opts.empty ? `<p class="small muted">${esc(opts.empty)}</p>` : '';
  return `<div class="photo-strip${opts.small ? ' small' : ''}">${ph.map((p, i) => `<button type="button" class="ph" data-photo="${esc(caseId)}" data-pset="${set}" data-pi="${i}" aria-label="${esc(`Open photo ${i + 1} of ${ph.length}: ${p.title}`)}">
      <span class="ph-img">${p.img ? `<img src="${esc(p.img)}" alt="">` : p.svg}${p.real ? '<span class="ph-real">Photo</span>' : ''}</span>${opts.small ? '' : `<span class="ph-cap"><b>${esc(p.title)}</b><span class="mono">${esc(p.file)}</span></span>`}</button>`).join('')}</div>`;
}
function photoFacts(caseId, set) {
  const k = IDX.kase[caseId], cs = CASES[caseId];
  if (set === 'packing') return { head: 'Quality check at dispatch', list: ['Unworn, no marks', 'Stitching and sole bond checked', 'Packed in the original box with tissue'], grade: 'A' };
  if (set === 'store') { const rc = cs && cs.received; return { head: 'What the store staff found', list: rc && rc.rule ? [rc.rule.text] : [], grade: rc && rc.grade }; }
  return { head: 'What the photo check found', list: k.photo.findings || [], grade: k.photo.grade, mismatch: k.photo.consistent === false };
}
function openPhoto(caseId, i, set = 'customer') {
  const ph = casePhotos(caseId, set); if (!ph.length) return;
  i = (i + ph.length) % ph.length;
  const k = IDX.kase[caseId], p = ph[i], f = photoFacts(caseId, set), key = photoKey(caseId, set, i);
  let box = document.getElementById('lightbox');
  if (!box) { box = document.createElement('div'); box.id = 'lightbox'; box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); document.body.appendChild(box); }
  box.dataset.case = caseId; box.dataset.pi = i; box.dataset.pset = set;
  const canReplace = !k.custom || set !== 'customer';
  box.innerHTML = `<div class="lb-inner"><div class="lb-img">${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.title)}">` : p.svg}</div>
    <div class="lb-side"><div class="eyebrow">${esc(k.return_id)} · ${esc(PHOTO_SETS[set])} · ${i + 1} of ${ph.length}</div><h3>${esc(p.title)}</h3><div class="mono small muted">${esc(p.file)}</div>
      ${f.list.length ? `<div class="eyebrow" style="margin-top:14px">${esc(f.head)}</div><ul class="evi">${f.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${f.grade ? `<div class="small"><b>Grade ${esc(f.grade)}</b>: ${esc(GRADE[f.grade] || '')}${f.mismatch ? ' · <span class="pill warn">Doesn\'t match what the customer said</span>' : ''}</div>` : ''}
      <p class="note">${p.real ? 'A real photo, added for this return.' : 'Illustration drawn to match the findings. Replace it with a real photo below.'}</p>
      ${canReplace ? `<div class="lb-real"><label class="btn secondary sm"><input type="file" accept="image/jpeg,image/png,image/webp" data-realphoto="${esc(key)}" hidden>${p.real ? 'Replace this photo' : 'Use a real photo'}</label>${p.real ? `<button type="button" class="btn secondary sm" data-unreal="${esc(key)}">Back to the drawing</button>` : ''}
        <span class="small muted" id="lb-status">${PHOTO_STORE.shared ? 'Saved with the page for everyone who opens it.' : 'Kept in this tab only: open the page in Claude to save photos for everyone.'}</span></div>` : ''}
      <div class="lb-nav">${ph.length > 1 ? `<button type="button" class="btn secondary sm" data-lb="prev">← Previous</button><button type="button" class="btn secondary sm" data-lb="next">Next →</button>` : ''}<button type="button" class="btn sm" data-lb="close">Close</button></div></div></div>`;
  box.hidden = false;
  box.querySelector('[data-lb="close"]').focus();
}
function closePhoto() { const b = document.getElementById('lightbox'); if (b) b.hidden = true; }
function refreshPhotos() {
  UI.onPhotosChanged?.();
  const b = document.getElementById('lightbox'); if (b && !b.hidden) openPhoto(b.dataset.case, +b.dataset.pi, b.dataset.pset);
}
/** Shrink a camera photo to at most 1600px on the long side, as JPEG. */
async function shrinkPhoto(file) {
  try {
    const bmp = await createImageBitmap(file), sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise(res => cv.toBlob(b => res(b || file), 'image/jpeg', 0.86));
  } catch (e) { return file; }
}
async function putRealPhoto(key, file) {
  const st = document.getElementById('lb-status'); if (st) st.textContent = 'Adding the photo…';
  const blob = await shrinkPhoto(file);
  const [caseId, set, slot] = key.split('__');
  if (PHOTO_STORE.assets && PHOTO_STORE.db) {
    try {
      const up = await PHOTO_STORE.assets.upload(blob, { type: blob.type || 'image/jpeg' });
      const old = PHOTO_STORE.real[key];
      PHOTO_STORE.real[key] = { asset: up.id };
      await PHOTO_STORE.db.collection('photos').doc(key).set({ case: caseId, set, slot: Number(slot), asset: up.id, at: new Date().toISOString() });
      if (old && old.asset !== up.id) PHOTO_STORE.assets.delete(old.asset).catch(() => {});
      delete PHOTO_STORE.local[key];
      return refreshPhotos();
    } catch (e) { if (st) st.textContent = `Couldn't save it for everyone (${e && e.code || 'error'}). Kept in this tab instead.`; }
  }
  PHOTO_STORE.local[key] = URL.createObjectURL(blob);
  refreshPhotos();
}
async function removeRealPhoto(key) {
  if (PHOTO_STORE.local[key]) { delete PHOTO_STORE.local[key]; return refreshPhotos(); }
  const r = PHOTO_STORE.real[key]; if (!r) return;
  try { await PHOTO_STORE.db.collection('photos').doc(key).delete(); delete PHOTO_STORE.real[key]; PHOTO_STORE.assets?.delete(r.asset).catch(() => {}); }
  catch (e) { const st = document.getElementById('lb-status'); if (st) st.textContent = "Couldn't remove it: only people who can edit the page can."; return; }
  refreshPhotos();
}
async function initPhotoStore() {
  const use = window.claude && typeof window.claude.use === 'function' ? n => window.claude.use(n) : () => Promise.resolve(null);
  try {
    const [db, assets] = await Promise.all([use('db').catch(() => null), use('assets').catch(() => null)]);
    PHOTO_STORE.db = db; PHOTO_STORE.assets = assets; PHOTO_STORE.shared = !!(db && assets);
    if (!db) return;
    db.collection('photos').onSnapshot(snap => {
      const next = {}; for (const d of snap.docs) { const v = d.data(); if (v && v.asset) next[d.id] = { asset: String(v.asset) }; }
      PHOTO_STORE.real = next; refreshPhotos();
    }, () => {});
  } catch (e) { /* the drawings stay */ }
}
document.addEventListener('change', e => { const t = e.target; if (t && t.dataset && t.dataset.realphoto && t.files && t.files[0]) putRealPhoto(t.dataset.realphoto, t.files[0]); });
document.addEventListener('click', e => {
  const un = e.target.closest('[data-unreal]'); if (un) return removeRealPhoto(un.dataset.unreal);
  const t = e.target.closest('[data-photo],[data-lb],#lightbox');
  if (!t) return;
  if (t.dataset.photo) return openPhoto(t.dataset.photo, +t.dataset.pi, t.dataset.pset || 'customer');
  const box = document.getElementById('lightbox');
  if (t.dataset.lb === 'close' || t === box && e.target === box) return closePhoto();
  if (t.dataset.lb) openPhoto(box.dataset.case, +box.dataset.pi + (t.dataset.lb === 'next' ? 1 : -1), box.dataset.pset);
});
document.addEventListener('keydown', e => {
  const box = document.getElementById('lightbox'); if (!box || box.hidden) return;
  if (e.key === 'Escape') closePhoto();
  if (e.key === 'ArrowRight') openPhoto(box.dataset.case, +box.dataset.pi + 1, box.dataset.pset);
  if (e.key === 'ArrowLeft') openPhoto(box.dataset.case, +box.dataset.pi - 1, box.dataset.pset);
});
