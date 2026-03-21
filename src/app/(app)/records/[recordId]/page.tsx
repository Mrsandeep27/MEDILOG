"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Trash2,
  Edit,
  Calendar,
  User,
  Hospital,
  Stethoscope,
  Tag,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppHeader } from "@/components/layout/app-header";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useRecord, useRecords, getRecordImageUrls } from "@/hooks/use-records";
import { useMedicines } from "@/hooks/use-medicines";
import { useMember } from "@/hooks/use-members";
import { RECORD_TYPE_LABELS, FREQUENCY_LABELS } from "@/constants/config";

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = use(params);
  const router = useRouter();
  const { record, isLoading } = useRecord(recordId);
  const { deleteRecord } = useRecords();
  const { medicines } = useMedicines(undefined, recordId);
  const { member } = useMember(record?.member_id || "");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Generate blob URLs on-demand from stored blobs (survives page reload)
  const imageUrls = record ? getRecordImageUrls(record) : [];

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Record" showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  if (!record) {
    return (
      <div>
        <AppHeader title="Record" showBack />
        <p className="p-4 text-center text-muted-foreground">Record not found</p>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteRecord(recordId);
      toast.success("Record deleted");
      router.push("/records");
    } catch {
      toast.error("Failed to delete record");
    }
  };

  const date = record.visit_date
    ? new Date(record.visit_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <AppHeader
        title="Record Details"
        showBack
        rightAction={
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => router.push(`/records/${recordId}/edit`)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger
                render={<Button size="icon" variant="ghost" />}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Record?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete this health record. This action
                    cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="p-4 space-y-4">
        {/* Title & Type */}
        <div>
          <Badge className="mb-2">{RECORD_TYPE_LABELS[record.type]}</Badge>
          <h1 className="text-xl font-bold">{record.title}</h1>
        </div>

        {/* Details Grid */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {member && (
              <DetailRow icon={User} label="Patient" value={member.name} />
            )}
            {date && <DetailRow icon={Calendar} label="Visit Date" value={date} />}
            {record.doctor_name && (
              <DetailRow
                icon={Stethoscope}
                label="Doctor"
                value={`Dr. ${record.doctor_name}`}
              />
            )}
            {record.hospital_name && (
              <DetailRow
                icon={Hospital}
                label="Hospital"
                value={record.hospital_name}
              />
            )}
            {record.diagnosis && (
              <DetailRow
                icon={Stethoscope}
                label="Diagnosis"
                value={record.diagnosis}
              />
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {record.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {record.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {(record.tags?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {record.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Medicines */}
        {medicines.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Medicines ({medicines.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {medicines.map((med) => (
                <div
                  key={med.id}
                  className="flex items-start justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{med.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {med.dosage && <span>{med.dosage}</span>}
                      {med.frequency && (
                        <span>
                          {FREQUENCY_LABELS[med.frequency] || med.frequency}
                        </span>
                      )}
                      {med.before_food && <Badge variant="outline" className="text-[10px]">Before food</Badge>}
                    </div>
                  </div>
                  <Badge variant={med.is_active ? "default" : "secondary"}>
                    {med.is_active ? "Active" : "Completed"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Images */}
        {imageUrls.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Photos ({imageUrls.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(url)}
                    className="aspect-square rounded-lg overflow-hidden border"
                  >
                    <img
                      src={url}
                      alt={`Document ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Image Viewer Dialog */}
        <Dialog
          open={!!selectedImage}
          onOpenChange={() => setSelectedImage(null)}
        >
          <DialogContent className="max-w-[95vw] max-h-[90vh] p-2">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Document"
                className="w-full h-full object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
