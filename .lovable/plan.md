

# Re-implement PDF417 2D Barcode on Customer ID Cards

## Overview
The codebase was reverted. This plan re-applies the PDF417 barcode change using `bwip-js`.

## Changes

### 1. Ensure `bwip-js` is installed
- Verify it's in `package.json`; if not, add it.

### 2. Ensure `src/bwip-js.d.ts` type declaration exists
- If missing, recreate the module declaration for `bwip-js`.

### 3. Update `src/components/admin/CustomerIDCard.tsx`
- **Remove** `JsBarcode` import and the SVG-based barcode ref.
- **Add** `bwip-js` import and a canvas ref (`barcodeCanvasRef`) plus a `barcodeDataUrl` state.
- **Add** a `useEffect` that calls `bwipjs.toCanvas(canvas, { bcid: "pdf417", text: student.barcodeData, scale: 3, height: 8, columns: 5 })` and stores the result as a data URL.
- **UI**: Replace `<svg ref={barcodeRef} />` with `<img src={barcodeDataUrl} />` (approx 200px wide).
- **Print layout** (`handlePrint`):
  - Replace `barcodeSvg` (SVG outerHTML) with the `barcodeDataUrl` base64 image.
  - Use `<img src="${barcodeDataUrl}" style="width:55mm;max-height:12mm;" />` in the barcode section.
  - Keep `@page { size: 85.6mm 53.98mm; margin: 0; }` for card-sized printing.
- **PDF export** and **email** functions remain unchanged (they use `html2canvas` on the card div, which will capture the new barcode image automatically).

### Files to create/update
- `src/bwip-js.d.ts` (create if missing)
- `src/components/admin/CustomerIDCard.tsx` (update)
- `package.json` (add `bwip-js` if missing)
