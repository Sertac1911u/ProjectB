import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthCard({ title, description, footer, children }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card className="p-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </Card>
      {footer && (
        <p className="text-center text-sm text-muted-foreground">{footer}</p>
      )}
    </div>
  );
}
