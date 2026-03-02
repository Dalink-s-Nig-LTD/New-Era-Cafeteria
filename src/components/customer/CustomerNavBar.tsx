import { ShoppingBag, Wallet, History } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustomerTab = "menu" | "wallet" | "history";

interface CustomerNavBarProps {
  activeTab: CustomerTab;
  onTabChange: (tab: CustomerTab) => void;
}

const tabs: { id: CustomerTab; label: string; icon: React.ElementType }[] = [
  { id: "menu", label: "Menu", icon: ShoppingBag },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "history", label: "History", icon: History },
];

export function CustomerNavBar({ activeTab, onTabChange }: CustomerNavBarProps) {
  return (
    <nav className="flex items-center gap-1">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
