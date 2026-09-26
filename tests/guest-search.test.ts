import { describe, expect, it } from "vitest";
import { phoneDigits, searchGuests } from "@/lib/guest-search";

const GUESTS = [
  { id: "ana", name: "Ana Reyes", email: "ana.reyes@gmail.com", phone: "+63 917 555 0141" },
  { id: "anabel", name: "Anabel Cruz", email: "anabel@yahoo.com", phone: null },
  { id: "jose", name: "José Santos", email: null, phone: "0945-555-0156" },
  { id: "maria", name: "Maria Santos", email: "maria@example.com", phone: "09171234567" },
];
const ids = (query: string) => searchGuests(GUESTS, query).map((guest) => guest.id);

describe("searchGuests", () => {
  it("matches nobody for an empty query", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   ")).toEqual([]);
  });

  it("matches names by word prefix, ignoring case and accents", () => {
    expect(ids("ana")).toEqual(["ana", "anabel"]);
    expect(ids("jose")).toEqual(["jose"]);
    expect(ids("SANTOS")).toEqual(["jose", "maria"]);
  });

  it("requires every word to match", () => {
    expect(ids("maria santos")).toEqual(["maria"]);
    expect(ids("ana gmail")).toEqual(["ana"]);
    expect(ids("ana nobody")).toEqual([]);
  });

  it("matches emails", () => {
    expect(ids("yahoo")).toEqual(["anabel"]);
  });

  it("matches phones in any Philippine format", () => {
    expect(phoneDigits("+63 917 555 0141")).toBe("9175550141");
    expect(phoneDigits("0917-555-0141")).toBe("9175550141");
    expect(ids("0917 555")).toEqual(["ana"]);
    expect(ids("+639171234567")).toEqual(["maria"]);
    expect(ids("5550156")).toEqual(["jose"]);
  });

  it("tolerates skipped letters in names", () => {
    expect(ids("mria")).toEqual(["maria"]);
  });

  it("caps the number of results", () => {
    expect(searchGuests(GUESTS, "a", 2)).toHaveLength(2);
  });
});
