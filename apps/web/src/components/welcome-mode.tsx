import { type Locale, UI_MODES } from "@projectb/core";
import { LayoutList, Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { chooseUiMode } from "@/lib/actions/profile";

const ICONS = { simple: Sparkles, detailed: LayoutList };

/** Asked once: whether to show the simple or the detailed interface. */
export async function WelcomeMode() {
  const [locale, t] = await Promise.all([
    getLocale() as Promise<Locale>,
    getTranslations("Welcome"),
  ]);
  return (
    <Card className="mb-6 flex flex-col gap-4 border-primary/40 p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {UI_MODES.map((mode) => {
          const Icon = ICONS[mode];
          return (
            <form
              key={mode}
              action={chooseUiMode.bind(null, locale, mode)}
              className="flex flex-col gap-3 rounded-lg border p-4"
            >
              <p className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-primary" />
                {t(mode)}
              </p>
              <p className="flex-1 text-sm text-muted-foreground">
                {t(`${mode}Text`)}
              </p>
              <SubmitButton
                variant={mode === "simple" ? "default" : "outline"}
                aria-label={`${t(mode)}: ${t("choose")}`}
              >
                {t("choose")}
              </SubmitButton>
            </form>
          );
        })}
      </div>
    </Card>
  );
}
