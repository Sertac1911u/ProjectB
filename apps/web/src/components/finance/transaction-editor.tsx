import { isCurrencyCode } from "@projectb/core";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getAccounts, getCategories, getTags } from "@/lib/data/finance";
import { getRates } from "@/lib/data/rates";
import { type TransactionDefaults, TransactionForm } from "./transaction-form";

/** Loads the form's options; shared by the new and edit pages. */
export async function TransactionEditor({
  transactionId,
  recurringId,
  mode = "transaction",
  defaults,
}: {
  transactionId?: string;
  recurringId?: string;
  mode?: "transaction" | "recurring";
  defaults: Omit<TransactionDefaults, "accountId"> & {
    accountId?: string | null;
  };
}) {
  const [accounts, categories, tags, rateInfo, t, tAccounts] =
    await Promise.all([
      getAccounts(),
      getCategories(),
      getTags(),
      getRates(),
      getTranslations("Transactions"),
      getTranslations("Accounts"),
    ]);
  // Archived accounts stay selectable on transactions that already use them.
  const used = [defaults.accountId, defaults.toAccountId];
  const options = accounts
    .filter((a) => !a.archivedAt || used.includes(a.id))
    .map((a) => ({
      id: a.id,
      name: a.name,
      currency: isCurrencyCode(a.currency) ? a.currency : ("TRY" as const),
      type: a.type,
    }));

  if (options.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("needAccount")}
        </p>
        <Link href="/accounts/new" className={buttonVariants()}>
          <Plus />
          {tAccounts("addFirst")}
        </Link>
      </Card>
    );
  }

  // Without a chosen account, prefer one that is not the transfer target
  // (and not a credit card, when paying one off).
  const accountId =
    options.find((a) => a.id === defaults.accountId)?.id ??
    options.find(
      (a) => a.id !== defaults.toAccountId && a.type !== "credit_card",
    )?.id ??
    options.find((a) => a.id !== defaults.toAccountId)?.id ??
    options[0]!.id;
  return (
    <Card className="p-6">
      <TransactionForm
        transactionId={transactionId}
        recurringId={recurringId}
        mode={mode}
        defaults={{ ...defaults, accountId }}
        accounts={options}
        categories={categories}
        tags={tags.map((tag) => tag.name)}
        rates={rateInfo.rates}
      />
    </Card>
  );
}
