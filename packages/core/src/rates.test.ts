import { describe, expect, it } from "vitest";
import { convert, parseTcmbBulletin, sumIn } from "./rates";

// Shape of https://www.tcmb.gov.tr/kurlar/today.xml (trimmed).
const BULLETIN = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>
<Tarih_Date Tarih="16.10.2026" Date="10/16/2026"  Bulten_No="2026/197" >
	<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
			<Unit>1</Unit>
			<Isim>ABD DOLARI</Isim>
			<CurrencyName>US DOLLAR</CurrencyName>
			<ForexBuying>41.8723</ForexBuying>
			<ForexSelling>41.9478</ForexSelling>
			<BanknoteBuying>41.8430</BanknoteBuying>
			<BanknoteSelling>42.0107</BanknoteSelling>
			<CrossRateUSD/>
			<CrossRateOther/>
	</Currency>
	<Currency CrossOrder="9" Kod="JPY" CurrencyCode="JPY">
			<Unit>100</Unit>
			<ForexBuying>27.7821</ForexBuying>
	</Currency>
	<Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR">
			<Unit>1</Unit>
			<ForexBuying>48.6610</ForexBuying>
	</Currency>
	<Currency CrossOrder="3" Kod="GBP" CurrencyCode="GBP">
			<Unit>1</Unit>
			<ForexBuying>56.0012</ForexBuying>
	</Currency>
	<Currency CrossOrder="27" Kod="XDR" CurrencyCode="XDR">
			<Unit>1</Unit>
			<ForexBuying></ForexBuying>
	</Currency>
</Tarih_Date>`;

describe("parseTcmbBulletin", () => {
  it("reads the date and the forex buying rates of supported currencies", () => {
    expect(parseTcmbBulletin(BULLETIN)).toEqual({
      date: "2026-10-16",
      rates: { TRY: 1, USD: 41.8723, EUR: 48.661, GBP: 56.0012 },
    });
  });

  it("rejects anything that is not a bulletin", () => {
    expect(parseTcmbBulletin("<html>Bakım çalışması</html>")).toBeNull();
  });
});

describe("convert", () => {
  const rates = { TRY: 1, USD: 40, EUR: 50 };

  it("converts through lira and rounds to minor units", () => {
    expect(convert(10_000, "USD", "TRY", rates)).toBe(400_000);
    expect(convert(400_000, "TRY", "USD", rates)).toBe(10_000);
    expect(convert(10_000, "EUR", "USD", rates)).toBe(12_500);
    expect(convert(1, "TRY", "USD", rates)).toBe(0);
    expect(convert(-10_000, "USD", "TRY", rates)).toBe(-400_000);
  });

  it("returns null without a rate", () => {
    expect(convert(100, "GBP", "TRY", rates)).toBeNull();
    expect(convert(100, "GBP", "GBP", {})).toBe(100);
  });

  it("sums mixed currencies", () => {
    expect(
      sumIn(
        [
          { amount: 100_000, currency: "TRY" },
          { amount: 10_000, currency: "USD" },
        ],
        "TRY",
        rates,
      ),
    ).toEqual({ total: 500_000, missing: [] });
    expect(
      sumIn(
        [
          { amount: 100, currency: "TRY" },
          { amount: 1, currency: "GBP" },
        ],
        "TRY",
        rates,
      ),
    ).toEqual({ total: 100, missing: ["GBP"] });
  });
});
