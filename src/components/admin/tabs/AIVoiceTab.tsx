import { DocAgaManagement } from "../DocAgaManagement";
import { DataCategory } from "@/types/government";

interface AIVoiceTabProps {
  dataCategory?: DataCategory;
}

export const AIVoiceTab = ({ dataCategory = 'all' }: AIVoiceTabProps) => {
  return <DocAgaManagement dataCategory={dataCategory} />;
};
