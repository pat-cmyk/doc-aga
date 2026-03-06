 import { useState } from "react";
import { Landmark, MessageSquare, FileText, X } from "lucide-react";
import { ActionFab, QuickAction } from "@/components/ui/action-fab";
import RicoChat from "@/components/government/RicoChat";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { exportManualPDF } from "@/lib/exportUtils";

const governmentActions: QuickAction[] = [
  { 
    id: 'rico', 
    label: 'Ask RICO', 
    icon: Landmark, 
    color: 'text-blue-600',
    isPrimary: true,
    description: 'Audit & compliance analysis'
  },
  {
    id: 'feedback',
    label: 'View Feedback',
    icon: MessageSquare,
    color: 'text-green-500',
    description: 'Farmer submissions'
  },
  {
    id: 'manual',
    label: 'Download Manual',
    icon: FileText,
    color: 'text-purple-500',
    description: 'Dashboard user guide (PDF)'
  },
];

export function GovernmentFab() {
  const [showRico, setShowRico] = useState(false);
  const navigate = useNavigate();

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'rico':
        setShowRico(true);
        break;
      case 'feedback':
        navigate('/government#farmer-voice');
        break;
      case 'manual':
        exportManualPDF();
        break;
    }
  };

  return (
    <>
      <ActionFab
        actions={governmentActions}
        onAction={handleAction}
        mainIcon={Landmark}
        mainLabel="RICO Intelligence"
        mainButtonClassName="bg-blue-600 hover:bg-blue-700"
      />

      {showRico && (
         <>
           {/* Semi-transparent backdrop - click to close (desktop only) */}
           <div
             className="hidden sm:block fixed inset-0 bg-background/20 backdrop-blur-[2px] z-40"
             onClick={() => setShowRico(false)}
           />
           
           {/* Floating Panel - full screen on mobile, floating on desktop */}
           <Card
             className="fixed z-50 flex flex-col shadow-2xl border-2 border-blue-600/20
               inset-0 rounded-none 
               sm:inset-auto sm:bottom-24 sm:right-4 sm:w-[420px] sm:h-[550px] sm:rounded-lg 
               lg:w-[450px] lg:h-[600px]"
           >
             {/* Header with close button */}
             <div className="flex items-center justify-between border-b p-3 bg-blue-600 text-white rounded-t-none sm:rounded-t-lg">
               <div className="flex items-center gap-2">
                 <Landmark className="h-5 w-5" />
                 <span className="font-semibold">RICO - Intelligence</span>
               </div>
               <Button 
                 onClick={() => setShowRico(false)} 
                 variant="ghost" 
                 size="icon"
                 className="text-white hover:bg-white/20"
               >
                 <X className="h-4 w-4" />
               </Button>
             </div>
             
             {/* RICO content area */}
             <div className="flex-1 overflow-hidden">
               <RicoChat />
             </div>
           </Card>
         </>
      )}
    </>
  );
}
