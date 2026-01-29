import { ReactNode } from "react";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";

interface GovernmentLayoutProps {
  children: ReactNode;
}

export const GovernmentLayout = ({ children }: GovernmentLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card pt-safe">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🇵🇭</div>
            <div>
              <h1 className="text-2xl font-bold">Government Dashboard</h1>
              <p className="text-sm text-muted-foreground">Livestock industry insights for policy and program planning</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NetworkStatusIndicator />
            <UserEmailDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
};
