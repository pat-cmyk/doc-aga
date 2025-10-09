import { Badge } from "@/components/ui/badge";

interface RoleBadgeProps {
  role: "owner" | "manager" | "farmhand";
}

export const RoleBadge = ({ role }: RoleBadgeProps) => {
  const variants = {
    owner: { label: "Farm Owner", variant: "default" as const },
    manager: { label: "Farm Manager", variant: "secondary" as const },
    farmhand: { label: "Farmhand", variant: "outline" as const }
  };

  const { label, variant } = variants[role];

  return (
    <Badge variant={variant} className="ml-2">
      {label}
    </Badge>
  );
};
