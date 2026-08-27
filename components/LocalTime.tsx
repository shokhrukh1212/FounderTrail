"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function LocalTime({ value, dateOnly = false }: { value: string; dateOnly?: boolean }) {
  const serverLabel = new Date(value).toISOString().slice(0, dateOnly ? 10 : 16).replace("T", " ");
  const label = useSyncExternalStore(subscribe, () => {
    const date = new Date(value);
    return dateOnly
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }, () => serverLabel);
  return <time dateTime={value}>{label}</time>;
}
