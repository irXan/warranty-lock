import { Camera } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listPublicRepairPhotos } from "@/lib/repair-photos.functions";
import type { PhotoCategory } from "@/lib/repair-photos";
import { RepairPhotoGrid, type PhotoItem } from "./RepairPhotoGrid";

/** Read-only photo section on the public tracking view. Hidden when empty. */
export function CustomerRepairPhotos({ trackId }: { trackId: string }) {
  const { data: photos = [] } = useQuery({
    queryKey: ["warranty", "public-photos", trackId.toUpperCase()],
    queryFn: () => listPublicRepairPhotos({ data: { trackId } }),
  });

  if (photos.length === 0) return null;

  const items: PhotoItem[] = photos.map((p) => ({
    id: p.id,
    url: p.url,
    category: p.category as PhotoCategory,
    createdAt: p.created_at,
  }));

  return (
    <div className="pt-2">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Camera className="h-4 w-4 text-primary" />
        Repair photos
      </h3>
      <RepairPhotoGrid photos={items} />
    </div>
  );
}
