import { useState, useRef, useEffect } from "react";
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
  CommandSeparator,
} from "@/components/ui/command";
import { hapticSelection } from "@/lib/haptics";

export interface AnimalOption {
  value: string;
  label: string;
  group: 'quick' | 'individual';
  subLabel?: string;
}

interface AnimalComboboxProps {
  options: AnimalOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AnimalCombobox({
  options,
  value,
  onChange,
  placeholder = "Select animals...",
  disabled = false,
}: AnimalComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = options.find((opt) => opt.value === value);

  const quickOptions = options.filter((opt) => opt.group === 'quick');
  const individualOptions = options.filter((opt) => opt.group === 'individual');

  const filteredIndividualOptions = search
    ? individualOptions.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.subLabel?.toLowerCase().includes(search.toLowerCase())
      )
    : individualOptions;

  const handleSelect = (selectedValue: string) => {
    hapticSelection();
    onChange(selectedValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="w-full">
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between min-h-[48px]"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="mt-2 rounded-md border bg-popover text-popover-foreground shadow-sm">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search animals..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[200px] overflow-y-auto">
              <CommandEmpty>No animals found</CommandEmpty>

              {quickOptions.length > 0 && !search && (
                <>
                  <CommandGroup heading="Quick Select">
                    {quickOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => handleSelect(option.value)}
                        className="min-h-[44px]"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-medium">{option.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {filteredIndividualOptions.length > 0 && (
                <CommandGroup heading={search ? "Search Results" : "Individual Animals"}>
                  {filteredIndividualOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="min-h-[44px]"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.subLabel && (
                          <span className="text-xs text-muted-foreground">
                            {option.subLabel}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
