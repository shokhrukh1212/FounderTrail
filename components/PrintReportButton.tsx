"use client";

export function PrintReportButton() {
  return <button type="button" className="button button-primary print-hide" onClick={() => window.print()}>Print / save PDF</button>;
}
