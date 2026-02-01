import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InlineSelectFieldProps {
  value: string;
  displayValue?: string;
  onSave: (value: string) => Promise<void>;
  options: { value: string; label: string; icon?: string; color?: string }[];
  allowCustom?: boolean;
  placeholder?: string;
  className?: string;
  emptyLabel?: string;
}

export function InlineSelectField({
  value,
  displayValue,
  onSave,
  options,
  allowCustom = false,
  placeholder = 'Select...',
  className,
  emptyLabel = 'None',
}: InlineSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedOption = options.find(opt => opt.value === value);
  const display = displayValue || selectedOption?.label || emptyLabel;

  const handleSelect = async (newValue: string) => {
    if (newValue === value) {
      setIsOpen(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsOpen(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustom = async () => {
    if (customValue.trim()) {
      setIsSaving(true);
      try {
        await onSave(customValue.trim());
        setCustomValue('');
        setIsOpen(false);
      } catch {
        // Error handled by parent
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isSaving}
          className={cn(
            "flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors text-left",
            className
          )}
        >
          {selectedOption?.icon && (
            <span
              className="w-6 h-6 flex items-center justify-center rounded-md text-sm"
              style={selectedOption.color ? {
                backgroundColor: `${selectedOption.color}18`,
              } : undefined}
            >
              {selectedOption.icon}
            </span>
          )}
          <span>{display}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-0 glass-elevated border-border/50" 
        align="start"
        style={{ maxHeight: '300px' }}
      >
        <ScrollArea className="max-h-[250px]">
          <div className="p-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                disabled={isSaving}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                  value === option.value 
                    ? "bg-primary/10 text-foreground" 
                    : "hover:bg-muted/50 text-foreground"
                )}
              >
                {option.icon && (
                  <span
                    className="w-6 h-6 flex items-center justify-center rounded-md text-sm"
                    style={option.color ? {
                      backgroundColor: `${option.color}18`,
                    } : undefined}
                  >
                    {option.icon}
                  </span>
                )}
                <span className="flex-1 text-left">{option.label}</span>
                {value === option.value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
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
                className="bg-muted/30 border-border/50 rounded-lg h-8 text-sm flex-1"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!customValue.trim() || isSaving}
                className="h-8 px-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
