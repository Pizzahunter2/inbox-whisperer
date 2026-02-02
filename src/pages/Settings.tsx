import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { ConnectedAccounts } from "@/components/settings/ConnectedAccounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Download, Trash2, AlertTriangle } from "lucide-react";

interface Profile {
  reply_tone: "neutral" | "friendly" | "formal";
  signature: string;
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  meeting_min_notice_hours: number;
  meeting_default_duration: number;
  auto_suggest_slots: boolean;
  auto_archive_newsletters: boolean;
  flag_invoices: boolean;
  demo_mode: boolean;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile>({
    reply_tone: "neutral" as const,
    signature: "",
    timezone: "America/New_York",
    working_hours_start: "09:00",
    working_hours_end: "17:00",
    meeting_min_notice_hours: 24,
    meeting_default_duration: 30,
    auto_suggest_slots: true,
    auto_archive_newsletters: false,
    flag_invoices: true,
    demo_mode: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setProfile({
          reply_tone: (data.reply_tone || "neutral") as "neutral" | "friendly" | "formal",
          signature: data.signature || "",
          timezone: data.timezone || "America/New_York",
          working_hours_start: data.working_hours_start || "09:00",
          working_hours_end: data.working_hours_end || "17:00",
          meeting_min_notice_hours: data.meeting_min_notice_hours || 24,
          meeting_default_duration: data.meeting_default_duration || 30,
          auto_suggest_slots: data.auto_suggest_slots ?? true,
          auto_archive_newsletters: data.auto_archive_newsletters ?? false,
          flag_invoices: data.flag_invoices ?? true,
          demo_mode: data.demo_mode ?? true,
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(profile)
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const { data: messages } = await supabase
        .from("messages")
        .select("*, classifications(*), proposals(*), outcomes(*)");

      const exportData = {
        user: {
          email: user?.email,
          created_at: user?.created_at,
        },
        profile,
        messages,
        exported_at: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inbox-middleman-export.json";
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Data exported",
        description: "Your data has been downloaded as JSON.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar 
        user={user}
        pendingCount={0}
        completedCount={0}
        onSignOut={handleSignOut}
        onAddEmail={() => navigate("/dashboard")}
      />
      
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 pb-12">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Manage your preferences and account</p>
          </div>

          <div className="space-y-6">
            {/* Connected Accounts */}
            <ConnectedAccounts />
            {/* Reply Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Reply Preferences</CardTitle>
                <CardDescription>
                  Customize how AI-generated replies should sound
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Reply Tone</Label>
                  <Select
                    value={profile.reply_tone}
                    onValueChange={(value: "neutral" | "friendly" | "formal") => setProfile({ ...profile, reply_tone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default Signature</Label>
                  <Textarea
                    value={profile.signature}
                    onChange={(e) => setProfile({ ...profile, signature: e.target.value })}
                    placeholder="Best regards,&#10;Your Name"
                    className="min-h-24"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card>
              <CardHeader>
                <CardTitle>Working Hours</CardTitle>
                <CardDescription>
                  Used for meeting slot suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={profile.working_hours_start}
                      onChange={(e) => setProfile({ ...profile, working_hours_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={profile.working_hours_end}
                      onChange={(e) => setProfile({ ...profile, working_hours_end: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Meeting Notice (hours)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={profile.meeting_min_notice_hours}
                      onChange={(e) => setProfile({ ...profile, meeting_min_notice_hours: parseInt(e.target.value) || 24 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Meeting Duration (min)</Label>
                    <Input
                      type="number"
                      min={15}
                      step={15}
                      value={profile.meeting_default_duration}
                      onChange={(e) => setProfile({ ...profile, meeting_default_duration: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Auto-suggest Time Slots</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically suggest available times for meeting requests
                    </p>
                  </div>
                  <Switch
                    checked={profile.auto_suggest_slots}
                    onCheckedChange={(checked) => setProfile({ ...profile, auto_suggest_slots: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Auto Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Automation Rules</CardTitle>
                <CardDescription>
                  Configure automatic actions for certain email types
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Auto-archive Newsletters</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically archive emails detected as newsletters
                    </p>
                  </div>
                  <Switch
                    checked={profile.auto_archive_newsletters}
                    onCheckedChange={(checked) => setProfile({ ...profile, auto_archive_newsletters: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Flag Invoices</Label>
                    <p className="text-sm text-muted-foreground">
                      Highlight emails that contain invoices or payment requests
                    </p>
                  </div>
                  <Switch
                    checked={profile.flag_invoices}
                    onCheckedChange={(checked) => setProfile({ ...profile, flag_invoices: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save button */}
            <div className="flex justify-end">
              <Button variant="action" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>

            {/* Data Management */}
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                  Export or delete your data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="w-4 h-4" />
                  Export All Data (JSON)
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" disabled>
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Account deletion is not available in demo mode.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
