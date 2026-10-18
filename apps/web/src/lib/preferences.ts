/**
 * Per-device display preferences, kept in localStorage and mirrored on the
 * root element as data attributes so CSS can apply them before React loads.
 */
export type Preference = "sidebar" | "theme";

const KEY = { sidebar: "projectb.sidebar", theme: "projectb.theme" } as const;

/** `null` clears it back to the default. */
export function writePreference(name: Preference, value: string | null) {
  const root = document.documentElement;
  if (value === null) delete root.dataset[name];
  else root.dataset[name] = value;
  try {
    if (value === null) localStorage.removeItem(KEY[name]);
    else localStorage.setItem(KEY[name], value);
  } catch {
    // Private windows may refuse storage; the choice still applies now.
  }
  window.dispatchEvent(new Event(EVENT));
}

const EVENT = "projectb:preference";

/** For useSyncExternalStore: the value on the root element, live. */
export function subscribePreferences(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function currentPreference(name: Preference): string | null {
  return document.documentElement.dataset[name] ?? null;
}

/** Runs in the document head, before the first paint. */
export const preferenceScript = `try{var d=document.documentElement;${(
  Object.keys(KEY) as Preference[]
)
  .map(
    (name) =>
      `var ${name}=localStorage.getItem(${JSON.stringify(KEY[name])});if(${name})d.dataset.${name}=${name};`,
  )
  .join("")}}catch(e){}`;
