import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BilingualLabel } from "@/components/ui/bilingual-label";
import { MILK_QUALITY_OPTIONS, MILK_REJECTION_REASONS, type MilkQuality } from "@/constants/milkQuality";
import { hapticSelection } from "@/lib/haptics";
import { ShieldCheck, ShieldX } from "lucide-react";

interface MilkQualityFieldsProps {
  milkQuality: MilkQuality;
  rejectionReason: string;
  onQualityChange: (value: MilkQuality) => void;
  onRejectionReasonChange: (value: string) => void;
}

export function MilkQualityFields({
  milkQuality,
  rejectionReason,
  onQualityChange,
  onRejectionReasonChange,
}: MilkQualityFieldsProps) {
  const handleQualityChange = (value: string) => {
    hapticSelection();
    onQualityChange(value as MilkQuality);
    if (value === 'good') {
      onRejectionReasonChange('');
    }
  };

  const handleReasonChange = (value: string) => {
    hapticSelection();
    onRejectionReasonChange(value === 'none' ? '' : value);
  };

  return (
    <>
      <div className="space-y-2">
        <BilingualLabel english="Quality Status" filipino="Kalidad ng Gatas" />
        <Select value={milkQuality} onValueChange={handleQualityChange}>
          <SelectTrigger className="min-h-[48px]">
            <SelectValue placeholder="Select quality" />
          </SelectTrigger>
          <SelectContent>
            {MILK_QUALITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.value === 'good' ? (
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <ShieldX className="h-4 w-4 text-destructive" />
                  )}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {milkQuality === 'rejected' && (
        <div className="space-y-2">
          <BilingualLabel english="Rejection Reason" filipino="Dahilan ng Pagtanggi" required />
          <Select value={rejectionReason || 'none'} onValueChange={handleReasonChange}>
            <SelectTrigger className="min-h-[48px]">
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              {MILK_REJECTION_REASONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
