import { defineMcp } from "@lovable.dev/mcp-js";
import listRentals from "./tools/list-rentals";
import createRental from "./tools/create-rental";
import updateRental from "./tools/update-rental";
import listDiaryNotes from "./tools/list-diary-notes";
import createDiaryNote from "./tools/create-diary-note";
import businessSummary from "./tools/business-summary";

export default defineMcp({
  name: "mbs-centring-hub",
  title: "MBS Centring Hub",
  version: "0.1.0",
  instructions:
    "Tools for M.B.S CENTRING WORKS, Nereducherla. Use `list_rentals` and `business_summary` to read rental records, overdue items and revenue; `create_rental` and `update_rental` to record or close out rentals; `list_diary_notes` and `create_diary_note` for daily diary entries (labour, expense, payment, reminder). Dates are YYYY-MM-DD and amounts are in INR.",
  tools: [listRentals, createRental, updateRental, listDiaryNotes, createDiaryNote, businessSummary],
});
