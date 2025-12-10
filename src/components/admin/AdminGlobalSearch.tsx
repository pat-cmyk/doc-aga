import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Building2, Users, Beef, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface SearchResult {
  type: "farm" | "user" | "animal";
  id: string;
  title: string;
  subtitle: string;
  metadata?: Record<string, unknown>;
}

interface AdminGlobalSearchProps {
  onSelectFarm?: (farmId: string, farmName: string) => void;
}

export const AdminGlobalSearch = ({ onSelectFarm }: AdminGlobalSearchProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Keyboard shortcut handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: searchResults, isLoading } = useQuery<SearchResult[]>({
    queryKey: ["admin-global-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const results: SearchResult[] = [];
      const searchTerm = `%${searchQuery}%`;

      // Search farms
      const { data: farms } = await supabase
        .from("farms")
        .select(`
          id,
          name,
          region,
          profiles:owner_id (full_name, email)
        `)
        .or(`name.ilike.${searchTerm}`)
        .limit(5);

      if (farms) {
        farms.forEach((farm) => {
          results.push({
            type: "farm",
            id: farm.id,
            title: farm.name,
            subtitle: `${farm.region || "No region"} • Owner: ${(farm.profiles as { full_name: string })?.full_name || "Unknown"}`,
            metadata: { region: farm.region },
          });
        });
      }

      // Search users (profiles)
      const { data: users } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (users) {
        users.forEach((user) => {
          results.push({
            type: "user",
            id: user.id,
            title: user.full_name || "Unnamed User",
            subtitle: user.email || "No email",
          });
        });
      }

      // Search animals
      const { data: animals } = await supabase
        .from("animals")
        .select(`
          id,
          name,
          ear_tag,
          breed,
          farms:farm_id (id, name)
        `)
        .eq("is_deleted", false)
        .or(`name.ilike.${searchTerm},ear_tag.ilike.${searchTerm}`)
        .limit(5);

      if (animals) {
        animals.forEach((animal) => {
          results.push({
            type: "animal",
            id: animal.id,
            title: animal.name || animal.ear_tag || "Unnamed",
            subtitle: `${animal.breed || "Unknown breed"} • Farm: ${(animal.farms as { name: string })?.name || "Unknown"}`,
            metadata: { farmId: (animal.farms as { id: string })?.id },
          });
        });
      }

      return results;
    },
    enabled: searchQuery.length >= 2,
  });

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    setSearchQuery("");

    switch (result.type) {
      case "farm":
        if (onSelectFarm) {
          onSelectFarm(result.id, result.title);
        }
        break;
      case "user":
        navigate(`/admin?tab=users&userId=${result.id}`);
        break;
      case "animal":
        if (result.metadata?.farmId && onSelectFarm) {
          onSelectFarm(result.metadata.farmId as string, "Farm");
        }
        break;
    }
  }, [navigate, onSelectFarm]);

  const getIcon = (type: string) => {
    switch (type) {
      case "farm":
        return <Building2 className="h-4 w-4 text-muted-foreground" />;
      case "user":
        return <Users className="h-4 w-4 text-muted-foreground" />;
      case "animal":
        return <Beef className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 mr-2" />
        <span className="hidden lg:inline-flex">Search farms, users, animals...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search farms, users, or animals..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          
          {!isLoading && searchQuery.length >= 2 && (!searchResults || searchResults.length === 0) && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {searchResults && searchResults.length > 0 && (
            <>
              {["farm", "user", "animal"].map((type) => {
                const typeResults = searchResults.filter((r) => r.type === type);
                if (typeResults.length === 0) return null;

                return (
                  <CommandGroup
                    key={type}
                    heading={type === "farm" ? "Farms" : type === "user" ? "Users" : "Animals"}
                  >
                    {typeResults.map((result) => (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        value={`${result.type}-${result.id}`}
                        onSelect={() => handleSelect(result)}
                        className="cursor-pointer"
                      >
                        {getIcon(result.type)}
                        <div className="ml-2 flex-1">
                          <p className="font-medium">{result.title}</p>
                          <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </>
          )}

          {searchQuery.length < 2 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search...
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
