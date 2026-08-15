import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORY_LABEL, type PhotoCategory } from "@/lib/repair-photos";

export interface PhotoItem {
  id: string;
  url: string;
  category: PhotoCategory;
  createdAt: string;
}

/** Shared responsive gallery, grouped by category, with a lightbox preview. */
export function RepairPhotoGrid({
  photos,
  onDelete,
  deletingId,
}: {
  photos: PhotoItem[];
  onDelete?: (photo: PhotoItem) => void;
  deletingId?: string | null;
}) {
  const [preview, setPreview] = useState<PhotoItem | null>(null);
  const [confirm, setConfirm] = useState<PhotoItem | null>(null);

  const order: PhotoCategory[] = ["before", "during", "after"];
  const groups = order
    .map((c) => ({ category: c, items: photos.filter((p) => p.category === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.category}>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABEL[g.category]} · {g.items.length}
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((p) => (
              <li key={p.id} className="group relative overflow-hidden rounded-lg border border-border bg-muted/30">
                <button
                  type="button"
                  onClick={() => setPreview(p)}
                  className="block aspect-square w-full"
                  aria-label={`View ${CATEGORY_LABEL[p.category]} photo`}
                >
                  <img
                    src={p.url}
                    alt={`${CATEGORY_LABEL[p.category]} photo`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </button>
                {onDelete && (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute right-1.5 top-1.5 h-7 w-7 opacity-90"
                    disabled={deletingId === p.id}
                    onClick={() => setConfirm(p)}
                    aria-label="Delete photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview ? CATEGORY_LABEL[preview.category] : "Photo"}</DialogTitle>
            <DialogDescription>
              {preview ? new Date(preview.createdAt).toLocaleString() : null}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <img
              src={preview.url}
              alt={`${CATEGORY_LABEL[preview.category]} photo, full size`}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this photo?</DialogTitle>
            <DialogDescription>
              The image will be permanently removed from this repair record. The receipt itself is
              unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm && onDelete) onDelete(confirm);
                setConfirm(null);
              }}
            >
              Delete photo
            </Button>
          </DialogFooter>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
