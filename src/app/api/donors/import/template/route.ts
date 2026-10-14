import { excelResponse } from "@/lib/xlsx-export";
import { DONOR_COLUMNS } from "@/lib/donors-import";

export async function GET() {
  return excelResponse(
    "Donors",
    [...DONOR_COLUMNS],
    [
      ["Ahmed Mahmoud", "01001234567", "ahmed@example.com", "Nasr City, Cairo", 500, "Family"],
      ["Mona Ali", "01112345678", "", "Alexandria", 300, "Close friend"],
    ],
    [24, 16, 26, 24, 16, 16],
  );
}
