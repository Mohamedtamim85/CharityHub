import ExcelJS from "exceljs";

/** Columns of the donor import template. */
export const DONOR_COLUMNS = ["Name", "Mobile", "Email", "Location", "Monthly amount", "Relation"] as const;

export type ParsedDonor = {
  name: string;
  mobile: string | null;
  email: string | null;
  location: string | null;
  monthlyAmount: number | null;
  relation: "FAMILY" | "CLOSE_FRIEND" | null;
};

function cellText(row: ExcelJS.Row, col: number): string | null {
  if (col === -1) return null;
  let v: unknown = row.getCell(col).value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) v = v.result;
    else if ("text" in v) v = v.text;
    else if ("richText" in v) v = (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  }
  const text = String(v ?? "").trim();
  return text === "" ? null : text.replace(/^mailto:/i, "");
}

/** "family", "أهل", "close friend", "صديق" ... -> the relation, or null when blank/unknown. */
export function parseRelation(text: string | null): ParsedDonor["relation"] | "INVALID" {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  if (["family", "relative", "أهل", "عائلة", "قريب"].some((w) => t.includes(w))) return "FAMILY";
  if (["friend", "close friend", "صديق", "صاحب"].some((w) => t.includes(w))) return "CLOSE_FRIEND";
  return "INVALID";
}

/** Reads the first sheet; needs a "Name" column. Rows with a relation other than family / close friend are skipped. */
export async function parseDonorsSheet(buffer: Buffer): Promise<{ rows: ParsedDonor[]; skipped: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("No worksheet found in file");
  const headers = (sheet.getRow(1).values as unknown[]).map((h) => String(h ?? "").trim().toLowerCase());
  const find = (...names: string[]) => names.map((n) => headers.indexOf(n)).find((i) => i !== -1) ?? -1;
  const col = {
    name: find("name", "full name", "donor", "contact name"),
    mobile: find("mobile", "phone", "whatsapp", "mobile number", "phone number"),
    email: find("email", "e-mail"),
    location: find("location", "city", "address", "area"),
    monthly: find("monthly amount", "monthly donation", "monthly", "amount"),
    relation: find("relation", "relationship"),
  };
  if (col.name === -1) throw new Error('Could not find a "Name" column in the first row of the sheet.');

  const rows: ParsedDonor[] = [];
  const skipped: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const name = cellText(row, col.name);
    if (!name) {
      skipped.push(`Row ${n}: missing name`);
      return;
    }
    const relation = parseRelation(cellText(row, col.relation));
    if (relation === "INVALID") {
      skipped.push(`Row ${n}: ${name} — relation must be Family or Close friend`);
      return;
    }
    const monthlyText = cellText(row, col.monthly);
    const monthly = monthlyText ? Number(monthlyText.replace(/[^\d.]/g, "")) : NaN;
    rows.push({
      name,
      mobile: cellText(row, col.mobile),
      email: cellText(row, col.email),
      location: cellText(row, col.location),
      monthlyAmount: Number.isFinite(monthly) && monthly > 0 ? monthly : null,
      relation,
    });
  });
  return { rows, skipped };
}
