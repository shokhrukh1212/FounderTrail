"use client";

import { useId, useState } from "react";
import {
  PRICING_BASES,
  PRICING_BASIS_LABELS,
  PRICING_CURRENCIES,
  PRICING_MODELS,
  PRICING_MODEL_LABELS,
  pricingFormValues,
  publicPricingLabel,
  type ProductPricing,
} from "@/lib/product-pricing";

/**
 * The listed startup's own pricing, entered by a person. Everything is optional: leaving
 * the model blank shows no pricing at all on the public page, and clearing a saved model
 * removes the public row without touching the listing.
 *
 * An amount is only offered for Freemium and Paid, because "from 9" makes no sense next
 * to Free or Contact sales, and supplying one is what makes the currency and the billing
 * basis required.
 */
export function PricingFields({ pricing, openSource = false, showOpenSource = true }: {
  pricing: ProductPricing;
  openSource?: boolean;
  showOpenSource?: boolean;
}) {
  const id = useId();
  const initial = pricingFormValues(pricing);
  const [model, setModel] = useState(initial.pricingModel);
  const [amount, setAmount] = useState(initial.startingPrice);
  const [currency, setCurrency] = useState(initial.pricingCurrency);
  const [basis, setBasis] = useState(initial.pricingBasis);
  const [unit, setUnit] = useState(initial.pricingUnit);
  const [perSeat, setPerSeat] = useState(initial.pricingPerSeat);
  const amountAllowed = model === "freemium" || model === "paid";
  const preview = publicPricingLabel({
    model: (model || null) as ProductPricing["model"],
    startingPriceMinor: amountAllowed && amount ? Math.round(Number(amount) * 100) : null,
    currency,
    basis: (basis || null) as ProductPricing["basis"],
    unit,
    perSeat,
  });

  return <div className="pricing-fields">
    <div className="form-grid">
      <div className="form-field">
        <label htmlFor={`${id}-model`}>Product pricing <small>Optional</small></label>
        <select id={`${id}-model`} name="pricingModel" value={model} onChange={(event) => setModel(event.target.value)}>
          <option value="">Not listed</option>
          {PRICING_MODELS.map((value) => <option key={value} value={value}>{PRICING_MODEL_LABELS[value]}</option>)}
        </select>
        <small className="field-help">This is your product&apos;s price, not FounderTrail&apos;s. Leave it as Not listed to show no pricing.</small>
      </div>
      <div className="form-field">
        <label htmlFor={`${id}-amount`}>Starting amount <small>Optional</small></label>
        <div className="price-entry">
          <select name="pricingCurrency" aria-label="Currency" value={currency} disabled={!amountAllowed} onChange={(event) => setCurrency(event.target.value)}>
            {PRICING_CURRENCIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <input
            id={`${id}-amount`}
            name="startingPrice"
            inputMode="decimal"
            maxLength={12}
            placeholder="9"
            value={amountAllowed ? amount : ""}
            disabled={!amountAllowed}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <small className="field-help">{amountAllowed ? "Where your paid plans start. Leave blank to show the model only." : "Available for Freemium and Paid."}</small>
      </div>
    </div>
    {amountAllowed && amount ? <div className="form-grid">
      <div className="form-field">
        <label htmlFor={`${id}-basis`}>Billed</label>
        <select id={`${id}-basis`} name="pricingBasis" value={basis} onChange={(event) => setBasis(event.target.value)}>
          <option value="">Choose how it is billed</option>
          {PRICING_BASES.map((value) => <option key={value} value={value}>{PRICING_BASIS_LABELS[value]}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={`${id}-unit`}>Billed unit {basis === "usage_based" ? null : <small>Usage-based only</small>}</label>
        <input
          id={`${id}-unit`}
          name="pricingUnit"
          maxLength={60}
          placeholder="per 1,000 credits"
          value={basis === "usage_based" ? unit : ""}
          disabled={basis !== "usage_based"}
          onChange={(event) => setUnit(event.target.value)}
        />
      </div>
    </div> : null}
    {amountAllowed && amount ? <label className="consent-row">
      <input type="checkbox" name="pricingPerSeat" checked={perSeat} onChange={(event) => setPerSeat(event.target.checked)} />
      <span>This amount is per seat.</span>
    </label> : null}
    {showOpenSource ? <label className="consent-row">
      <input type="checkbox" name="isOpenSource" defaultChecked={openSource} />
      <span>This product is open source. Open source is recorded separately from pricing, because open-source products can still charge for hosting or services.</span>
    </label> : null}
    <p className="form-hint" aria-live="polite">Public pricing row: {preview ? <strong>{preview}</strong> : "not shown"}</p>
  </div>;
}
