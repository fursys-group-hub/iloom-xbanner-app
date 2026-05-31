// URL을 진짜 스캔 가능한 QR 코드 SVG로 생성합니다.
// 사용법: node scripts/generate-qr.mjs <URL> <출력파일경로> [--margin 4] [--ecl H]
// 예시:
//   node scripts/generate-qr.mjs "https://open.kakao.com/o/gcsEGTui" "assets/qr/도안우미린트리쉐이드_단톡방.svg"
//
// ecl(에러 정정 레벨): L(7%) / M(15%) / Q(25%) / H(30%) — 인쇄용은 H 권장
// margin: QR 주변 흰 여백(quiet zone). 기본 4 (표준 권장값)

import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('사용법: node scripts/generate-qr.mjs <URL> <출력파일경로> [--margin N] [--ecl L|M|Q|H]');
  process.exit(1);
}

const url = args[0];
const outRel = args[1];

let margin = 4;
let ecl = 'H';
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--margin' && args[i + 1]) { margin = Number(args[i + 1]); i++; }
  else if (args[i] === '--ecl' && args[i + 1]) { ecl = args[i + 1].toUpperCase(); i++; }
}

const outAbs = path.resolve(PROJECT_ROOT, outRel);
await fs.mkdir(path.dirname(outAbs), { recursive: true });

const svg = await QRCode.toString(url, {
  type: 'svg',
  errorCorrectionLevel: ecl,
  margin,
  color: { dark: '#1A1A1A', light: '#FFFFFF' },
});

await fs.writeFile(outAbs, svg, 'utf8');

const stat = await fs.stat(outAbs);
console.log('✅ QR 코드 생성 완료');
console.log(`   URL:      ${url}`);
console.log(`   출력파일:  ${outAbs}`);
console.log(`   크기:      ${(stat.size / 1024).toFixed(1)}KB`);
console.log(`   ECL:      ${ecl} (인쇄용은 H 권장 — 오염·접힘에도 스캔 가능)`);
console.log(`   margin:   ${margin} 모듈 (QR 주변 흰 여백)`);
