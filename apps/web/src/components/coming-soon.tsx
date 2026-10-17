import { Hammer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

type Props = {
  section:
    "accounts" | "transactions" | "budgets" | "goals" | "reports" | "settings";
  phase: number;
};

export async function ComingSoon({ section, phase }: Props) {
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("Placeholder");

  return (
    <>
      <PageHeader title={tNav(section)} />
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Hammer className="size-5" />
        </span>
        <p className="font-medium">
          {tCommon("comingSoon")} · {tCommon("phase", { phase })}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("description", { phase })}
        </p>
      </Card>
    </>
  );
}
