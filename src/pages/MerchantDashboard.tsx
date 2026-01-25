import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { useMerchantProducts } from "@/hooks/useMerchantProducts";
import { useMerchantOrders } from "@/hooks/useMerchantOrders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Package, ShoppingCart, Megaphone, MapPin, MessageSquare, FileText, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductManagement } from "@/components/merchant/ProductManagement";
import { MerchantProfile } from "@/components/merchant/MerchantProfile";
import { OrderManagement } from "@/components/merchant/OrderManagement";
import { InvoiceList } from "@/components/merchant/InvoiceList";
import { NotificationBell } from "@/components/merchant/NotificationBell";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const { isMerchant, isLoading } = useRole();
  const [activeTab, setActiveTab] = useState("dashboard");
  
  const { products } = useMerchantProducts();
  const { orders } = useMerchantOrders("all");

  // Calculate statistics
  const totalProducts = products?.filter(p => p.is_active).length || 0;
  const activeOrders = orders?.filter(o => 
    ['received', 'in_process', 'in_transit'].includes(o.status)
  ).length || 0;
  const revenue = orders?.filter(o => o.status === 'delivered')
    .reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-12 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!isMerchant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need a merchant account to access this area. Would you like to register as a merchant?
            </p>
            <div className="flex gap-1 sm:gap-2">
              <Button onClick={() => navigate("/")} className="min-h-[44px]">Go to Dashboard</Button>
              <Button variant="outline" onClick={() => navigate("/merchant/register")} className="min-h-[44px]">
                Register as Merchant
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Merchant Portal</h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <NetworkStatusIndicator />
              <UserEmailDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 w-full mb-6 h-auto gap-1 p-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm min-h-[44px]">
              <Store className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm min-h-[44px]">
              <Package className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm min-h-[44px]">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm min-h-[44px]">
              <Megaphone className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Campaigns</span>
            </TabsTrigger>
            <TabsTrigger value="distributors" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm min-h-[44px]">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Distributors</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm min-h-[44px]">
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm min-h-[44px]">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm min-h-[44px]">
              <User className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProducts}</div>
                  <p className="text-xs text-muted-foreground">Active listings</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeOrders}</div>
                  <p className="text-xs text-muted-foreground">Pending fulfillment</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Running ads</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Sales</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₱{revenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total from delivered orders</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Welcome to Your Merchant Portal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Get started by adding your first product or creating an ad campaign to reach farmers in your area.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setActiveTab("products")} className="min-h-[44px]">
                    <Package className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("campaigns")} className="min-h-[44px]">
                    <Megaphone className="h-4 w-4 mr-2" />
                    Create Campaign
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <ProductManagement />
          </TabsContent>

          <TabsContent value="orders">
            <OrderManagement />
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Ad Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Campaign management interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distributors">
            <Card>
              <CardHeader>
                <CardTitle>Distributor Network</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Distributor management interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Messaging interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <InvoiceList />
          </TabsContent>

          <TabsContent value="profile">
            <MerchantProfile />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MerchantDashboard;
