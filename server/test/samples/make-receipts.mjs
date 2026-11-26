// Builds made-up receipt PDFs in three layouts for the receipt-reader tests.
// Needs Microsoft Edge (prints HTML to PDF). Run: node server/test/samples/make-receipts.mjs
// Everything here is fictional: shop "ร้านทดสอบ", buyers "คุณทดสอบ …", IMEI 3500000000…
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'receipts-'));
const edge = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pdf(name, body, css) {
  const html = join(tmp, `${name}.html`);
  writeFileSync(html, `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 14mm 12mm; }
    body { font-family: Tahoma, 'Leelawadee UI', sans-serif; font-size: 9.5px; color: #000; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    .r { text-align: right; } .c { text-align: center; } .b { font-weight: bold; }
    ${css}</style></head><body>${body}</body></html>`);
  const out = join(here, `${name}.pdf`);
  rmSync(out, { force: true });
  execFileSync(edge, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${join(tmp, 'edge')}`, `--print-to-pdf=${out}`, pathToFileURL(html).href], { stdio: 'ignore' });
}

// A: the shop system's layout (English + Thai headers, IMEI under each item)
const A = [
  { sku: 'SH261100501', name: 'APPLE IPHONE 15 128GB Black', imei: '350000000000101', qty: 1, price: 18990, disc: 0 },
  { sku: 'SH261100502', name: 'APPLE IPHONE 13 128GB Blue', imei: '350000000000102', qty: 1, price: 6990, disc: 0 },
  { sku: 'AC000000123', name: 'ADAPTER 20W USB-C', imei: '', qty: 2, price: 390, disc: 80 },
];
const aSub = A.reduce((n, i) => n + i.qty * i.price - i.disc, 0);
pdf(
  'receipt-system',
  `<table class="box"><tr><td class="head"><div class="issuer">ร้านทดสอบ (สาขาทดสอบ)</div><div class="small">ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ</div></td></tr></table>
  <table class="box"><tr><td style="width:33%"></td><td class="title">ใบเสร็จรับเงิน</td>
    <td class="meta"><table>
      <tr><td>Receipt No. :</td><td class="b">RCTEST0001</td><td></td></tr>
      <tr><td>Date :</td><td class="b">26/11/2569</td><td></td></tr>
      <tr><td>Time :</td><td class="b">14:05:12</td><td class="r">Page : 1 / 1</td></tr>
    </table></td></tr></table>
  <table class="box"><tr><td class="cust">
      <div><b>Customer No. :</b>&nbsp;&nbsp;&nbsp;C0001</div>
      <div><b>Customer Name :</b>&nbsp;&nbsp;&nbsp;คุณทดสอบ หนึ่ง</div>
      <div class="tel">Tel. 0000000000</div></td>
    <td class="terms"><table><tr><td>Salesman Code</td><td>รหัสพนักงานขาย :</td><td>ทดสอบ</td></tr></table></td></tr></table>
  <table class="items"><thead><tr>
    <th style="width:34px">Item<br>ลำดับ</th><th style="width:100px">Article Number<br>รหัสสินค้า</th><th>Article Description<br>รายการ</th>
    <th style="width:38px">Qty<br>จำนวน</th><th style="width:48px">Unit<br>หน่วย</th><th style="width:70px">Price/Unit<br>ราคา/หน่วย</th>
    <th style="width:52px">Discount<br>ส่วนลด</th><th style="width:76px">Amount<br>จำนวนเงิน</th></tr></thead>
  <tbody>${A.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${x.sku}</td>
    <td><div class="d">${x.name}</div>${x.imei ? `<div class="d">IMEI/Serial ${x.imei}</div>` : ''}</td>
    <td class="r">${x.qty}</td><td class="c">${x.imei ? 'เครื่อง' : 'ชิ้น'}</td><td class="r">${money(x.price)}</td>
    <td class="r">${x.disc ? money(x.disc) : ''}</td><td class="r">${money(x.qty * x.price - x.disc)}</td></tr>`).join('')}</tbody></table>
  <table class="box foot">
    <tr><td rowspan="4" style="width:60%">ได้รับสินค้าดังรายการข้างบนนี้เรียบร้อยแล้ว<br>Received the above mentioned goods in good order and condition.</td>
      <td>รวมเงิน</td><td>Sub Total</td><td class="r">${money(aSub)}</td></tr>
    <tr><td>ส่วนลด</td><td>Discount</td><td class="r">${money(500)}</td></tr>
    <tr><td>ภาษีมูลค่าเพิ่ม</td><td>Total VAT</td><td class="r">${money(((aSub - 500) * 7) / 107)}</td></tr>
    <tr><td>ยอดสุทธิ</td><td>Grand Total</td><td class="r b">${money(aSub - 500)}</td></tr></table>`,
  `.box { border: 1px solid #000; border-bottom: 0; } .box td { vertical-align: top; padding: 4px 8px; }
   .head { text-align: center; padding: 8px 0 22px !important; } .issuer { font-size: 13px; font-weight: bold; } .small { font-size: 8px; }
   .title { font-size: 14px; font-weight: bold; text-align: right; vertical-align: middle !important; border-left: 1px solid #000; }
   .meta { width: 34%; border-left: 1px solid #000; } .meta td, .terms td { padding: 1px 6px; }
   .cust { width: 50%; line-height: 1.6; } .tel { margin-top: 10px; padding-left: 90px; } .terms { border-left: 1px solid #000; }
   .items { border: 1px solid #000; } .items th { border: 1px solid #000; font-weight: normal; padding: 3px 2px; font-size: 9px; line-height: 1.5; }
   .items td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 9px 4px; vertical-align: middle; }
   .items .d { font-size: 7.5px; line-height: 1.35; } .foot { border-bottom: 1px solid #000; margin-top: 40px; } .foot td { padding: 3px 8px; }`,
);

// B: a plain Thai receipt
const B = [
  { name: 'Samsung Galaxy A16 8/256GB สีดำ', qty: 1, price: 6990, disc: 200 },
  { name: 'ฟิล์มกระจกนิรภัย', qty: 2, price: 150, disc: 0 },
  { name: 'เคสใสกันกระแทก', qty: 1, price: 290, disc: 0 },
];
const bSub = B.reduce((n, i) => n + i.qty * i.price - i.disc, 0);
pdf(
  'receipt-thai',
  `<h1 class="c">ใบเสร็จรับเงิน</h1><p class="c">ร้านทดสอบ · โทร 0000000000</p>
  <table class="hd"><tr><td>เลขที่ใบเสร็จ: R-2569-0002</td><td class="r">วันที่ 26/11/2569</td></tr>
  <tr><td>ชื่อผู้ซื้อ: คุณทดสอบ สอง</td><td></td></tr></table>
  <table class="it"><thead><tr><th style="width:40px">ลำดับ</th><th>รายการสินค้า</th><th style="width:50px">จำนวน</th><th style="width:80px">ราคา</th><th style="width:70px">ส่วนลด</th><th style="width:90px">จำนวนเงิน</th></tr></thead>
  <tbody>${B.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${x.name}</td><td class="c">${x.qty}</td><td class="r">${money(x.price)}</td><td class="r">${x.disc ? money(x.disc) : '-'}</td><td class="r">${money(x.qty * x.price - x.disc)}</td></tr>`).join('')}</tbody></table>
  <table class="sum"><tr><td>ยอดรวม</td><td class="r">${money(bSub)}</td></tr><tr><td>ส่วนลด</td><td class="r">${money(100)}</td></tr><tr><td class="b">ยอดสุทธิ</td><td class="r b">${money(bSub - 100)}</td></tr></table>`,
  `h1 { font-size: 18px; margin: 0 0 4px; } p { margin: 0 0 16px; } .hd td { padding: 3px 0; font-size: 11px; }
   .it { margin-top: 14px; } .it th, .it td { border: 1px solid #666; padding: 6px; font-size: 10.5px; } .it th { background: #eee; }
   .sum { width: 40%; margin: 14px 0 0 auto; } .sum td { padding: 4px 6px; font-size: 11px; }`,
);

// C: a short POS-style slip, no item numbers, total only
pdf(
  'receipt-pos',
  `<div class="slip"><div class="c b big">ร้านทดสอบ</div><div class="c">ใบเสร็จรับเงิน</div>
  <div>เลขที่ RC/0003</div><div>วันที่ 25/11/2026 18:20</div><div>ลูกค้า คุณทดสอบ สาม</div>
  <table><thead><tr><th>รายการ</th><th class="r">จำนวน</th><th class="r">ราคา</th><th class="r">รวม</th></tr></thead><tbody>
  <tr><td>หูฟัง Bluetooth</td><td class="r">1</td><td class="r">590.00</td><td class="r">590.00</td></tr>
  <tr><td>สายชาร์จ USB-C 1m</td><td class="r">2</td><td class="r">120.00</td><td class="r">240.00</td></tr></tbody></table>
  <table><tr><td class="b">รวมทั้งสิ้น</td><td class="r b">830.00</td></tr></table></div>`,
  `.slip { width: 300px; font-size: 11px; line-height: 1.7; } .big { font-size: 15px; } th, td { padding: 2px 4px; } thead th { border-bottom: 1px dashed #000; } table { margin-top: 8px; }`,
);

rmSync(tmp, { recursive: true, force: true });
console.log('wrote receipt-system.pdf, receipt-thai.pdf, receipt-pos.pdf');
