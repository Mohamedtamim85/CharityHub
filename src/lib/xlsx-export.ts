import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export type ExcelCell = string | number | Date | null | undefined;

export async function excelResponse(
  filenamePrefix: string,
  headers: string[],
  rows: ExcelCell[][],
  columnWidths?: number[],
): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  if (columnWidths) {
    sheet.columns = columnWidths.map((width) => ({ width }));
  }
  for (const row of rows) {
    sheet.addRow(row.map((cell) => cell ?? ""));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CharityHub-${filenamePrefix}-${today}.xlsx"`,
    },
  });
}
