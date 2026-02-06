import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

interface DeleteOldEmailsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteOldEmailsModal({ open, onClose, onSuccess }: DeleteOldEmailsModalProps) {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Please type DELETE to confirm.",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffISO = cutoffDate.toISOString();

      // First, get message IDs to delete (for cascade cleanup)
      const { data: messagesToDelete, error: fetchError } = await supabase
        .from("messages")
        .select("id")
        .lt("received_at", cutoffISO);

      if (fetchError) throw fetchError;

      if (!messagesToDelete || messagesToDelete.length === 0) {
        toast({
          title: "No emails to delete",
          description: `No emails found older than ${days} days.`,
        });
        setDeleting(false);
        return;
      }

      const messageIds = messagesToDelete.map(m => m.id);

      // Delete related records first (classifications, proposals, outcomes)
      // These should cascade, but let's be explicit
      await supabase.from("outcomes").delete().in("message_id", messageIds);
      await supabase.from("proposals").delete().in("message_id", messageIds);
      await supabase.from("classifications").delete().in("message_id", messageIds);

      // Delete the messages
      const { error: deleteError } = await supabase
        .from("messages")
        .delete()
        .lt("received_at", cutoffISO);

      if (deleteError) throw deleteError;

      toast({
        title: "Emails deleted",
        description: `Successfully deleted ${messageIds.length} email(s) older than ${days} days.`,
      });

      setConfirmText("");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error deleting emails:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete emails",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete Old Emails
          </DialogTitle>
          <DialogDescription>
            Permanently delete emails older than the specified number of days.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="days">Delete emails older than (days)</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Emails received before {new Date(Date.now() - days * 24 * 60 * 60 * 1000).toLocaleDateString()} will be deleted.
            </p>
          </div>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">This is permanent</p>
                <p className="text-muted-foreground">
                  All related classifications, proposals, and outcomes will also be deleted.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Type DELETE to confirm</Label>
            <Input
              id="confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || confirmText !== "DELETE"}
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Emails
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
