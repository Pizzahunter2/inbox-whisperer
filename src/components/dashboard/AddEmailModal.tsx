import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Sparkles } from "lucide-react";

interface AddEmailModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddEmailModal({ open, onClose, onSuccess }: AddEmailModalProps) {
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("messages")
        .insert({
          user_id: user.id,
          from_name: fromName || null,
          from_email: fromEmail,
          subject,
          body_snippet: body.substring(0, 200),
          body_full: body,
          is_demo: true,
        });

      if (error) throw error;

      toast({
        title: "Email added",
        description: "Demo email has been added to your queue.",
      });

      // Reset form
      setFromName("");
      setFromEmail("");
      setSubject("");
      setBody("");
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDemoEmails = async () => {
    setSeeding(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const demoEmails = [
        {
          from_name: "Dr. Sarah Chen",
          from_email: "s.chen@university.edu",
          subject: "Re: Thesis Defense Schedule",
          body_full: `Hi,

I hope this email finds you well. I wanted to follow up on scheduling your thesis defense. Based on my availability, I can do the following dates:

- February 15th, 2-4 PM
- February 18th, 10 AM - 12 PM  
- February 20th, 3-5 PM

Please let me know which works best for you, and I'll coordinate with the other committee members.

Also, please remember to submit your final draft at least two weeks before the defense date.

Best regards,
Dr. Sarah Chen
Professor of Computer Science`,
        },
        {
          from_name: "TechCorp Newsletter",
          from_email: "newsletter@techcorp.io",
          subject: "This Week in Tech: AI Breakthroughs & More",
          body_full: `Welcome to this week's TechCorp newsletter!

🚀 TOP STORIES

1. New AI Model Breaks Performance Records
Leading researchers announce a breakthrough in language understanding...

2. Startup Raises $50M for Climate Tech
Innovative solution promises to reduce carbon emissions by 40%...

3. Cybersecurity Alert: Update Your Systems
Critical vulnerability discovered in popular software...

📅 UPCOMING EVENTS

Tech Summit 2026 - March 15-17
Early bird tickets still available!

Thanks for reading!
The TechCorp Team

Unsubscribe | Manage Preferences`,
        },
        {
          from_name: "Mike Johnson",
          from_email: "mike.j@clientcorp.com",
          subject: "Urgent: Q1 Report Review Needed",
          body_full: `Hi there,

I need your review on the Q1 financial report before our board meeting on Friday. 

Key points that need attention:
- Revenue projections on page 12
- Marketing spend analysis (section 4.2)
- Customer acquisition costs comparison

The deadline for feedback is Wednesday EOD. Please prioritize this if possible.

Let me know if you have any questions.

Thanks,
Mike Johnson
VP of Finance
ClientCorp`,
        },
        {
          from_name: "Accounts Payable",
          from_email: "ap@vendor-systems.com",
          subject: "Invoice #INV-2026-0234 - Payment Due",
          body_full: `Dear Customer,

Please find attached Invoice #INV-2026-0234 for services rendered in January 2026.

Invoice Details:
- Amount Due: $3,450.00
- Due Date: February 15, 2026
- Services: Software Licensing & Support

Payment Methods:
- Bank Transfer (details in attachment)
- Credit Card via our portal

If you have any questions about this invoice, please reply to this email or call our billing department at 1-800-555-0199.

Thank you for your business!

Accounts Payable Department
Vendor Systems Inc.`,
        },
        {
          from_name: "Alex Rivera",
          from_email: "alex.r@partnerfirm.com",
          subject: "Coffee chat next week?",
          body_full: `Hey!

It's been a while since we caught up. I'll be in your area next week for a conference and thought it would be great to grab coffee.

I'm free Tuesday afternoon or Thursday morning. Does either work for you?

Also, I'd love to hear about that new project you mentioned at the last meetup. Sounds really interesting!

Let me know,
Alex`,
        },
        {
          from_name: "HR Department",
          from_email: "hr@mycompany.com",
          subject: "Reminder: Annual Benefits Enrollment Deadline",
          body_full: `Dear Employee,

This is a reminder that the annual benefits enrollment period ends on February 10, 2026.

Please review and update your selections for:
✓ Health Insurance
✓ Dental & Vision
✓ Life Insurance
✓ 401(k) Contributions
✓ Flexible Spending Accounts

If you do not make changes, your current elections will continue for the next year.

Log in to the employee portal to review your options: portal.mycompany.com

Questions? Contact HR at hr@mycompany.com or ext. 2100.

Best,
Human Resources`,
        },
        {
          from_name: "Product Team",
          from_email: "product@saas-tool.com",
          subject: "New Feature: Advanced Analytics Dashboard",
          body_full: `Hi there,

We're excited to announce a new feature in your SaaS Tool subscription!

🎉 Advanced Analytics Dashboard

Now you can:
• Track custom metrics in real-time
• Create automated reports
• Set up intelligent alerts
• Export data in multiple formats

This feature is now available in your account at no extra cost.

Check it out: dashboard.saas-tool.com/analytics

As always, we'd love your feedback!

The Product Team`,
        },
        {
          from_name: "Jennifer Walsh",
          from_email: "jennifer.w@techstartup.io",
          subject: "Partnership Opportunity Discussion",
          body_full: `Hello,

I'm the Business Development lead at TechStartup and I came across your company's work in the AI space. 

We're building a platform that I think could really complement what you're doing, and I'd love to explore potential partnership opportunities.

Would you have 30 minutes next week for a quick intro call? I'm flexible on timing.

Here's what I'd like to discuss:
1. Brief overview of our platform
2. Potential integration points
3. Co-marketing opportunities

Let me know if you're interested!

Best regards,
Jennifer Walsh
Business Development Lead
TechStartup.io`,
        },
      ];

      const emailsWithUserId = demoEmails.map(email => ({
        ...email,
        user_id: user.id,
        body_snippet: email.body_full.substring(0, 200),
        is_demo: true,
      }));

      const { error } = await supabase
        .from("messages")
        .insert(emailsWithUserId);

      if (error) throw error;

      toast({
        title: "Demo emails added",
        description: `${demoEmails.length} sample emails have been added to your queue.`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to seed demo emails",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-accent" />
            Add Demo Email
          </DialogTitle>
          <DialogDescription>
            Add a sample email to test the AI processing, or seed your queue with realistic examples.
          </DialogDescription>
        </DialogHeader>

        {/* Quick seed button */}
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Quick Start</p>
              <p className="text-sm text-muted-foreground">
                Add 8 realistic sample emails instantly
              </p>
            </div>
            <Button 
              variant="action"
              onClick={handleSeedDemoEmails}
              disabled={seeding}
            >
              {seeding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Seed Emails
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or add custom</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">Sender Name</Label>
              <Input
                id="fromName"
                placeholder="John Doe"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">Sender Email *</Label>
              <Input
                id="fromEmail"
                type="email"
                placeholder="john@example.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Meeting request for next week"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body *</Label>
            <Textarea
              id="body"
              placeholder="Paste the email content here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              className="min-h-32"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="action" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Email"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
