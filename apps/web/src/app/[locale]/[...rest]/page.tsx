import { notFound } from "next/navigation";

// Routes unknown paths inside a locale to the localized not-found page.
export default function CatchAll() {
  notFound();
}
