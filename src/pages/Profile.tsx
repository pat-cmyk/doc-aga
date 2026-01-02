import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { useRole, GlobalRole } from "@/hooks/useRole";
import { useFarmRole } from "@/hooks/useFarmRole";
import { usePermissions } from "@/hooks/usePermissions";
import { ArrowLeft, Loader2, User, Mail, Phone, Shield, Mic, CheckCircle, AlertCircle, Building2, Users } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import { Badge } from "@/components/ui/badge";
import { CacheSettingsDialog } from "@/components/CacheSettingsDialog";
import { FarmLogoUpload } from "@/components/FarmLogoUpload";
import { FarmTeamManagement } from "@/components/FarmTeamManagement";
import { DevicePermissionHub } from "@/components/permissions/DevicePermissionHub";

const Profile = () => {
  const navigate = useNavigate();
  const { profile, loading, updateProfile, updatePassword } = useProfile();
  const { globalRoles, isLoading: rolesLoading } = useRole();
  const { primaryFarmRole, isLoading: farmRoleLoading } = useFarmRole();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [voiceTrainingCompleted, setVoiceTrainingCompleted] = useState(false);
  const [voiceTrainingSkipped, setVoiceTrainingSkipped] = useState(false);
  const [samplesCount, setSamplesCount] = useState(0);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [farmData, setFarmData] = useState<any>(null);
  const { canManageFarm } = usePermissions(farmId || undefined);

  useEffect(() => {
    const loadUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setEmail(user.email || "");
    };
    loadUserEmail();
  }, []);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setVoiceTrainingCompleted(profile.voice_training_completed || false);
      setVoiceTrainingSkipped(profile.voice_training_skipped || false);
    }
  }, [profile]);

  useEffect(() => {
    const loadVoiceTrainingSamples = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase
          .from('voice_training_samples')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        setSamplesCount(count || 0);
      }
    };
    loadVoiceTrainingSamples();
  }, []);

  useEffect(() => {
    const loadFarmData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user owns a farm
      const { data: ownedFarms } = await supabase
        .from("farms")
        .select("*")
        .eq("owner_id", user.id)
        .eq("is_deleted", false)
        .limit(1);

      if (ownedFarms && ownedFarms.length > 0) {
        setFarmId(ownedFarms[0].id);
        setFarmData(ownedFarms[0]);
        return;
      }

      // Check if user is a manager of a farm
      const { data: memberFarms } = await supabase
        .from("farm_memberships")
        .select("farm_id, role_in_farm")
        .eq("user_id", user.id)
        .eq("invitation_status", "accepted")
        .limit(1);

      if (memberFarms && memberFarms.length > 0) {
        const { data: farm } = await supabase
          .from("farms")
          .select("*")
          .eq("id", memberFarms[0].farm_id)
          .single();

        if (farm) {
          setFarmId(farm.id);
          setFarmData(farm);
        }
      }
    };
    loadFarmData();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    await updateProfile({ full_name: fullName, phone });
    setUpdating(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return;
    }
    setUpdating(true);
    try {
      const success = await updatePassword(newPassword);
      if (success) {
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      const isLeakedPassword = error?.message?.includes("password has been exposed") || 
                               error?.message?.includes("breached") || 
                               error?.message?.includes("leaked");
      
      if (isLeakedPassword) {
        // This error is already handled by useProfile hook, but we can add additional UI feedback here if needed
      }
    }
    setUpdating(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    if (role === 'farmhand') return 'Farmhand';
    if (role === 'farmer_owner') return 'Farm Owner';
    if (role === 'admin') return 'Admin';
    if (role === 'merchant') return 'Merchant';
    if (role === 'government') return 'Government';
    if (role === 'distributor') return 'Distributor';
    if (role === 'vet') return 'Veterinarian';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Combine global roles with farm-specific role for display
  const displayRoles: string[] = [...globalRoles];
  if (primaryFarmRole) {
    // Show the farm-specific role (e.g., "Farmhand" or "Farm Owner")
    displayRoles.push(primaryFarmRole.roleInFarm);
  }

  if (loading || rolesLoading || farmRoleLoading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {profile?.full_name ? getInitials(profile.full_name) : <User />}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-2xl">{profile?.full_name || "User Profile"}</CardTitle>
              <CardDescription className="flex items-center justify-center gap-2 flex-wrap">
                <Shield className="h-4 w-4" />
                {displayRoles.length > 0 ? (
                  <div className="flex gap-1 flex-wrap justify-center">
                    {displayRoles.map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {getRoleLabel(role)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  "No roles assigned"
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>View and update your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+63 XXX XXX XXXX"
                  />
                </div>

                <Button type="submit" disabled={updating} className="w-full">
                  {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Profile
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Voice Training Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Voice Training
              </CardTitle>
              <CardDescription>
                Train the AI to better understand your voice and pronunciation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                {voiceTrainingCompleted ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Training Completed</p>
                      <p className="text-xs text-muted-foreground">
                        You've recorded {samplesCount} voice samples
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Not Completed</p>
                      <p className="text-xs text-muted-foreground">
                        {voiceTrainingSkipped 
                          ? "You skipped voice training" 
                          : "Complete voice training for better accuracy"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => navigate('/voice-training')}
                  variant={voiceTrainingCompleted ? "outline" : "default"}
                  className="flex-1"
                >
                  {voiceTrainingCompleted ? "Redo Training" : "Complete Training"}
                </Button>
                {voiceTrainingCompleted && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        await supabase
                          .from('voice_training_samples')
                          .delete()
                          .eq('user_id', user.id);
                        
                        await supabase
                          .from('profiles')
                          .update({ 
                            voice_training_completed: false,
                            voice_training_skipped: false 
                          })
                          .eq('id', user.id);
                        
                        setSamplesCount(0);
                        setVoiceTrainingCompleted(false);
                        setVoiceTrainingSkipped(false);
                      }
                    }}
                  >
                    Clear Data
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Farm Settings */}
          {farmId && canManageFarm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Farm Settings
                </CardTitle>
                <CardDescription>Manage your farm branding and information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FarmLogoUpload
                  farmId={farmId}
                  currentLogoUrl={farmData?.logo_url || null}
                  onUploadSuccess={(newLogoUrl) => {
                    setFarmData({ ...farmData, logo_url: newLogoUrl });
                  }}
                />
                <Separator />
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Farm Name</p>
                      <p className="font-medium">{farmData?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Region</p>
                      <p className="font-medium">{farmData?.region || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Livestock Type</p>
                      <p className="font-medium capitalize">{farmData?.livestock_type || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Management - Only for farm owners/managers */}
          {farmId && canManageFarm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Management
                </CardTitle>
                <CardDescription>Invite and manage your farm team members</CardDescription>
              </CardHeader>
              <CardContent>
                <FarmTeamManagement farmId={farmId} isOwner={canManageFarm} />
              </CardContent>
            </Card>
          )}

          {/* Device Permissions */}
          <DevicePermissionHub />

          {/* Cache Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Cache Settings</CardTitle>
              <CardDescription>Manage your offline data and cache preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <CacheSettingsDialog />
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    minLength={8}
                  />
                  <PasswordStrengthIndicator password={newPassword} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    minLength={8}
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={updating || !newPassword || newPassword !== confirmPassword}
                  className="w-full"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
