import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

interface ApprovalSettingsProps {
  farmId: string;
}

interface ApprovalSettingsData {
  auto_approve_enabled: boolean;
  auto_approve_hours: number;
  require_approval_for_types: string[] | null;
}

const ACTIVITY_TYPES = [
  { value: 'milking', label: 'Milking Records' },
  { value: 'feeding', label: 'Feeding Records' },
  { value: 'health_observation', label: 'Health Observations' },
  { value: 'weight_measurement', label: 'Weight Measurements' },
  { value: 'injection', label: 'Injection Records' }
];

export const ApprovalSettings = ({ farmId }: ApprovalSettingsProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ApprovalSettingsData>({
    auto_approve_enabled: true,
    auto_approve_hours: 48,
    require_approval_for_types: null
  });

  useEffect(() => {
    loadSettings();
  }, [farmId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('farm_approval_settings')
        .select('*')
        .eq('farm_id', farmId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          auto_approve_enabled: data.auto_approve_enabled,
          auto_approve_hours: data.auto_approve_hours,
          require_approval_for_types: data.require_approval_for_types
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load approval settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('farm_approval_settings')
        .upsert({
          farm_id: farmId,
          auto_approve_enabled: settings.auto_approve_enabled,
          auto_approve_hours: settings.auto_approve_hours,
          require_approval_for_types: settings.require_approval_for_types,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Approval settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save approval settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleActivityType = (activityType: string) => {
    const currentTypes = settings.require_approval_for_types || [];
    const newTypes = currentTypes.includes(activityType)
      ? currentTypes.filter(t => t !== activityType)
      : [...currentTypes, activityType];
    
    setSettings({
      ...settings,
      require_approval_for_types: newTypes.length > 0 ? newTypes : null
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval Settings</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <div>
            <CardTitle>Approval Settings</CardTitle>
            <CardDescription>
              Configure how farmhand activities are reviewed and approved
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-Approval Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-approve">Auto-Approval</Label>
              <p className="text-sm text-muted-foreground">
                Automatically approve activities after a set time period
              </p>
            </div>
            <Switch
              id="auto-approve"
              checked={settings.auto_approve_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, auto_approve_enabled: checked })
              }
            />
          </div>

          {/* Auto-Approval Hours */}
          {settings.auto_approve_enabled && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="hours">Auto-Approve After (hours)</Label>
              <Input
                id="hours"
                type="number"
                min="1"
                max="168"
                value={settings.auto_approve_hours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    auto_approve_hours: parseInt(e.target.value) || 48
                  })
                }
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                Activities will be automatically approved after{' '}
                {settings.auto_approve_hours} hours
              </p>
            </div>
          )}
        </div>

        {/* Activity Type Selection */}
        <div className="space-y-4">
          <div>
            <Label>Require Approval For</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Select which activity types require manager approval. Leave all unchecked to
              require approval for all activities.
            </p>
          </div>

          <div className="space-y-3 ml-2">
            {ACTIVITY_TYPES.map((type) => {
              const isChecked = settings.require_approval_for_types?.includes(type.value) ?? true;
              const isAllNull = settings.require_approval_for_types === null;
              
              return (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.value}
                    checked={isAllNull || isChecked}
                    onCheckedChange={() => toggleActivityType(type.value)}
                  />
                  <label
                    htmlFor={type.value}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {type.label}
                  </label>
                </div>
              );
            })}
          </div>

          {settings.require_approval_for_types && settings.require_approval_for_types.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Only selected activity types will require approval. Other activities will be
              recorded directly.
            </p>
          )}
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
