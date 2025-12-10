import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Plus, Eye, MapPin, Users, Beef, Ticket } from "lucide-react";
import { AdminAnimalDialog } from "./AdminAnimalDialog";
import { CreateTicketDialog } from "./CreateTicketDialog";
import { format } from "date-fns";

interface FarmDetailPanelProps {
  farmId: string | null;
  farmName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditFarm: () => void;
  onViewAsFarmer: () => void;
}

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  gender: string | null;
  birth_date: string | null;
  life_stage: string | null;
  current_weight_kg: number | null;
  livestock_type: string;
  is_deleted: boolean;
}

export const FarmDetailPanel = ({
  farmId,
  farmName,
  open,
  onOpenChange,
  onEditFarm,
  onViewAsFarmer,
}: FarmDetailPanelProps) => {
  const [animalDialogOpen, setAnimalDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);

  const { data: farmDetails } = useQuery({
    queryKey: ["admin-farm-detail", farmId],
    queryFn: async () => {
      if (!farmId) return null;
      const { data, error } = await supabase
        .from("farms")
        .select(`
          *,
          profiles:owner_id (full_name, email, phone)
        `)
        .eq("id", farmId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!farmId && open,
  });

  const { data: animals } = useQuery<Animal[]>({
    queryKey: ["admin-farm-animals", farmId],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Animal[];
    },
    enabled: !!farmId && open,
  });

  const { data: teamMembers } = useQuery({
    queryKey: ["admin-farm-team", farmId],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase
        .from("farm_memberships")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq("farm_id", farmId)
        .eq("invitation_status", "accepted");
      if (error) throw error;
      return data;
    },
    enabled: !!farmId && open,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["admin-farm-activity", farmId],
    queryFn: async () => {
      if (!farmId) return [];
      // Get owner's activity
      const { data: farm } = await supabase
        .from("farms")
        .select("owner_id")
        .eq("id", farmId)
        .single();
      
      if (!farm) return [];

      const { data, error } = await supabase
        .from("user_activity_logs")
        .select("*")
        .eq("user_id", farm.owner_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!farmId && open,
  });

  const handleEditAnimal = (animal: Animal) => {
    setSelectedAnimal(animal);
    setAnimalDialogOpen(true);
  };

  const handleAddAnimal = () => {
    setSelectedAnimal(null);
    setAnimalDialogOpen(true);
  };

  if (!farmId) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>{farmName}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setCreateTicketOpen(true)}>
                  <Ticket className="h-4 w-4 mr-1" />
                  Create Ticket
                </Button>
                <Button size="sm" variant="outline" onClick={onViewAsFarmer}>
                  <Eye className="h-4 w-4 mr-1" />
                  View as Farmer
                </Button>
                <Button size="sm" onClick={onEditFarm}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit Farm
                </Button>
              </div>
            </SheetTitle>
            <SheetDescription>
              Farm details and management options
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="details" className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="animals">
                Animals ({animals?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100vh-220px)] mt-4">
              <TabsContent value="details" className="space-y-4">
                {farmDetails && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Owner</p>
                        <p className="font-medium">
                          {(farmDetails.profiles as { full_name: string })?.full_name || "Unknown"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">
                          {(farmDetails.profiles as { email: string })?.email || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Livestock Type</p>
                        <p className="font-medium capitalize">{farmDetails.livestock_type}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant={farmDetails.is_deleted ? "destructive" : "default"}>
                          {farmDetails.is_deleted ? "Deactivated" : "Active"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Location
                      </p>
                      <p className="font-medium">
                        {[farmDetails.municipality, farmDetails.province, farmDetails.region]
                          .filter(Boolean)
                          .join(", ") || "Not specified"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        GPS: {farmDetails.gps_lat}, {farmDetails.gps_lng}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">FFEDIS ID</p>
                        <p className="font-medium">{farmDetails.ffedis_id || "Not assigned"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">LGU Code</p>
                        <p className="font-medium">{farmDetails.lgu_code || "Not assigned"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Validation Status</p>
                        <Badge variant="outline">{farmDetails.validation_status || "Pending"}</Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Program Participant</p>
                        <p className="font-medium">
                          {farmDetails.is_program_participant ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="animals" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium flex items-center gap-1">
                    <Beef className="h-4 w-4" /> Registered Animals
                  </h4>
                  <Button size="sm" onClick={handleAddAnimal}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Animal
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name/Tag</TableHead>
                      <TableHead>Breed</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {animals?.map((animal) => (
                      <TableRow key={animal.id}>
                        <TableCell className="font-medium">
                          {animal.name || animal.ear_tag || "Unnamed"}
                        </TableCell>
                        <TableCell>{animal.breed || "Unknown"}</TableCell>
                        <TableCell className="capitalize">{animal.gender || "-"}</TableCell>
                        <TableCell className="capitalize">{animal.life_stage || "-"}</TableCell>
                        <TableCell>
                          {animal.current_weight_kg ? `${animal.current_weight_kg} kg` : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditAnimal(animal)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!animals || animals.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No animals registered
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="team" className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" /> Team Members
                </h4>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers?.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {(member.profiles as { full_name: string })?.full_name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          {(member.profiles as { email: string })?.email || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{member.role_in_farm}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!teamMembers || teamMembers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No team members
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <h4 className="text-sm font-medium">Recent Activity</h4>

                <div className="space-y-2">
                  {recentActivity?.map((activity) => (
                    <div
                      key={activity.id}
                      className="p-3 border rounded-lg text-sm space-y-1"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{activity.activity_type}</span>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(activity.created_at), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{activity.description}</p>
                    </div>
                  ))}
                  {(!recentActivity || recentActivity.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      No recent activity
                    </p>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AdminAnimalDialog
        farmId={farmId}
        farmName={farmName}
        animal={selectedAnimal}
        open={animalDialogOpen}
        onOpenChange={setAnimalDialogOpen}
      />

      <CreateTicketDialog
        open={createTicketOpen}
        onOpenChange={setCreateTicketOpen}
        linkedFarmId={farmId}
      />
    </>
  );
};
