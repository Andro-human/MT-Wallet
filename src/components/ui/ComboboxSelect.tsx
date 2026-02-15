import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Options can be plain strings (value === label) or {value, label} objects */
  options: (string | ComboboxOption)[];
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
  /** Optional container element to portal the dropdown into (useful inside dialogs) */
  portalContainer?: HTMLElement | null;
}

function normalizeOption(opt: string | ComboboxOption): ComboboxOption {
  return typeof opt === 'string' ? { value: opt, label: opt } : opt;
}

export function ComboboxSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  allowCustom = true,
  className,
  portalContainer,
}: ComboboxSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customValue, setCustomValue] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase();
    return normalizedOptions.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [normalizedOptions, searchQuery]);

  const selectedOption = normalizedOptions.find(o => o.value === value);
  const displayText = selectedOption?.label || value || placeholder;

  // Find the best portal target: explicit container, or nearest dialog, or body
  const getPortalTarget = useCallback(() => {
    if (portalContainer) return portalContainer;
    // Walk up from trigger to find a Radix dialog content wrapper
    const dialogEl = triggerRef.current?.closest('[role="dialog"]');
    if (dialogEl instanceof HTMLElement) return dialogEl;
    return document.body;
  }, [portalContainer]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const target = getPortalTarget();
    const dropdownWidth = rect.width;

    if (target === document.body) {
      // Fixed positioning relative to viewport
      let left = rect.left;
      if (left + dropdownWidth > window.innerWidth - 8) {
        left = window.innerWidth - dropdownWidth - 8;
      }
      if (left < 8) left = 8;
      setDropdownPos({
        top: rect.bottom + 4,
        left,
        width: dropdownWidth,
      });
    } else {
      // Absolute positioning relative to the portal container
      const containerRect = target.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom - containerRect.top + target.scrollTop + 4,
        left: rect.left - containerRect.left + target.scrollLeft,
        width: dropdownWidth,
      });
    }
  }, [getPortalTarget]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleAddCustom = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setCustomValue('');
      setSearchQuery('');
      setIsOpen(false);
    }
  };

  // Update position when opening
  useEffect(() => {
    if (isOpen) updatePosition();
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
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full justify-between bg-muted/30 border-border/50 rounded-xl font-normal",
          !value && "text-muted-foreground",
          className
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          data-combobox-dropdown
          className={cn(
            "rounded-xl border border-border/50 bg-popover shadow-lg overflow-hidden",
            getPortalTarget() === document.body ? "fixed" : "absolute"
          )}
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
        >
          {/* Search input */}
          {normalizedOptions.length > 5 && (
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

          <div
            className="max-h-[200px] overflow-y-auto overscroll-contain p-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* None option */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors",
                !value
                  ? "bg-primary/10 text-foreground"
                  : "active:bg-muted/50 text-foreground"
              )}
            >
              <span>None</span>
              {!value && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
            </button>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors",
                    value === option.value
                      ? "bg-primary/10 text-foreground"
                      : "active:bg-muted/50 text-foreground"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No matches found
              </div>
            )}
          </div>

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
        </div>,
        getPortalTarget()
      )}
    </div>
  );
}
