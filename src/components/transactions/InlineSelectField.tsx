import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0, minWidth: 0 });

  const selectedOption = options.find(opt => opt.value === value);
  const display = displayValue || selectedOption?.label || emptyLabel;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  // Calculate dropdown position — anchor to right edge of trigger so it never overflows
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 220),
    });
  }, []);

  const handleSelect = async (newValue: string) => {
    if (newValue === value) {
      setIsOpen(false);
      setSearchQuery('');
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsOpen(false);
      setSearchQuery('');
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
        setSearchQuery('');
        setIsOpen(false);
      } catch {
        // Error handled by parent
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Update position when opening
  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick as any);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick as any);
    };
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current && options.length > 5) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, options.length]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => updatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        disabled={isSaving}
        onClick={() => setIsOpen(!isOpen)}
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

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed rounded-xl border border-border/50 bg-popover shadow-lg overflow-hidden"
          style={{
            top: dropdownPos.top,
            right: dropdownPos.right,
            minWidth: dropdownPos.minWidth,
            maxWidth: `calc(100vw - ${dropdownPos.right}px - 8px)`,
            zIndex: 9999,
          }}
        >
          {/* Search input */}
          {options.length > 5 && (
            <div className="p-2 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full h-8 pl-8 pr-3 text-sm bg-muted/30 border border-border/50 rounded-lg outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
          )}

          {filteredOptions.length > 0 ? (
            <div
              className="max-h-[250px] overflow-y-auto overscroll-contain p-1"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  disabled={isSaving}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                    value === option.value
                      ? "bg-primary/10 text-foreground"
                      : "active:bg-muted/50 text-foreground"
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
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No matches found
            </div>
          )}

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
        </div>,
        document.body
      )}
    </div>
  );
}
