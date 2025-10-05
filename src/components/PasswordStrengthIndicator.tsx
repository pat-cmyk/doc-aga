import { CheckCircle2, Circle } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metRequirements = Object.values(checks).filter(Boolean).length;
  const totalRequirements = Object.values(checks).length;

  const getStrength = () => {
    if (metRequirements <= 2) return { label: "Weak", color: "text-destructive" };
    if (metRequirements <= 4) return { label: "Fair", color: "text-yellow-500" };
    return { label: "Strong", color: "text-green-500" };
  };

  const strength = getStrength();

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium">Password Strength:</div>
        <div className={`text-sm font-semibold ${strength.color}`}>{strength.label}</div>
      </div>
      
      <div className="space-y-1 text-xs">
        <RequirementItem checked={checks.length} text="At least 8 characters" />
        <RequirementItem checked={checks.uppercase} text="One uppercase letter (A-Z)" />
        <RequirementItem checked={checks.lowercase} text="One lowercase letter (a-z)" />
        <RequirementItem checked={checks.number} text="One number (0-9)" />
        <RequirementItem checked={checks.symbol} text="One symbol (!@#$%^&*)" />
      </div>
    </div>
  );
};

const RequirementItem = ({ checked, text }: { checked: boolean; text: string }) => (
  <div className="flex items-center gap-2">
    {checked ? (
      <CheckCircle2 className="h-3 w-3 text-green-500" />
    ) : (
      <Circle className="h-3 w-3 text-muted-foreground" />
    )}
    <span className={checked ? "text-green-600" : "text-muted-foreground"}>{text}</span>
  </div>
);

export default PasswordStrengthIndicator;
