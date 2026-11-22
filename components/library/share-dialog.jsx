"use client";

import { useSyncExternalStore, useState } from "react";
import { Check, Copy, Globe2, Link2, Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { updateShareSettings } from "@/app/actions/papers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useOrigin() {
  return useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => ""
  );
}

export function ShareDialog({ paper, open, onOpenChange, onSaved }) {
  const [enabled, setEnabled] = useState(paper?.visibility !== "private");
  const [isPublic, setIsPublic] = useState(paper?.visibility === "public");
  const [senderNote, setSenderNote] = useState(paper?.sender_note || "");
  const [shareSlug, setShareSlug] = useState(paper?.share_slug || "");
  const origin = useOrigin();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareSlug
    ? origin
      ? `${origin}/s/${shareSlug}`
      : `/s/${shareSlug}`
    : "";

  async function handleSave() {
    if (!paper?.id) return;
    setSaving(true);
    const visibility = !enabled ? "private" : isPublic ? "public" : "unlisted";
    const result = await updateShareSettings({
      paperId: paper.id,
      visibility,
      senderNote: senderNote.trim() || null,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error || "Could not update sharing.");
      return;
    }

    setShareSlug(result.shareSlug);
    setEnabled(result.visibility !== "private");
    setIsPublic(result.visibility === "public");
    toast.success(
      result.visibility === "private"
        ? "Sharing turned off. The old link no longer works."
        : "Share settings saved."
    );
    onSaved?.(result);
  }

  async function handleCopy() {
    if (!shareSlug) return;
    const url = `${window.location.origin}/s/${shareSlug}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      toast.success("Share link copied.");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5 text-primary" />
            Share test
          </DialogTitle>
          <DialogDescription>
            Send a clean student-mode link. Recipients can take the test without an
            account and their answers stay in their browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-background text-primary shadow-sm">
                {enabled ? <Globe2 className="size-4" /> : <Lock className="size-4" />}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {enabled ? "Share link is active" : "Sharing is off"}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {enabled
                    ? isPublic
                      ? "Anyone with the link can take the test, and it is also visible in the public paper library."
                      : "Only people with the exact link can take the test. It is not listed anywhere."
                    : "Turning sharing off makes the existing link stop working immediately."}
                </p>
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Enable share link"
            />
          </div>

          {enabled && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-medium">List in public library</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Public papers can be discovered by other signed-in users.
                </p>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
                aria-label="List paper publicly"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="share-url">Share URL</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                readOnly
                value={enabled ? shareUrl : "Turn on sharing to create a link"}
                className="font-mono text-xs"
                onFocus={(event) => event.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                disabled={!enabled || !shareUrl}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender-note">
              <span className="inline-flex items-center gap-1.5">
                <Send className="size-3.5" />
                Sender note (optional)
              </span>
            </Label>
            <Textarea
              id="sender-note"
              value={senderNote}
              onChange={(event) => setSenderNote(event.target.value)}
              placeholder="e.g. Attempt Section A and B today. Bring your answers to class on Monday."
              maxLength={1000}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Shown as a dismissible banner at the top of the shared test. Rendered as
              plain text, never HTML.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save sharing settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
