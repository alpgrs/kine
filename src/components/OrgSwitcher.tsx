import { Check, Plus, Building2, ChevronsUpDown } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrg } from "@/providers/OrgProvider";

export function OrgSwitcher() {
  const { orgs, activeOrg, setActiveOrgId } = useOrg();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!orgs.length) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => void navigate({ to: "/onboarding" })}
        className="w-full justify-start"
      >
        <Plus className="mr-2 h-4 w-4" />
        {t("createOrg")}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{activeOrg?.name ?? "—"}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>{t("switchOrg")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => setActiveOrgId(o.id)}>
            <span className="mr-2 inline-block w-4">
              {activeOrg?.id === o.id && <Check className="h-3 w-3" />}
            </span>
            <span className="truncate">{o.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{o.role}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void navigate({ to: "/onboarding" })}>
          <Plus className="mr-2 h-4 w-4" /> {t("createOrg")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
