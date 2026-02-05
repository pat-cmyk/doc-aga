 import { useState } from "react";
 import { Stethoscope, MessageSquare, X } from "lucide-react";
import { ActionFab, QuickAction } from "@/components/ui/action-fab";
 import DocAga from "@/components/DocAga";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
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
         <>
           {/* Semi-transparent backdrop - click to close (desktop only) */}
           <div
             className="hidden sm:block fixed inset-0 bg-background/20 backdrop-blur-[2px] z-40"
             onClick={() => setShowDocAga(false)}
           />
           
           {/* Floating Panel - full screen on mobile, floating on desktop */}
           <Card
             className="fixed z-50 flex flex-col shadow-2xl border-2 border-primary/20
               inset-0 rounded-none 
               sm:inset-auto sm:bottom-24 sm:right-4 sm:w-[420px] sm:h-[550px] sm:rounded-lg 
               lg:w-[450px] lg:h-[600px]"
           >
             {/* Header with close button */}
             <div className="flex items-center justify-between border-b p-3 bg-primary text-primary-foreground rounded-t-none sm:rounded-t-lg">
               <div className="flex items-center gap-2">
                 <Stethoscope className="h-5 w-5" />
                 <span className="font-semibold">Doc Aga - Analyst</span>
               </div>
               <Button 
                 onClick={() => setShowDocAga(false)} 
                 variant="ghost" 
                 size="icon"
                 className="text-primary-foreground hover:bg-primary-foreground/20"
               >
                 <X className="h-4 w-4" />
               </Button>
             </div>
             
             {/* DocAga content area */}
             <div className="flex-1 overflow-hidden">
               <DocAga />
             </div>
           </Card>
         </>
      )}
    </>
  );
}
