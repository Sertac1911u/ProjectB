import type { Locale } from "@projectb/core";
import type messages from "../messages/tr.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
