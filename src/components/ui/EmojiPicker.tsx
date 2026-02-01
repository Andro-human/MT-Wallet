import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const EMOJI_PRESETS = [
  '🛒', '🍔', '🚗', '🏠', '💊', '🎬', '✈️', '👕', '📚', '💰',
  '🎁', '💼', '🏋️', '🎮', '📱', '🔧', '☕', '🍕', '🎵', '🎨',
  '🛍️', '🏪', '🚌', '⛽', '🏥', '🎓', '💅', '🐶', '🌴', '🎂',
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [customEmoji, setCustomEmoji] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleCustomSubmit = () => {
    if (customEmoji.trim()) {
      onChange(customEmoji.trim());
      setCustomEmoji('');
      setIsOpen(false);
    }
  };

  const handlePresetClick = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-14 h-14 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center text-2xl hover:bg-muted/50 transition-colors"
        >
          {value || '📁'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 glass-elevated border-border/50" align="start">
        <div className="space-y-3">
          {/* Custom emoji input */}
          <div className="flex gap-2">
            <Input
              placeholder="Type or paste emoji..."
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              className="bg-muted/30 border-border/50 rounded-xl text-lg"
              maxLength={2}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleCustomSubmit}
              className="rounded-xl px-3"
              disabled={!customEmoji.trim()}
            >
              Use
            </Button>
          </div>
          
          {/* Preset grid */}
          <div className="grid grid-cols-6 gap-1.5">
            {EMOJI_PRESETS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handlePresetClick(emoji)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
                  value === emoji 
                    ? 'bg-primary/20 ring-2 ring-primary' 
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
