import { useState } from "react";
import { format, parseISO } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Check } from "lucide-react";

interface TimeSlot {
  start: string;
  end: string;
  date?: string;
  time?: string;
  duration?: string;
}

interface MeetingTimeSelectorProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
  timezone?: string;
}

export function MeetingTimeSelector({ 
  slots, 
  selectedSlot, 
  onSelect,
  timezone = "ET"
}: MeetingTimeSelectorProps) {
  const formatSlotDisplay = (slot: TimeSlot): string => {
    // Handle ISO format slots from suggest-meeting-times
    if (slot.start && slot.end) {
      try {
        const startDate = parseISO(slot.start);
        const endDate = parseISO(slot.end);
        const dateStr = format(startDate, "EEEE, MMM d");
        const startTimeStr = format(startDate, "h:mm a");
        const endTimeStr = format(endDate, "h:mm a");
        return `${dateStr} at ${startTimeStr} - ${endTimeStr} ${timezone}`;
      } catch {
        // Fallback if parsing fails
      }
    }
    
    // Handle legacy format with date/time strings
    if (slot.date && slot.time) {
      return `${slot.date} at ${slot.time} ${timezone}`;
    }
    
    return "Time slot";
  };

  const getSlotKey = (slot: TimeSlot): string => {
    return slot.start || `${slot.date}-${slot.time}`;
  };

  const getDuration = (slot: TimeSlot): string => {
    if (slot.duration) return slot.duration;
    
    if (slot.start && slot.end) {
      try {
        const startDate = parseISO(slot.start);
        const endDate = parseISO(slot.end);
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));
        return `${diffMins} min`;
      } catch {
        return "30 min";
      }
    }
    
    return "30 min";
  };

  if (!slots || slots.length === 0) {
    return null;
  }

  return (
    <div className="bg-info/5 border border-info/20 rounded-xl p-4">
      <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-info" />
        Select a Meeting Time
      </h4>
      
      <RadioGroup
        value={selectedSlot ? getSlotKey(selectedSlot) : ""}
        onValueChange={(value) => {
          const slot = slots.find(s => getSlotKey(s) === value);
          if (slot) onSelect(slot);
        }}
        className="space-y-2"
      >
        {slots.map((slot, index) => {
          const slotKey = getSlotKey(slot);
          const isSelected = selectedSlot && getSlotKey(selectedSlot) === slotKey;
          
          return (
            <div
              key={slotKey}
              className={`
                flex items-center space-x-3 bg-background rounded-lg px-4 py-3 
                cursor-pointer transition-all border-2
                ${isSelected 
                  ? 'border-info bg-info/5 shadow-sm' 
                  : 'border-transparent hover:border-info/30 hover:bg-info/5'
                }
              `}
              onClick={() => onSelect(slot)}
            >
              <RadioGroupItem value={slotKey} id={`slot-${index}`} />
              <Label 
                htmlFor={`slot-${index}`} 
                className="flex-1 cursor-pointer flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatSlotDisplay(slot)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getDuration(slot)}
                  </Badge>
                  {isSelected && (
                    <Check className="w-4 h-4 text-info" />
                  )}
                </div>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
