module.exports = `
  @page { size: A4; margin: 10mm 9mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #000; margin: 0; }
  .doc-title { text-align: center; font-size: 17px; font-weight: bold; margin: 0 0 6px; letter-spacing: 0.5px; }
  table.frame { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.frame > tbody > tr > td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  .label { font-size: 9.5px; }
  .bold { font-weight: bold; }
  .big { font-size: 12px; font-weight: bold; }
  .center { text-align: center; }
  .right { text-align: right; }
  .nowrap { white-space: nowrap; }
  .goods-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .goods-table td, .goods-table th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; font-size: 10.5px; }
  .goods-table th { font-weight: bold; text-align: left; }
  .item-block { margin-bottom: 10px; }
  .item-title { font-weight: bold; }
  .terms-box p { margin: 0 0 2px; }
  .page-break { page-break-before: always; }
  .goods-rows-fill { min-height: 560px; }
  .annexure-table { width: 100%; border-collapse: collapse; }
  .annexure-table th, .annexure-table td { border: 1px solid #000; padding: 4px 5px; font-size: 9.5px; text-align: center; }
  .annexure-title { text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 10px; }
`;
