"use client";

import { useState, useRef, useCallback } from "react";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { projectAttachmentCategoryValues } from "@/lib/validations/attachment";
import { attachmentCategoryLabel } from "@/lib/projects/attachment-labels";
import type { ProjectAttachmentCategory } from "@/types/project";

type AttachmentRecord = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  category: ProjectAttachmentCategory;
  createdAt: string;
  user: { name: string } | null;
};

type ProjectAttachmentUploadProps = {
  projectId: string;
  initialAttachments: AttachmentRecord[];
};

export function ProjectAttachmentUpload({ projectId, initialAttachments }: ProjectAttachmentUploadProps) {
  const [attachments, setAttachments] = useState<AttachmentRecord[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ProjectAttachmentCategory>("OTRO");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError("");

      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("category", selectedCategory);

        const response = await fetch(`/api/projects/${projectId}/attachments`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al subir el archivo");
        }

        const created = await response.json();
        setAttachments((prev) => [created, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir el archivo");
      } finally {
        setUploading(false);
      }
    },
    [projectId, selectedCategory],
  );

  const deleteAttachment = useCallback(
    async (attachmentId: string) => {
      try {
        const response = await fetch(`/api/projects/${projectId}/attachments`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al eliminar el archivo");
        }

        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar el archivo");
      }
    },
    [projectId],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void uploadFile(file);
      event.target.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
            Categoría
          </Label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ProjectAttachmentCategory)}
            className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-sm"
          >
            {projectAttachmentCategoryValues.map((cat) => (
              <option key={cat} value={cat}>
                {attachmentCategoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.doc,.xls,.jpg,.jpeg,.png,.webp,.dwg,.rvt,.rfa,.txt,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Subiendo..." : "Subir archivo"}
          </Button>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-[var(--app-border)] bg-[var(--app-surface)]"
        }`}
      >
        <Paperclip className="mx-auto mb-2 h-5 w-5 text-[var(--app-text-muted)]" />
        <p className="text-sm text-[var(--app-text-muted)]">
          Arrastra y suelta archivos aquí o usa el botón superior
        </p>
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
          PDF, Word, Excel, imágenes, DWG, RVT, TXT, CSV — máx. 50 MB
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
            Archivos adjuntos ({attachments.length})
          </Label>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {attachments.map((attachment) => (
              <AttachmentRow
                key={attachment.id}
                attachment={attachment}
                onDelete={() => deleteAttachment(attachment.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-[var(--app-text-muted)]">
          No hay archivos adjuntos en este proyecto.
        </p>
      )}
    </div>
  );
}

function AttachmentRow({
  attachment,
  onDelete,
}: {
  attachment: AttachmentRecord;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--app-border)] px-3 py-2">
      <FileText className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={attachment.filePath}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-medium text-blue-600 hover:underline"
          >
            {attachment.fileName}
          </a>
          <span className="shrink-0 rounded-full bg-[var(--app-surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase text-[var(--app-text-muted)]">
            {attachmentCategoryLabel(attachment.category)}
          </span>
        </div>
        <p className="text-xs text-[var(--app-text-muted)]">
          {formatFileSize(attachment.fileSize)}
          {attachment.user ? ` · subido por ${attachment.user.name}` : ""}
        </p>
      </div>
      <Button
        type="button"          variant="ghost"
          className="h-7 w-7 shrink-0 text-[var(--app-text-muted)] hover:text-red-600"
        onClick={onDelete}
        title="Eliminar archivo"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
