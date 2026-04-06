/**
 * CreateCooperativeDialog - Admin UI to create a new cooperative
 *
 * Creates the cooperative record and assigns the 'cooperative' role to the target user.
 * Reuses: admin_assign_role RPC, cooperatives table insert, existing dialog/form patterns.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export function CreateCooperativeDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [region, setRegion] = useState('');
  const [municipality, setMunicipality] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim()) return;

    setLoading(true);
    try {
      // 1. Find the user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', adminEmail.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        toast({
          title: 'User not found',
          description: `No account found for ${adminEmail}. The user must have a Doc Aga account first.`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // 2. Create the cooperative
      const { data: coop, error: coopError } = await supabase
        .from('cooperatives')
        .insert({
          name: name.trim(),
          admin_user_id: profile.id,
          region: region.trim() || null,
          municipality: municipality.trim() || null,
        })
        .select('id')
        .single();

      if (coopError) throw coopError;

      // 3. Assign cooperative role to the user
      const { error: roleError } = await supabase.rpc('admin_assign_role', {
        _user_id: profile.id,
        _role: 'cooperative' as any,
      });

      if (roleError) {
        console.error('Role assignment failed (cooperative created):', roleError);
        toast({
          title: 'Cooperative created, but role assignment failed',
          description: `Please manually assign the "cooperative" role to ${adminEmail} in User Management.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Cooperative Created!',
          description: `${name} created with ${adminEmail} as admin.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setAdminEmail('');
    setRegion('');
    setMunicipality('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          <Plus className="h-3 w-3" />
          Create Cooperative
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create Cooperative
          </DialogTitle>
          <DialogDescription>
            Creates a new cooperative and assigns the admin role to the specified user.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="coop-name">Cooperative Name *</Label>
            <Input
              id="coop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nueva Ecija Dairy Cooperative"
              required
            />
          </div>

          <div>
            <Label htmlFor="coop-admin-email">Admin Email *</Label>
            <Input
              id="coop-admin-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="coop.admin@example.com"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must be an existing Doc Aga user. They will get the "cooperative" role.
            </p>
          </div>

          <div>
            <Label htmlFor="coop-region">Region</Label>
            <Input
              id="coop-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Central Luzon"
            />
          </div>

          <div>
            <Label htmlFor="coop-municipality">Municipality</Label>
            <Input
              id="coop-municipality"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              placeholder="e.g. Science City of Muñoz"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !adminEmail.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? 'Creating...' : 'Create Cooperative'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
