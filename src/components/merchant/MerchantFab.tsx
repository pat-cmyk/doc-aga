import { useState } from "react";
import { Stethoscope, Package, ShoppingCart } from "lucide-react";
import { ActionFab, QuickAction } from "@/components/ui/action-fab";
import DocAgaConsultation from "@/components/farmhand/DocAgaConsultation";
import { ProductFormDialog } from "@/components/merchant/ProductFormDialog";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

const merchantActions: QuickAction[] = [
  { 
    id: 'doc-aga', 
    label: 'Ask Doc Aga', 
    icon: Stethoscope, 
    color: 'text-primary',
    isPrimary: true,
    description: 'Business & inventory help'
  },
  { 
    id: 'add-product', 
    label: 'Add Product', 
    icon: Package, 
    color: 'text-green-500',
    description: 'List new item'
  },
  { 
    id: 'orders', 
    label: 'View Orders', 
    icon: ShoppingCart, 
    color: 'text-blue-500',
    description: 'Active orders'
  },
];

export function MerchantFab() {
  const [showDocAga, setShowDocAga] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'doc-aga':
        setShowDocAga(true);
        break;
      case 'add-product':
        setShowProductForm(true);
        break;
      case 'orders':
        navigate('/merchant#orders');
        break;
    }
  };

  const handleProductSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['merchant-products'] });
  };

  return (
    <>
      <ActionFab
        actions={merchantActions}
        onAction={handleAction}
        mainIcon={Package}
        mainLabel="Merchant Actions"
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

      <ProductFormDialog
        open={showProductForm}
        onOpenChange={setShowProductForm}
        product={null}
        onSuccess={handleProductSuccess}
      />
    </>
  );
}
