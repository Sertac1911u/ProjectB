import { isUiMode, type UiMode } from "@projectb/core";

/**
 * The interface a user sees. Until they choose, people who used the app
 * before modes existed keep the full interface.
 */
export function uiModeOf(profile: { uiMode: string | null }): UiMode {
  return isUiMode(profile.uiMode) ? profile.uiMode : "detailed";
}
