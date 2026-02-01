import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ComboboxSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
}

export function ComboboxSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  allowCustom = true,
  className,
}: ComboboxSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleAddCustom = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setCustomValue('');
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn(
            "w-full justify-between bg-muted/30 border-border/50 rounded-xl font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value || placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0 glass-elevated border-border/50" 
        align="start"
      >
        <ScrollArea className="max-h-[200px]">
          {options.length > 0 && (
            <div className="p-1">
              {options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors",
                    value === option 
                      ? "bg-primary/10 text-foreground" 
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  {option}
                  {value === option && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {allowCustom && (
          <div className="border-t border-border/50 p-2">
            <div className="flex gap-2">
              <Input
                placeholder="Add custom..."
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                className="bg-muted/30 border-border/50 rounded-lg h-8 text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustom}
                disabled={!customValue.trim()}
                className="rounded-lg h-8 px-2"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
