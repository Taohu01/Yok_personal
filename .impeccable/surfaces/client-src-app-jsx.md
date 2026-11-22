---
version: 1
slug: "client-src-app-jsx"
primary_target: "client/src/App.jsx"
related_targets: ["client/src/pages/Cards.jsx","client/src/pages/Stock.jsx"]
---

## Scope

The whole app shell plus its two working screens: การ์ดงาน (work cards) and สต๊อกสินค้า (stock import, review, export). Visitor mode: Operate.

## Audience and task

One back-office owner of a multi-branch phone retailer, at a desk, daily. Log tasks as cards; import the POS stock report (xlsx/xls/csv/pdf), check it, and export the office summary (xlsx, csv, PDF via print). Totals must reconcile with the source.

## Direction contract

THESIS: The app is a bank passbook (สมุดบัญชี) for the business. Every task and every import is an entry stamped with its date; stock carries a running balance column. It refuses the default admin dashboard of KPI tiles over a white table.

OWN-WORLD: Deep blue #005A9C cover as the left rail, header bands, primary buttons and selections (30%; white text on it, and the same blue as text or line on light grounds), cool grey-green #EAEFEF page (60%), gold #FFCC00 (10%) only for the thing in hand: active tab, newest import rows, selected card, primary focus. Thai type: Anuphan for UI and data with tabular figures, Noto Sans Thai Looped for headings and date stamps (the printed passbook voice). Hairline-ruled white leaves with 10px corners, 1px #C9D3D3 seams, stamped date boxes in blue ink.

STORY: The visitor sees what they did and what stock they hold, trusts the totals because a reconciliation strip says they match the source, and exports in one click.

FIRST VIEWPORT: 248px blue rail (seal, สมุดงาน, nav with counts; active tab opens into the page colour). Main: heading plus stamped date at left, import and export at right; a five-cell reconciliation strip; the stock leaf (filter chips, sortable table with ยอดสะสม) full width; import history and recent work sit beneath it as two columns, moving beside the table only at ≥1760px (the ten-column stock table needs ~1000px to show every price without wrapping, which 1440 cannot spare next to a side column). Cards page: a single ruled balance line under the header (ค้าง · เสร็จวันนี้ · วันนี้ · 7 วัน), never KPI tiles; each day group opens with an ink date stamp.

FORM: Grounded candidate 6 of 7 (bank passbook), seed:efc4ee9cf67dd406. Signature move: the "print" — new entries arrive as a gold line sweeping left to right across the row, then settle; dates are ink stamps. Raises: gold only for the thing in hand (orienteering); fixed card furniture (goods catalog); one data size, hierarchy by weight (manual); reconciliation strip (j-card); isolated outline delete (console); state recolours rows without moving the grid (split-flap).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
