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
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, Loader2, User, Mail, Phone, Shield, Mic, CheckCircle, AlertCircle } from "lucide-react";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import { Badge } from "@/components/ui/badge";
import { CacheSettingsDialog } from "@/components/CacheSettingsDialog";

const Profile = () => {
  const navigate = useNavigate();
  const { profile, loading, updateProfile, updatePassword } = useProfile();
  const { roles, isLoading: rolesLoading } = useRole();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [voiceTrainingCompleted, setVoiceTrainingCompleted] = useState(false);
  const [voiceTrainingSkipped, setVoiceTrainingSkipped] = useState(false);
  const [samplesCount, setSamplesCount] = useState(0);

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
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
                {roles.length > 0 ? (
                  <div className="flex gap-1 flex-wrap justify-center">
                    {roles.map((role) => (
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
