import { useState } from "react";
import { Stethoscope, MessageSquare } from "lucide-react";
import { ActionFab, QuickAction } from "@/components/ui/action-fab";
import DocAgaConsultation from "@/components/farmhand/DocAgaConsultation";
import { useNavigate } from "react-router-dom";

const governmentActions: QuickAction[] = [
  { 
    id: 'doc-aga', 
    label: 'Ask Doc Aga', 
    icon: Stethoscope, 
    color: 'text-primary',
    isPrimary: true,
    description: 'Policy insights & analytics help'
  },
  { 
    id: 'feedback', 
    label: 'View Feedback', 
    icon: MessageSquare, 
    color: 'text-green-500',
    description: 'Farmer submissions'
  },
];

export function GovernmentFab() {
  const [showDocAga, setShowDocAga] = useState(false);
  const navigate = useNavigate();

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'doc-aga':
        setShowDocAga(true);
        break;
      case 'feedback':
        navigate('/government#farmer-voice');
        break;
    }
  };

  return (
    <>
      <ActionFab
        actions={governmentActions}
        onAction={handleAction}
        mainIcon={Stethoscope}
        mainLabel="Government Actions"
      />

      {showDocAga && (
        <div className="fixed inset-0 z-50 bg-background">
          <DocAgaConsultation
            initialQuery=""
            onClose={() => setShowDocAga(false)}
            farmId=""
          />
        </div>
      )}
    </>
  );
}
