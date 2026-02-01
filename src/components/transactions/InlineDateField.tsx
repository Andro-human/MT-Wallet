import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface InlineDateFieldProps {
  value: Date;
  onSave: (date: Date) => Promise<void>;
  className?: string;
  showTime?: boolean;
}

export function InlineDateField({
  value,
  onSave,
  className,
  showTime = true,
}: InlineDateFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(value);
  const [timeValue, setTimeValue] = useState(format(value, 'HH:mm'));
  const [isSaving, setIsSaving] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      date.setHours(hours, minutes);
      setSelectedDate(date);
      
      // Auto-save and close on date selection
      handleSave(date);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeValue(newTime);
    const [hours, minutes] = newTime.split(':').map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(hours, minutes);
    setSelectedDate(newDate);
  };

  const handleSave = async (dateToSave?: Date) => {
    const finalDate = dateToSave || selectedDate;
    if (finalDate.getTime() === value.getTime()) {
      setIsOpen(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(finalDate);
      setIsOpen(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isSaving}
          className={cn(
            "flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors",
            className
          )}
        >
          <span>{format(value, showTime ? 'PPP p' : 'PPP')}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 glass-elevated border-border/50" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          initialFocus
          className="p-3"
        />
        
        {showTime && (
          <div className="border-t border-border/50 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Input
                type="time"
                value={timeValue}
                onChange={handleTimeChange}
                className="bg-muted/30 border-border/50 rounded-lg h-9 flex-1"
              />
            </div>
            <Button 
              onClick={() => handleSave()} 
              disabled={isSaving}
              className="w-full rounded-lg"
              size="sm"
            >
              {isSaving ? 'Saving...' : 'Update Time'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
