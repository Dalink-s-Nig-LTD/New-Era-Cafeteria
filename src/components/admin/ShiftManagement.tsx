import React, { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShiftConfig {
  shift: "morning" | "afternoon" | "evening";
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  isEnabled: boolean;
}

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

const SHIFT_COLORS: Record<string, string> = {
  morning: "bg-amber-500/10 border-amber-500/30",
  afternoon: "bg-blue-500/10 border-blue-500/30",
  evening: "bg-purple-500/10 border-purple-500/30",
};

export function ShiftManagement() {
  const { toast } = useToast();
  const shiftSettings = useQuery(api.shiftSettings.getShiftSettings);
  const updateShift = useMutation(api.shiftSettings.updateShiftSettings);
  const seedDefaults = useMutation(api.shiftSettings.seedDefaultShifts);

  const [localShifts, setLocalShifts] = useState<ShiftConfig[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  // Seed defaults on first load if empty
  useEffect(() => {
    if (shiftSettings && shiftSettings.length === 0) {
      seedDefaults().then(() => {
        toast({ title: "Default shift settings created" });
      });
    }
  }, [shiftSettings]);

  // Sync from DB
  useEffect(() => {
    if (shiftSettings && shiftSettings.length > 0) {
      setLocalShifts(
        shiftSettings.map((s) => ({
          shift: s.shift,
          startHour: s.startHour,
          startMinute: s.startMinute,
          endHour: s.endHour,
          endMinute: s.endMinute,
          isEnabled: s.isEnabled,
        }))
      );
    }
  }, [shiftSettings]);

  const handleChange = (
    shift: string,
    field: keyof ShiftConfig,
    value: number | boolean
  ) => {
    setLocalShifts((prev) =>
      prev.map((s) => (s.shift === shift ? { ...s, [field]: value } : s))
    );
  };

  const handleToggle = async (shift: string, enabled: boolean) => {
    // Update local state immediately for responsive UI
    setLocalShifts((prev) =>
      prev.map((s) => (s.shift === shift ? { ...s, isEnabled: enabled } : s))
    );
    // Find current config and save to DB immediately
    const config = localShifts.find((s) => s.shift === shift);
    if (config) {
      try {
        await updateShift({ ...config, isEnabled: enabled });
        toast({
          title: `${SHIFT_LABELS[shift]} shift ${enabled ? "enabled" : "disabled"}`,
        });
      } catch (e: unknown) {
        // Revert on error
        setLocalShifts((prev) =>
          prev.map((s) => (s.shift === shift ? { ...s, isEnabled: !enabled } : s))
        );
        toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
      }
    }
  };

  const handleSave = async (config: ShiftConfig) => {
    setSaving(config.shift);
    try {
      await updateShift(config);
      toast({
        title: "Shift updated",
        description: `${SHIFT_LABELS[config.shift]} shift settings saved.`,
      });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const formatTime = (h: number, m: number) => {
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  };

  if (!shiftSettings) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Loading shift settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Shift Management</h2>
          <p className="text-sm text-muted-foreground">
            Configure shift times and enable/disable shifts across the entire app.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {localShifts
          .sort((a, b) => {
            const order = { morning: 0, afternoon: 1, evening: 2 };
            return order[a.shift] - order[b.shift];
          })
          .map((config) => (
            <Card
              key={config.shift}
              className={`${SHIFT_COLORS[config.shift]} ${!config.isEnabled ? "opacity-60" : ""}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {SHIFT_LABELS[config.shift]}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.isEnabled ? "default" : "secondary"}>
                      {config.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Switch
                      checked={config.isEnabled}
                      onCheckedChange={(v) =>
                        handleToggle(config.shift, v)
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Start Hour
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={config.startHour}
                      onChange={(e) =>
                        handleChange(config.shift, "startHour", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Start Minute
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={config.startMinute}
                      onChange={(e) =>
                        handleChange(config.shift, "startMinute", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      End Hour
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={config.endHour}
                      onChange={(e) =>
                        handleChange(config.shift, "endHour", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      End Minute
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={config.endMinute}
                      onChange={(e) =>
                        handleChange(config.shift, "endMinute", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>

                <div className="text-sm text-muted-foreground text-center">
                  {formatTime(config.startHour, config.startMinute)} –{" "}
                  {formatTime(config.endHour, config.endMinute)}
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={() => handleSave(config)}
                  disabled={saving === config.shift}
                >
                  <Save className="w-4 h-4" />
                  {saving === config.shift ? "Saving..." : "Save"}
                </Button>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
