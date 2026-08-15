import { useRef, useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCEPT_ATTR,
  PHOTO_CATEGORIES,
  deleteRepairPhoto,
  listRepairPhotos,
  repairPhotosQueryKey,
  uploadRepairPhoto,
  validateImage,
  type PhotoCategory,
  type RepairPhoto,
} from "@/lib/repair-photos";
import { RepairPhotoGrid, type PhotoItem } from "./RepairPhotoGrid";

/** Workshop-side repair photo manager, rendered inside an existing job card. */
export function RepairPhotos({
  receiptId,
  workshopId,
}: {
  receiptId: string;
  workshopId: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<PhotoCategory>("before");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: repairPhotosQueryKey(receiptId),
    queryFn: () => listRepairPhotos(receiptId),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      setProgress({ done: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        await uploadRepairPhoto({ receiptId, workshopId, category, file: files[i]! });
        setProgress({ done: i + 1, total: files.length });
      }
    },
    onSuccess: (_d, files) => {
      toast.success(`${files.length} photo${files.length === 1 ? "" : "s"} uploaded`);
      void qc.invalidateQueries({ queryKey: repairPhotosQueryKey(receiptId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
    onSettled: () => setProgress(null),
  });

  const remove = useMutation({
    mutationFn: async (photo: RepairPhoto) => {
      setDeletingId(photo.id);
      await deleteRepairPhoto(photo);
    },
    onSuccess: () => {
      toast.success("Photo deleted");
      void qc.invalidateQueries({ queryKey: repairPhotosQueryKey(receiptId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    onSettled: () => setDeletingId(null),
  });

  const onPick = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files: File[] = [];
    for (const f of Array.from(fileList)) {
      const err = validateImage(f);
      if (err) toast.error(err);
      else files.push(f);
    }
    if (files.length > 0) upload.mutate(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  const items: PhotoItem[] = photos.map((p) => ({
    id: p.id,
    url: p.url,
    category: p.category,
    createdAt: p.createdAt,
  }));

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Camera className="h-4 w-4 text-primary" />
          Repair photos
          <span className="text-xs font-normal text-muted-foreground">
            {photos.length > 0 ? `· ${photos.length}` : "· none yet"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as PhotoCategory)}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 whitespace-nowrap"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {upload.isPending && progress
              ? `Uploading ${progress.done}/${progress.total}…`
              : "Add photos"}
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading photos…</p>
        ) : photos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            JPG, PNG or WebP up to 15 MB. Images are resized before upload.
          </p>
        ) : (
          <RepairPhotoGrid
            photos={items}
            deletingId={deletingId}
            onDelete={(item) => {
              const full = photos.find((p) => p.id === item.id);
              if (full) remove.mutate(full);
            }}
          />
        )}
      </div>
    </div>
  );
}
