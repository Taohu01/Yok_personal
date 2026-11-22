# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- Frontend: React + Tailwind CSS (HTML/CSS/JS), Vite dev server.
- Backend: Node.js (JavaScript) + Express.
- Database: SQLite via Node's built-in `node:sqlite` (single `data.db` file in the project; user chose it for zero install and easy backup).
- Runs on localhost only.

## Users

One person: the owner of a multi-branch mobile phone retail business in Thailand (branches named in the stock report header, such as บ้านท่อ, ขนส่งอุดร, ภูเก็ต, โคราช). They do back-office work at a desk: tracking their own tasks and turning the point-of-sale stock export into a clean stock summary.

## Product Purpose

A personal work helper with two jobs:

1. **Work cards**: log what has been done and what is in progress. Each card has a title, details, date, status (กำลังทำ / เสร็จแล้ว), category or tags (e.g. a branch name, สต๊อก), time spent, and priority (สูง / กลาง / ต่ำ).
2. **Stock import and export**: import the stock report (Excel, CSV or PDF) in the format of "ทุกสาขามีราคาส่ง ปลีก ทุน", show the data, and export a summary laid out like "สต๊อกสินค้าออฟฟิศ" with brand, model, capacity, new or used (มือ 1 / มือ 2), color, quantity, retail price and wholesale price. Export formats: .xlsx, CSV and PDF.

Success: the summary the user used to build by hand comes out of one import and one export click, with totals that match the source file.

## Operating Context

- Source report: "รายงานสต็อกสินค้า (รวมตามรหัสสินค้า)", columns ยี่ห้อ, รุ่น, ความจุ, ประเภทสินค้า, ประเภทสต๊อก (เครื่องใหม่ / มือสอง), รหัสสินค้า, สี, Supplier, จำนวน, ราคาทุน, ราคาขาย, ราคาส่ง. Continuation rows leave ยี่ห้อ to รหัสสินค้า blank and inherit them from the row above. Numbers use thousands separators inside quotes. Wholesale is often blank for used phones.
- Target summary: a title with the date, a header block of totals (มือ 1 ทั้งหมด, มือ 2 ทั้งหมด, รวมทั้งหมด), rows grouped by brand and model with counts for มือ 1, มือ 2 and the total, a grand total row and a note line.
- Dates are written in the Thai Buddhist calendar (e.g. 21.11.69).
- All UI text is in Thai.

## Capabilities and Constraints

- Single user, no login. Security is explicitly not a priority.
- Cost price (ราคาทุน) is imported and visible, but is not part of the export the user asked for.
- PDF import works only for PDFs that contain real text (not scanned images).

## Brand Commitments

- Colour rule pinned by the user: 60/30/10 with #EAEFEF (60), #005A9C (30; burgundy #56021F, then sage #86A788, replaced on 2026-11-22) and #FFCC00 (10).

## Product Principles

1. The numbers must reconcile: totals shown on screen equal totals in the export and in the source.
2. Fast for daily desk work: import, check and export in under a minute.
3. Thai first: labels, dates and number formatting follow Thai business habits.
