import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HealthRecords = ({ animalId }: { animalId: string }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    visit_date: "",
    diagnosis: "",
    treatment: "",
    notes: ""
  });

  useEffect(() => {
    loadRecords();
  }, [animalId]);

  const loadRecords = async () => {
    const { data } = await supabase
      .from("health_records")
      .select("*")
      .eq("animal_id", animalId)
      .order("visit_date", { ascending: false });
    setRecords(data || []);
    setLoading(false);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setSaving(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const fileExt = file.name.split('.').pop();
        const fileName = `${animalId}-health-${Date.now()}-${i}.${fileExt}`;
        const filePath = `health/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('animal-photos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('animal-photos')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setUploadedPhotos([...uploadedPhotos, ...uploadedUrls]);
      toast({
        title: "Photos uploaded",
        description: `${uploadedUrls.length} photo(s) added`
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.visit_date) {
      toast({
        title: "Missing field",
        description: "Visit date is required",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    try {
      // Insert health record
      const { data: record, error: recordError } = await supabase
        .from("health_records")
        .insert({
          animal_id: animalId,
          visit_date: formData.visit_date,
          diagnosis: formData.diagnosis || null,
          treatment: formData.treatment || null,
          notes: formData.notes || null
        })
        .select()
        .single();

      if (recordError) throw recordError;

      // Insert photos if any
      if (uploadedPhotos.length > 0) {
        const photoRecords = uploadedPhotos.map(url => ({
          animal_id: animalId,
          photo_path: url,
          label: `Health Record - ${formData.visit_date}`
        }));

        const { error: photosError } = await supabase
          .from("animal_photos")
          .insert(photoRecords);

        if (photosError) throw photosError;
      }

      toast({
        title: "Success!",
        description: "Health record added"
      });

      setShowDialog(false);
      setFormData({ visit_date: "", diagnosis: "", treatment: "", notes: "" });
      setUploadedPhotos([]);
      loadRecords();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(uploadedPhotos.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Health Records</CardTitle>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Health Record</DialogTitle>
                <DialogDescription>Record veterinary visits and treatments</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="visit_date">Visit Date *</Label>
                  <Input
                    id="visit_date"
                    type="date"
                    value={formData.visit_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, visit_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Diagnosis</Label>
                  <Input
                    id="diagnosis"
                    value={formData.diagnosis}
                    onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
                    placeholder="Diagnosis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="treatment">Treatment</Label>
                  <Input
                    id="treatment"
                    value={formData.treatment}
                    onChange={(e) => setFormData(prev => ({ ...prev, treatment: e.target.value }))}
                    placeholder="Treatment provided"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Photos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {saving ? "Uploading..." : "Add Photos"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  {uploadedPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {uploadedPhotos.map((url, index) => (
                        <div key={index} className="relative">
                          <img src={url} alt={`Photo ${index + 1}`} className="w-full h-20 object-cover rounded" />
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={() => removePhoto(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Record"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No health records yet</p>
        ) : (
          <div className="space-y-3">
            {records.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{new Date(r.visit_date).toLocaleDateString()}</p>
                  {r.diagnosis && <p className="text-sm text-muted-foreground mt-1">Diagnosis: {r.diagnosis}</p>}
                  {r.treatment && <p className="text-sm text-muted-foreground">Treatment: {r.treatment}</p>}
                  {r.notes && <p className="text-sm text-muted-foreground mt-2">{r.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HealthRecords;