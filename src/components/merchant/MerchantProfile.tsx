import { useState, useEffect } from "react";
import { useMerchant } from "@/hooks/useMerchant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, Phone, MapPin, Upload, X, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const MerchantProfile = () => {
  const { merchant, loading, updateMerchant } = useMerchant();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessLogoUrl, setBusinessLogoUrl] = useState("");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");

  useEffect(() => {
    if (merchant) {
      setBusinessName(merchant.business_name);
      setBusinessDescription(merchant.business_description || "");
      setContactEmail(merchant.contact_email);
      setContactPhone(merchant.contact_phone || "");
      setBusinessAddress(merchant.business_address || "");
      setBusinessLogoUrl(merchant.business_logo_url || "");
      setGpsLat(merchant.gps_lat?.toString() || "");
      setGpsLng(merchant.gps_lng?.toString() || "");
    }
  }, [merchant]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("merchant-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("merchant-logos")
        .getPublicUrl(filePath);

      setBusinessLogoUrl(data.publicUrl);

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName || !contactEmail) {
      toast({
        title: "Missing required fields",
        description: "Business name and contact email are required",
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const updates: any = {
      business_name: businessName,
      business_description: businessDescription || null,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      business_address: businessAddress || null,
      business_logo_url: businessLogoUrl || null,
    };

    if (gpsLat && gpsLng) {
      updates.gps_lat = parseFloat(gpsLat);
      updates.gps_lng = parseFloat(gpsLng);
    }

    const success = await updateMerchant(updates);
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No merchant profile found</p>
        </CardContent>
      </Card>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={businessLogoUrl} alt={businessName} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {getInitials(businessName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{businessName}</h2>
                {merchant.is_verified ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Verified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Member since {new Date(merchant.created_at).toLocaleDateString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Last updated {new Date(merchant.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Information Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Update your business details and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Business Logo */}
            <div className="space-y-2">
              <Label>Business Logo</Label>
              {businessLogoUrl ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted">
                  <img src={businessLogoUrl} alt="Logo" className="object-cover w-full h-full" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setBusinessLogoUrl("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center w-32 h-32 flex flex-col items-center justify-center">
                  <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
                  <Label
                    htmlFor="logo-upload"
                    className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isUploadingLogo ? "Uploading..." : "Upload"}
                  </Label>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName">
                Business Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your business name"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Business Description */}
            <div className="space-y-2">
              <Label htmlFor="businessDescription">Business Description</Label>
              <Textarea
                id="businessDescription"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="Tell farmers about your business..."
                rows={4}
              />
            </div>

            <Separator />

            {/* Contact Email */}
            <div className="space-y-2">
              <Label htmlFor="contactEmail">
                Contact Email <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">This is your merchant registered email</p>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Contact Phone */}
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+63 XXX XXX XXXX"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Business Address */}
            <div className="space-y-2">
              <Label htmlFor="businessAddress">Business Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="businessAddress"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Your business address"
                  rows={2}
                  className="pl-9"
                />
              </div>
            </div>

            {/* GPS Coordinates (Collapsible) */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between">
                  <span className="text-sm font-medium">GPS Coordinates (Optional)</span>
                  <span className="text-xs text-muted-foreground">Click to expand</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gpsLat">Latitude</Label>
                    <Input
                      id="gpsLat"
                      type="number"
                      step="any"
                      value={gpsLat}
                      onChange={(e) => setGpsLat(e.target.value)}
                      placeholder="14.5995"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gpsLng">Longitude</Label>
                    <Input
                      id="gpsLng"
                      type="number"
                      step="any"
                      value={gpsLng}
                      onChange={(e) => setGpsLng(e.target.value)}
                      placeholder="120.9842"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || isUploadingLogo}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};
