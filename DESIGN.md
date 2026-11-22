---
name: yok สมุดงาน
description: A Thai back-office passbook for one phone-shop owner, used to log work and reconcile stock.
colors:
  page: "#eaefef"
  seam-page: "#c9d3d3"
  on-page-mute: "#574d50"
  wash: "#eaefef"
  wash-deep: "#dde4e4"
  leaf: "#fbfcfc"
  white: "#ffffff"
  seam: "#c9d3d3"
  seam-soft: "#e2e8e8"
  cover: "#005a9c"
  cover-deep: "#005a9c"
  cover-2: "#004a82"
  cover-3: "#003f6e"
  cover-ink: "#f2f7fc"
  cover-mute: "#b9d3ea"
  gold: "#ffcc00"
  gold-soft: "#fff6d1"
  gold-deep: "#7a5c00"
  ink: "#1d1416"
  mute: "#574d50"
  faint: "#6f6568"
  used: "#dbe8f4"
  ok: "#23633a"
  ok-soft: "#e1f0e5"
  warn: "#7d4f00"
  danger: "#a3122a"
  danger-soft: "#fbe7ea"
typography:
  display:
    fontFamily: "Noto Sans Thai Looped, Anuphan, Leelawadee UI, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
  display-sm:
    fontFamily: "Noto Sans Thai Looped, Anuphan, Leelawadee UI, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
  headline-lg:
    fontFamily: "Noto Sans Thai Looped, Anuphan, Leelawadee UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
  wordmark:
    fontFamily: "Noto Sans Thai Looped, Anuphan, Leelawadee UI, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "Noto Sans Thai Looped, Anuphan, Leelawadee UI, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.55
  stamp:
    fontFamily: "Noto Sans Thai Looped, Anuphan, Leelawadee UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "0.01em"
  stamp-sm:
    fontFamily: "Noto Sans Thai Looped, Anuphan, Leelawadee UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.01em"
  title:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum' 1"
  control:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.55
    fontFeature: "'tnum' 1"
  figure:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.43
  small:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  badge:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  meta:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  badge-sm:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    fontFeature: "'tnum' 1"
  print-body:
    fontFamily: "Anuphan, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    fontFeature: "'tnum' 1"
rounded:
  stamp: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  leaf: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  gutter-desk: "36px"
components:
  button-primary:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.cover-2}"
  button-outline:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.cover-deep}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "rgb(0 90 156 / 0.1)"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.wash-deep}"
    textColor: "{colors.ink}"
  button-delete:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.lg}"
    padding: "4px 8px"
    height: "32px"
  button-delete-hover:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
  button-delete-confirm:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    typography: "{typography.badge}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
  segmented:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "2px"
  segmented-option:
    textColor: "{colors.mute}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "6px 14px"
  segmented-option-active:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
  leaf:
    backgroundColor: "{colors.leaf}"
    rounded: "{rounded.leaf}"
  stamp:
    textColor: "{colors.cover-deep}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "1px 10px"
  stamp-sm:
    textColor: "{colors.cover-deep}"
    typography: "{typography.stamp-sm}"
    rounded: "{rounded.stamp}"
    padding: "0 7px"
  rail:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    width: "248px"
  nav-item:
    textColor: "{colors.cover-ink}"
    typography: "{typography.control}"
    padding: "10px 16px 10px 20px"
  nav-item-hover:
    backgroundColor: "{colors.cover-2}"
    textColor: "{colors.cover-ink}"
  nav-item-active:
    backgroundColor: "{colors.page}"
    textColor: "{colors.cover-deep}"
    rounded: "{rounded.leaf}"
  nav-count:
    backgroundColor: "{colors.cover-3}"
    textColor: "{colors.cover-mute}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
  nav-count-active:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
  table-header:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    typography: "{typography.control}"
    padding: "10px 12px"
  table-cell:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "8px 12px"
  table-total:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.cover-deep}"
    typography: "{typography.control}"
    padding: "10px 16px"
  strip-cell:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    padding: "14px 20px"
  status-doing:
    backgroundColor: "{colors.gold-soft}"
    textColor: "{colors.warn}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-done:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  priority-high:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.md}"
    padding: "1px 8px"
  priority-mid:
    backgroundColor: "{colors.white}"
    textColor: "{colors.cover-deep}"
    typography: "{typography.badge}"
    rounded: "{rounded.md}"
    padding: "1px 8px"
  priority-low:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.mute}"
    typography: "{typography.badge}"
    rounded: "{rounded.md}"
    padding: "1px 8px"
  condition-new:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
    padding: "1px 8px"
  condition-used:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
    padding: "1px 8px"
  condition-used-sm:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    typography: "{typography.badge-sm}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  variance-badge:
    backgroundColor: "{colors.gold-soft}"
    textColor: "{colors.gold-deep}"
    typography: "{typography.badge-sm}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  used-row-print:
    backgroundColor: "{colors.used}"
    textColor: "{colors.ink}"
    typography: "{typography.print-body}"
  toast:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.leaf}"
    padding: "12px 16px"
---

# Design System: yok สมุดงาน

## Overview

**Creative North Star: "The Business Passbook"**

The app is built as a Thai bank passbook (สมุดบัญชี) kept for one business. A deep blue cover runs down the left edge; the pages are a pale, cool grey; every piece of work and every stock import is an entry written into a white leaf and dated with a blue ink stamp. Stock carries a running balance column the way a passbook does. Trust comes from reconciliation, not decoration: a strip under the heading says whether the totals match the source file, and the same totals carry through to the screen, the printout and the Excel file.

Density is that of a desk ledger: one reading size (15px) for everything you scan, tabular numerals everywhere, hairline seams between rows and a single soft shadow under each leaf. Hierarchy comes from weight and colour, not from size jumps. Gold is rationed to the thing in your hand at this moment, so it always answers "where am I / what did I just do". Motion has one job: an entry being "printed" into the book (a gold sweep across a new row) and a date stamp landing with a small thunk.

The world rejects the default admin dashboard: no KPI tiles floating over a white table, no gradient headers, no decorative colour. Summaries are ruled lines or one divided strip; tables carry a solid blue header band.

**Key Characteristics:**
- 60/30/10 colour: cool grey page, deep blue cover, gold for the thing in hand.
- Two Thai voices: looped Noto Sans Thai Looped for titles and stamps, Anuphan for everything read or typed.
- One data size (15px) with tabular figures; hierarchy by weight.
- White leaves (10px corners) with 1px seams on a flat grey page.
- Blue ink date stamps, tilted, on every dated heading.
- The "print" sweep for new entries; state recolours rows in place.
- Thai-first copy, Buddhist-era dates, Thai unit nouns on every count.

## Colors

A cool, near-neutral paper field under a deep, saturated blue cover, with a single saturated gold reserved for focus of attention.

### Primary
- **Passbook Blue** (cover): the 30% as a fill. The rail, table header bands, primary buttons, selected chips and segments, toasts, the drag-to-import scrim, the solid มือ 2 badge and the สำคัญสูง priority badge. Text on it is **Cover Paper** (cover-ink, 6.6:1) and secondary text **Cover Mist** (cover-mute, 4.6:1). Its hover step is **Cover Lift** (cover-2); its shade is **Cover Night** (cover-3, the inactive nav count pill).
- **Blue Ink** (cover-deep): the same blue used as text or line on light grounds. Page and section titles, date stamps, brand names in tables, links (อ่านต่อ, ดูการ์ดทั้งหมด), the total row text and its 2px rule, the field caret and focus border, and the focus outline everywhere off the rail. It reads 6.2:1 on the page and 6.9:1 on a leaf. It is a separate role from Passbook Blue so that ink and fill can move independently.

### Secondary
- **Thai Gold** (gold): the 10%, used as a signal, never as a fill for content. On light grounds: the active nav count, the 3px ring on the selected import and on a card being composed or edited, the print sweep on new rows, and text selection. On blue: the seal, the active sort arrow, the toast icon, the rail focus ring, and the dashed frame and icon of the drag-to-import scrim. **Gold Wash** (gold-soft) is the tint for an expanded source row, the drop zone under a dragged file, the variance badge and the in-progress status pill; **Gold Ink** (gold-deep) is text on that wash.

### Neutral
- **Ledger Grey** (page): the 60%. The app background and the active nav tab (it opens into the page). **Page Seam** (seam-page) rules lines drawn directly on the page (the balance line, day-group heads); **Page Mute** (on-page-mute) is secondary text directly on the page (subtitles, day-group counts).
- **Leaf Wash** (wash) and **Deep Wash** (wash-deep): fills inside leaves. Wash is the row hover, the total row band, the มือ 1 tag, the สำคัญต่ำ tag and tag tokens; Deep Wash is the ghost button hover and the row-expand button hover.
- **Leaf White** (leaf): every content surface (cards, strip, table leaf, history rows) and the outline button's ground. **White** is reserved for inputs, chips, the segmented track and the source-row inset so fields read as writable.
- **Seam** (seam): 1px borders on leaves, fields and chips, brand-group dividers, the delete divider. **Soft Seam** (seam-soft) divides rows and strip cells.
- **Ink** (ink): body text. **Mute** (mute): secondary text, labels, the running balance. **Faint** (faint): placeholders, empty-cell dashes, meta icons.
- **Used-Phone Wash** (used): the pale blue tint on full มือ 2 rows in print and in Excel.

### Semantic
- **Ledger Green** (ok) on **Mint** (ok-soft): done status, the "totals match" verdict.
- **Amber Ink** (warn): in-progress status text, skipped-line warning.
- **Seal Red** (danger) on **Blush** (danger-soft): delete, error banners, form errors.

### Named Rules
**The 60/30/10 Rule.** Ledger Grey about 60% of any screen, blue about 30% (the rail plus header bands, primary actions and selections), gold no more than 10%. The rule is pinned by the owner (#EAEFEF / #005A9C / #FFCC00) and holds in screen, print, Excel and the favicon alike.

**The Thing-In-Hand Rule.** Pure gold marks only what the user is holding right now: the active tab's count, the selected import, the card being written or edited, the sorted column's arrow, the rows that just arrived, the toast that just appeared, the file being dragged. Nothing at rest is gold except the seal, which is the book's mark. If two things on one screen are gold for different reasons, one of them is wrong.

**The Used-Phone Tint Rule.** มือ 2 is always told apart by blue before its label is read: on screen it is a solid Passbook Blue badge with Cover Paper text, while มือ 1 sits on Leaf Wash in ink; in print and Excel the whole มือ 2 row carries Used-Phone Wash.

## Typography

**Display Font:** Noto Sans Thai Looped (with Anuphan, Leelawadee UI)
**Body Font:** Anuphan (with Leelawadee UI, Tahoma)
**Export Font:** Tahoma (Excel only; ships with Windows and Office and renders Thai cleanly)

**Character:** The looped face is the printed voice of the passbook: titles, section heads, the wordmark and the stamps. Anuphan is the clerk's hand: loopless, modern, legible at 12 to 15px with tabular figures switched on for the whole document. Both are self-hosted (Anuphan 400 to 700, Looped 500 and 700).

### Hierarchy
- **Display** (700, 28px, 1.25): page titles only (การ์ดงาน, สต๊อกสินค้า), always in Blue Ink, always followed by a date stamp.
- **Display Small** (700, 26px, 1.25): the same page titles below 640px.
- **Headline Large** (700, 20px, 1.4): the one heading inside an empty state or the drop zone, and the report title in print.
- **Wordmark** (700, 19px, 1.25): สมุดงาน on the rail, in Cover Paper beside the seal.
- **Headline** (700, 17px): section heads (ประวัติการนำเข้า, งานที่กำลังทำ) and day-group heads beside their stamp.
- **Stamp** (700, 15px / 13px small, 0.01em): dates inside ink stamps.
- **Title** (600, 16px, 1.375): work card titles; muted when the card is done.
- **Body** (400, 15px, 1.55, tabular): all reading text and every table cell.
- **Control** (600, 15px): buttons, segments, nav items, table headers, total rows.
- **Figure** (600, 24px, 1.25, tabular): the four reconciliation figures in the strip, nowhere else.
- **Label / Small** (600 / 400, 14px): form labels in mute, nav counts; chip text, sub-counts, strip labels, source-row tables.
- **Badge / Meta** (600 / 400, 13px): status pills, priority and condition tags, confirm-delete; tags, durations, file meta, the rail date.
- **Badge Small** (600, 12px, tabular): the +N price-variance badge and the condition tag in the phone stock list.
- **Print Body** (400, 11px, tabular): the whole printed report on A4 landscape; the totals line figures rise to 14px bold.

### Named Rules
**The One Data Size Rule.** Every figure in a table, list or meta line sits at body size with tabular numerals. Quantities and brands rise by weight (600) and colour (Blue Ink), never by size. The strip's 24px figures are the single exception, because they are the verdict.

**The Two Voices Rule.** Noto Sans Thai Looped is for what the book prints (titles, heads, stamps, wordmark). Anything the user reads row by row or types is Anuphan.

**The Thai-First Rule.** All UI copy is Thai. Dates use the Buddhist era: "22 พ.ย. 69" on stamps and in the UI, "22/11/69" in export titles. Numbers use Thai thousands separators. Every count carries its Thai unit noun (เครื่อง, รายการ, รุ่น, บรรทัด, การ์ด). Latin appears only for file formats and for product data carried over from the source report.

## Layout

A fixed cover plus a flowing page. From 1024px up, the shell is a two-column grid: a 248px blue rail, full viewport height and sticky, then the page. Below 1024px the rail collapses into a sticky blue top bar (seal, wordmark, date) with the nav as horizontal tabs whose active tab opens downward into the page colour.

The page gutter is 16px on phones, 24px from 640px and 36px from 1024px, with 24px (32px desktop) above the first heading. Content is capped at 1440px on the cards page and 1600px on the stock page (1100px for the empty import state). Vertical rhythm between blocks is 20 to 24px; day groups sit 32px apart; cards in a group are 16px apart in one, two (768px) or three (1536px) columns, stretched to equal height.

The stock page stacks heading, reconciliation strip, then the stock leaf at full width. Import history and in-progress work sit beneath it as two columns from 768px, and move into a 340px column beside the table only from 1760px, because the ten-column table needs about 1000px to show every price without wrapping. The strip runs two columns on phones, four from 640px and four plus a wider verdict cell from 1280px. The detail table holds a 960px minimum and scrolls horizontally; below 640px it becomes a stacked list (brand, model, tags on the left; quantity, retail and wholesale on the right).

Print is its own layout: A4 landscape, 12mm by 10mm margins, 11px body on white, the app shell hidden and only the report shown.

## Elevation & Depth

Nearly flat. Depth is a single step: a white leaf resting on the grey page, outlined by a 1px seam and lifted by one soft, faintly blue shadow. There are no stacked elevations, no hover lifts on leaves and no shadowed cards inside leaves. Overlays that must sit above the page (toasts, the drag-to-import scrim at 90% Blue Ink with a 2px backdrop blur) are blue rather than white, so they read as part of the cover, not as another sheet.

### Shadow Vocabulary
- **Leaf rest** (`box-shadow: 0 1px 2px rgb(29 20 22 / 0.06), 0 6px 18px -10px rgb(0 90 156 / 0.18)`): every leaf. The only resting shadow in the system.
- **Pressed key** (`box-shadow: 0 1px 0 rgb(0 40 70 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.14)`): the primary button, giving it a slight physical edge.
- **Field focus** (`box-shadow: 0 0 0 3px rgb(0 90 156 / 0.18)`): with a Blue Ink border on focused inputs.
- **In hand ring** (`box-shadow: 0 0 0 3px #ffcc00`): the selected import and the card being composed or edited.
- **Toast** (`box-shadow: 0 12px 30px -12px rgb(0 40 70 / 0.6)`): blue toasts at bottom right.

### Named Rules
**The Leaf-On-Page Rule.** There is one surface level. If something needs to stand out, it gets a gold ring or a blue fill, not a bigger shadow.

## Shapes

Gently rounded, ruled and rectilinear. Leaves, toasts, error banners and the drop zone use 10px corners. Controls (buttons, fields, the segmented track, source-row inset) use 8px. Inner pieces (segments, tag tokens, priority tags, the row-expand button) use 6px; condition tags and the variance badge use 4px. Stamps are nearly square at 3px, like a rubber stamp's frame. Chips, status pills and nav counts are full pills. The favicon is the gold seal on a Passbook Blue tile with 14/64 corners.

The active nav item is a tab: 10px corners on the side away from the page only (left on desktop, top on mobile), so it fuses with the page it opens into. Lines are 1px seams everywhere; the only heavy line is the 2px Blue Ink rule over a total row. Dashed borders mean "add here": 2px dashed for the file drop zone and the drag scrim's frame, 1px dashed for tag suggestions.

## Components

### Buttons
Firm, compact, ink-on-paper.
- **Shape:** gently rounded (8px), 40px minimum height, 600 weight, icon plus Thai label.
- **Primary:** solid Passbook Blue with Cover Paper text and the pressed-key shadow; one per action group (จดงานใหม่, Export Excel, บันทึกการ์ด, เลือกไฟล์).
- **Hover / Focus / Active:** primary lifts to Cover Lift; all buttons press down 1px on active; transitions 150ms. Focus is a 2px Blue Ink outline 2px off (gold on the rail).
- **Outline:** Blue Ink text on Leaf White with a 40% Blue Ink border, turning to a full Blue Ink border over a 10% blue fill on hover; secondary file actions (นำเข้าไฟล์, CSV, PDF, ล้างตัวกรอง).
- **Ghost:** mute text, Deep Wash fill on hover; cancel and inline edit (แก้ไข).
- **Disabled:** 50% opacity, not-allowed cursor.

### Isolated Delete
A two-step delete that cannot be hit by accident.
- **Rest:** an outline-only icon button (trash, 15px) in Seal Red with a 35% red border, 32px tall, separated from neighbouring actions by a 1px seam divider or its own end slot.
- **Hover / Focus:** fills solid red with white icon.
- **Confirm:** the first press swaps it in place for a solid red ยืนยันลบ button (13px, 600) that takes focus. Clicking it deletes; blurring it reverts. On work cards it also reverts after 4 seconds. No modal.

### Chips
- **Style:** white pill with a seam border, 14px text, 32px tall; Blue Ink border on hover.
- **State:** selected (aria-pressed) is solid Passbook Blue with Cover Paper text at 600. Used for tag filters on the cards page.

### Segmented Control
- **Style:** white track with a seam border and 2px inset; options in 600 weight mute, 6px corners. Two sizes (14px small for filters, 15px for the form).
- **State:** the selected option fills Passbook Blue with Cover Paper text; its count turns Cover Mist. Hover on others fills Leaf Wash. Keyboard focus outlines the option in Blue Ink. Used for status, priority, view (แยกตามสี / สรุปตามรุ่น) and condition.

### Cards / Containers (Leaves)
- **Corner Style:** 10px.
- **Background:** Leaf White.
- **Shadow Strategy:** leaf rest only (see Elevation & Depth).
- **Border:** 1px seam.
- **Internal Padding:** 16px for work cards, 20px for forms and the strip cells, 20 to 24px for guides; table leaves pad their toolbar 12px by 16px and clip their contents.

### Work Card
A dated entry with fixed furniture. Top row: priority tag at left (สำคัญสูง solid Passbook Blue, สำคัญกลาง Blue Ink on white with a 45% blue border, สำคัญต่ำ mute on Leaf Wash) and status pill at right, which is itself the toggle (กำลังทำ amber on Gold Wash with a dashed circle; เสร็จแล้ว green on Mint with a check). Then the title (16px, 600; muted when done), up to three lines of detail with อ่านต่อ, and a seam-ruled footer with tag and time meta, แก้ไข, a divider and the isolated delete. Editing replaces the card in place with the form inside a gold-ringed leaf spanning the row. Toggling status recolours the card without moving the grid.

### Inputs / Fields
- **Style:** white, 1px seam border, 8px corners, 8px by 12px padding, faint placeholder, Blue Ink caret.
- **Hover:** border darkens slightly.
- **Focus:** Blue Ink border plus a 3px 18% blue halo; no outline.
- **Error:** the error text appears below in Seal Red with role alert; inputs carry aria-invalid.
- **Search:** the same field with a 17px faint search icon inset 12px, 256px wide from 640px.

### Navigation (Rail)
- **Style:** Passbook Blue rail with the gold seal (concentric rings plus monogram), the wordmark สมุดงาน (Looped 700, 19px, Cover Paper) and today's Buddhist-era date beneath in Cover Mist. Nav items are 600 weight with 19px icons and a count pill.
- **Default:** Cover Paper text at 85%, icons in Cover Mist, count on Cover Night with Cover Mist text.
- **Hover:** Cover Lift fill, full Cover Paper text.
- **Active:** the item becomes a Ledger Grey tab opening into the page, text and icon turn Blue Ink, the count pill turns gold with ink text.
- **Mobile:** the rail is a top bar; the tabs run horizontally and open downward.
- A small note at the rail's foot, in Cover Mist, says where the data file lives.

### Date Stamp (signature)
Blue ink: Looped 700 inside a 2px Blue Ink frame (1.5px for the small size), 3px corners, tilted -2deg, with a mask that lightens the right edge like uneven rubber-stamp ink. It sits after every page title, at the head of every day group, on in-progress task rows and on the empty state (สมุดยังว่าง). When the date it shows changes (a new import is selected), it lands with the stamp thunk: from -9deg at 135% scale, overshooting to 96%, settling at -2deg, over 420ms.

### Ledger Table (signature)
- **Header band:** solid Passbook Blue, Cover Paper 600 labels, sticky at the top of the leaf. Sort buttons fill the header cell, hover to Cover Lift, and show a Cover Mist sort arrow at 80% that turns gold on the active column.
- **Rows:** 15px tabular body, 8px by 12px cells, soft-seam dividers, Leaf Wash on hover, a full seam line where a new brand group starts. Brand shows once per group in Blue Ink 600; quantity is 600; numbers align right; missing values are a faint dash. The condition column carries the มือ 1 / มือ 2 tags (see the Used-Phone Tint Rule).
- **Running balance:** the last column, ยอดสะสม, accumulates quantity down the table in mute 600.
- **Variance badge:** when a group has more than one price, a small +N badge (12px) in Gold Ink on Gold Wash precedes the price.
- **Expand:** a chevron reveals the original source lines in a white inset table on a Gold Wash row.
- **Total:** a 2px Blue Ink rule, then a Leaf Wash band with the count and the quantity in Blue Ink 700.
- **The print sweep:** rows from a fresh import (the first 24) are printed in: a 60% gold wash sweeps left to right across each cell over 520ms, each cell starting 40ms after its neighbour and each row 55ms after the one above, then the gold fades out over 2.2 seconds after a 900ms hold. A newly saved work card gets the same sweep as one block.

### Reconciliation Strip (signature)
One leaf divided by soft seams into four figure cells (มือ 1, มือ 2, รวม in Blue Ink, retail value in baht) and a verdict cell. The verdict is a green check with ยอดตรงกับไฟล์ต้นฉบับ and the lines read against lines in the file, or an amber warning with the number of skipped lines and a Blue Ink link to list them. Labels switch to "(ตามตัวกรอง)" when a filter is on. On the cards page the equivalent is a single ruled balance line (ค้าง · เสร็จวันนี้ · วันนี้ · 7 วัน) between two Page Seams in Page Mute, with ค้าง in Blue Ink; never tiles.

### Toasts
Passbook Blue, 10px corners, Cover Paper text, a gold icon (pale red for errors), rising 6px into place over 360ms at bottom right. Polite live region; errors use role alert.

### Print and Excel Export
The export carries the same book. Print (PDF) shows the title in Looped 700 Blue Ink, a totals line, the blue header band with white labels repeated on each page, Used-Phone Wash on มือ 2 rows, seam-ruled cells and a 2px Blue Ink rule above the grand total. Excel uses Tahoma: a 16pt bold blue title, a Ledger Grey totals row with the grand-total figure on gold, the blue header band with white bold labels, Used-Phone Wash on มือ 2 rows, seam borders, a grand total in 12pt bold blue with a medium blue rule above and a double rule below on Ledger Grey, gridlines off, the header frozen, a blue tab for the detail sheet and a gold tab for the per-model sheet, and a footer reading the app name and page count. The favicon and browser theme colour match: the gold seal on a blue tile, theme colour #005A9C.

### Named Rules
**The Ink Stamp Rule.** Every dated heading carries a Blue Ink stamp (Buddhist era, -2deg tilt, uneven ink); it lands with the stamp thunk when its date changes.

**The Header Band Rule.** Every ledger table header is a solid Passbook Blue band with light 600 labels, on screen, in print and in Excel; totals close with a 2px Blue Ink rule over a grey row.

**The Isolated Delete Rule.** Delete is an outline icon set apart by a seam divider; the first press becomes a solid ยืนยันลบ that holds focus, and blur reverts it. No modal.

**The Print Rule.** New entries arrive as a gold sweep left to right across the row, then the ink fades; state changes recolour rows in place without moving the grid.

**The No-Tiles Rule.** Summaries are one divided strip or one ruled line, never a row of separate KPI tiles.

## Do's and Don'ts

### Do:
- **Do** keep the 60/30/10 split: Ledger Grey page (#EAEFEF), Passbook Blue cover, header bands and selections (#005A9C), gold (#FFCC00) under 10%.
- **Do** use Passbook Blue (cover) for fills with Cover Paper text, and Blue Ink (cover-deep) for blue text and lines on light grounds, even while they share a value.
- **Do** reserve pure gold for the thing in hand: the active count, the selected import, the card being written, the sorted column, rows that just arrived; on blue, the seal, the active sort arrow, the toast icon and the rail focus ring.
- **Do** date every dated heading with a Blue Ink stamp, Buddhist era, tilted -2deg.
- **Do** set every table, list and meta figure at 15px with tabular numerals and build hierarchy with weight (600) and Blue Ink, not size.
- **Do** give every ledger table the solid blue header band and close totals with a 2px Blue Ink rule over a grey row, on screen, in print and in Excel.
- **Do** mark มือ 2 in blue everywhere: the solid badge on screen, the Used-Phone Wash row in print and Excel.
- **Do** make delete an outline icon set apart by a seam divider, confirmed in place by a solid red ยืนยันลบ that holds focus.
- **Do** announce new entries with the print sweep and recolour state changes in place without moving the grid.
- **Do** write every label in Thai, with Thai unit nouns on counts and Buddhist-era dates.
- **Do** put content on 10px Leaf White leaves with a 1px seam and the single leaf shadow.

### Don't:
- **Don't** build summaries as KPI tiles; use the divided strip or a ruled balance line.
- **Don't** use gold as a button fill, heading colour, background or decoration.
- **Don't** raise a number's size to make it important; the strip figures are the only 24px numerals.
- **Don't** add elevation levels or hover lifts to leaves; stand things out with a gold ring or blue fill.
- **Don't** confirm deletes with a modal, or place the delete button flush against edit without a divider.
- **Don't** set body text, data or form input in Noto Sans Thai Looped; it is for titles, heads and stamps.
- **Don't** write Gregorian dates or untranslated English labels in the UI.
- **Don't** extend Gold Wash to new persistent states; it belongs to rows and targets being acted on.
