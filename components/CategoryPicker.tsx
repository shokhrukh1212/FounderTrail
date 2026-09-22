"use client";

import { useId, useMemo, useState } from "react";
import {
  FOUNDERTRAIL_CATEGORIES,
  MAX_PRODUCT_CATEGORIES,
  OTHER_CATEGORY_SLUG,
  categoryName,
  toggleCategorySelection,
} from "@/lib/categories";

/**
 * The one category control, used by submission, founder editing, moderation and admin
 * editing. It posts a single comma-separated hidden field so it drops into a plain form
 * post and into a JSON PATCH built from FormData without either side special-casing it.
 *
 * Other is exclusive on purpose: it means "none of these fit", so choosing it clears the
 * rest and choosing anything specific clears Other.
 */
export function CategoryPicker({
  name = "categories",
  initial = [],
  describedBy,
  invalid = false,
}: {
  name?: string;
  initial?: readonly string[];
  describedBy?: string;
  invalid?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState<string[]>(() => [...initial]);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const options = useMemo(() => FOUNDERTRAIL_CATEGORIES.filter((category) =>
    !query || category.name.toLowerCase().includes(query) || category.scope.toLowerCase().includes(query)), [query]);
  const full = selected.length >= MAX_PRODUCT_CATEGORIES;

  function toggle(slug: string) {
    setSelected((current) => toggleCategorySelection(current, slug));
  }

  return <div className="category-picker">
    <input type="hidden" name={name} value={selected.join(",")} />
    <div className="category-picker-head">
      <label htmlFor={`${id}-search`}>Categories</label>
      <span className="category-count" aria-live="polite">{selected.length} of {MAX_PRODUCT_CATEGORIES} selected</span>
    </div>
    {selected.length ? <ul className="category-chips">{selected.map((slug) => <li key={slug}>
      <span>{categoryName(slug) ?? slug}</span>
      <button type="button" aria-label={`Remove ${categoryName(slug) ?? slug}`} onClick={() => toggle(slug)}>×</button>
    </li>)}</ul> : null}
    <input
      id={`${id}-search`}
      type="search"
      className="category-search"
      value={search}
      autoComplete="off"
      placeholder="Search categories, e.g. analytics"
      aria-describedby={[`${id}-hint`, describedBy].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      onChange={(event) => setSearch(event.target.value)}
    />
    <p id={`${id}-hint`} className="field-help">
      Choose up to {MAX_PRODUCT_CATEGORIES} categories that describe what your product does.
      {" "}Selecting Other clears the rest.
    </p>
    <ul className="category-options">
      {options.map((category) => {
        const isSelected = selected.includes(category.slug);
        const blocked = !isSelected && full && category.slug !== OTHER_CATEGORY_SLUG;
        return <li key={category.slug}>
          <button
            type="button"
            className={isSelected ? "is-selected" : ""}
            aria-pressed={isSelected}
            disabled={blocked}
            title={blocked ? `Remove one of your ${MAX_PRODUCT_CATEGORIES} categories first.` : category.scope}
            onClick={() => toggle(category.slug)}
          >
            <strong>{category.name}</strong>
            <small>{category.scope}</small>
          </button>
        </li>;
      })}
      {options.length ? null : <li className="category-empty">No category matches “{search.trim()}”.</li>}
    </ul>
  </div>;
}
