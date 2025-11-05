import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizeFeedType } from "@/lib/feedTypeNormalization";

interface FeedTypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  availableFeedTypes: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FeedTypeCombobox({
  value,
  onChange,
  availableFeedTypes,
  placeholder = "Select or type feed type...",
  disabled = false,
  className,
}: FeedTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Normalize and deduplicate available feed types
  const normalizedTypes = Array.from(
    new Set(availableFeedTypes.map(normalizeFeedType))
  ).sort();

  // Add "Fresh Cut & Carry" as a standard option
  const allOptions = ["Fresh Cut & Carry", ...normalizedTypes.filter(t => t !== "Fresh Cut & Carry")];

  // Filter options based on search
  const filteredOptions = search
    ? allOptions.filter(option =>
        option.toLowerCase().includes(search.toLowerCase())
      )
    : allOptions;

  // Show custom entry option if search doesn't match any existing option
  const showCustomOption = search && 
    !filteredOptions.some(opt => opt.toLowerCase() === search.toLowerCase());

  const handleSelect = (selectedValue: string) => {
    const normalized = normalizeFeedType(selectedValue);
    onChange(normalized);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {value ? normalizeFeedType(value) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[400px] p-0 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search or type new feed type..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {showCustomOption ? (
                <div className="py-6 text-center text-sm">
                  <p className="mb-2 text-muted-foreground">No matching feed type found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelect(search)}
                  >
                    Use "{normalizeFeedType(search)}"
                  </Button>
                </div>
              ) : (
                "No feed types found"
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((feedType) => (
                <CommandItem
                  key={feedType}
                  value={feedType}
                  onSelect={() => handleSelect(feedType)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      normalizeFeedType(value) === feedType
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {feedType}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
