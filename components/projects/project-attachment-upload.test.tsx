/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

global.fetch = mocks.fetch;

vi.mock("@/lib/validations/attachment", () => ({
  projectAttachmentCategoryValues: ["PLANO", "ESPECIFICACION", "CONTRATO", "MEMORIA", "FOTO", "OTRO"] as const,
}));

vi.mock("@/lib/projects/attachment-labels", () => ({
  attachmentCategoryLabel: (category: string) => {
    const map: Record<string, string> = {
      PLANO: "Plano",
      ESPECIFICACION: "Especificación",
      CONTRATO: "Contrato",
      MEMORIA: "Memoria",
      FOTO: "Foto",
      OTRO: "Otro",
    };
    return map[category] ?? category;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    className,
    title,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
    variant?: string;
    size?: string;
    className?: string;
    title?: string;
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={className} title={title}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}));

vi.mock("lucide-react", () => ({
  FileText: ({ className }: { className?: string }) => <span data-testid="icon-file-text" className={className} />,
  Paperclip: ({ className }: { className?: string }) => <span data-testid="icon-paperclip" className={className} />,
  Trash2: ({ className }: { className?: string }) => <span data-testid="icon-trash" className={className} />,
  Upload: ({ className }: { className?: string }) => <span data-testid="icon-upload" className={className} />,
  ChevronDown: ({ className }: { className?: string }) => <span data-testid="icon-chevron-down" className={className} />,
}));

import { ProjectAttachmentUpload } from "@/components/projects/project-attachment-upload";

function createAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    fileName: "plano-estructural.pdf",
    fileType: "application/pdf",
    fileSize: 2048000,
    filePath: "/uploads/project-attachments/proj-1/plano-estructural.pdf",
    category: "PLANO" as const,
    createdAt: "2026-07-10T00:00:00.000Z",
    user: { name: "Maria Lopez" },
    ...overrides,
  };
}

describe("ProjectAttachmentUpload", () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe("initial render", () => {
    it("starts collapsed and expands on toggle", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);

      const toggle = screen.getByRole("button", { name: /Archivos adjuntos/ });
      const content = document.getElementById("archivos-contenido");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(content?.hidden).toBe(true);

      fireEvent.click(toggle);

      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(content?.hidden).toBe(false);
    });

    it("renders the category selector with all options and OTRO selected by default", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);
      fireEvent.click(screen.getByRole("button", { name: /Archivos adjuntos/ }));

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select).toBeTruthy();
      expect(select.value).toBe("OTRO");
      expect(screen.getByText("Plano")).toBeTruthy();
      expect(screen.getByText("Especificación")).toBeTruthy();
      expect(screen.getByText("Contrato")).toBeTruthy();
      expect(screen.getByText("Memoria")).toBeTruthy();
      expect(screen.getByText("Foto")).toBeTruthy();
      expect(screen.getByText("Otro")).toBeTruthy();
    });

    it("renders the upload button after expanding the section", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);
      fireEvent.click(screen.getByRole("button", { name: /Archivos adjuntos/ }));

      expect(screen.getByText("Subir archivo")).toBeTruthy();
      expect(screen.getByTestId("icon-upload")).toBeTruthy();
    });

    it("renders the drag and drop zone after expanding the section", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);
      fireEvent.click(screen.getByRole("button", { name: /Archivos adjuntos/ }));

      expect(screen.getByText("Arrastra y suelta archivos aquí o usa el botón superior")).toBeTruthy();
      expect(screen.getByText(/PDF, Word, Excel/)).toBeTruthy();
      expect(screen.getByTestId("icon-paperclip")).toBeTruthy();
    });

    it("shows empty state after expanding when no attachments are provided", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);
      fireEvent.click(screen.getByRole("button", { name: /Archivos adjuntos/ }));

      expect(screen.getByText("No hay archivos adjuntos en este proyecto.")).toBeTruthy();
    });

    it("renders the initial attachments list", () => {
      const attachments = [
        createAttachment({ id: "att-1", fileName: "plano.pdf" }),
        createAttachment({ id: "att-2", fileName: "contrato.docx", category: "CONTRATO" }),
      ];

      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={attachments} />);

      expect(screen.getByText("plano.pdf")).toBeTruthy();
      expect(screen.getByText("contrato.docx")).toBeTruthy();
      expect(screen.getByText("Archivos adjuntos (2)")).toBeTruthy();
    });
  });

  describe("attachment row", () => {
    it("renders the file name as a link", () => {
      const attachment = createAttachment();

      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[attachment]} />);

      const link = screen.getByText("plano-estructural.pdf");
      expect(link.tagName).toBe("A");
      expect(link.getAttribute("href")).toBe("/uploads/project-attachments/proj-1/plano-estructural.pdf");
    });

    it("renders the category badge", () => {
      const attachment = createAttachment({ category: "MEMORIA" });

      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[attachment]} />);

      // "Memoria" appears both in the <select> options and in the badge.
      // Use getAllByText to avoid the "Found multiple elements" error.
      const matches = screen.getAllByText("Memoria");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it("renders formatted file size", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[createAttachment({ fileSize: 2048000 })]} />);

      expect(screen.getByText(/2\.0 MB/)).toBeTruthy();
    });

    it("renders the uploader name when user is present", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[createAttachment()]} />);

      expect(screen.getByText(/subido por Maria Lopez/)).toBeTruthy();
    });

    it("does not show uploader when user is null", () => {
      render(
        <ProjectAttachmentUpload
          projectId="proj-1"
          initialAttachments={[createAttachment({ user: null })]}
        />,
      );

      expect(screen.queryByText(/subido por/)).toBeNull();
    });

    it("has a delete button", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[createAttachment()]} />);

      expect(screen.getByTestId("icon-trash")).toBeTruthy();
    });
  });

  describe("file size formatting", () => {
    it("formats bytes below 1 KB", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[createAttachment({ fileSize: 512 })]} />);

      expect(screen.getByText(/512 B/)).toBeTruthy();
    });

    it("formats kilobytes", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[createAttachment({ fileSize: 512000 })]} />);

      expect(screen.getByText(/500\.0 KB/)).toBeTruthy();
    });

    it("formats megabytes", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[createAttachment({ fileSize: 3500000 })]} />);

      expect(screen.getByText(/3\.3 MB/)).toBeTruthy();
    });
  });

  describe("category selector", () => {
    it("changes the selected category", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);
      fireEvent.click(screen.getByRole("button", { name: /Archivos adjuntos/ }));

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "CONTRATO" } });

      expect(select.value).toBe("CONTRATO");
    });
  });

  describe("drag and drop", () => {
    it("shows drag-over visual state on dragOver", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);

      const dropZone = screen.getByText("Arrastra y suelta archivos aquí o usa el botón superior").parentElement!;
      fireEvent.dragOver(dropZone);

      expect(dropZone.className).toContain("border-blue-400");
      expect(dropZone.className).toContain("bg-blue-50");
    });

    it("removes drag-over state on dragLeave", () => {
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);

      const dropZone = screen.getByText("Arrastra y suelta archivos aquí o usa el botón superior").parentElement!;
      fireEvent.dragOver(dropZone);
      fireEvent.dragLeave(dropZone);

      expect(dropZone.className).not.toContain("bg-blue-50");
    });
  });

  describe("upload", () => {
    it("shows 'Subiendo...' text and disables button while uploading", async () => {
      // Keep fetch pending so we can observe the uploading state
      let resolveFetch: (value: Response) => void;
      mocks.fetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);

      const file = new File(["content"], "test.pdf", { type: "application/pdf" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("Subiendo...")).toBeTruthy();
      });

      const button = screen.getByText("Subiendo...").closest("button");
      expect(button).toBeTruthy();
      expect((button as HTMLButtonElement).disabled).toBe(true);

      // Resolve to clean up
      resolveFetch!(new Response(JSON.stringify(createAttachment({ id: "att-done" })), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));

      await waitFor(() => {
        expect(screen.getByText("Subir archivo")).toBeTruthy();
      });
    });

    it("adds the uploaded attachment to the list on success", async () => {
      const newAttachment = createAttachment({ id: "att-new", fileName: "nuevo.pdf" });
      mocks.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(newAttachment), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);

      const file = new File(["content"], "nuevo.pdf", { type: "application/pdf" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("nuevo.pdf")).toBeTruthy();
      });
      // Button text restored and enabled after upload
      expect(screen.getByText("Subir archivo")).toBeTruthy();
    });

    it("shows error message on upload failure", async () => {
      mocks.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Archivo demasiado grande" }), { status: 400 }),
      );
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);

      const file = new File(["content"], "grande.pdf", { type: "application/pdf" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("Archivo demasiado grande")).toBeTruthy();
      });
    });

    it("includes the selected category in the upload", async () => {
      mocks.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify(createAttachment({ id: "att-new", category: "CONTRATO" })), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[]} />);
      fireEvent.click(screen.getByRole("button", { name: /Archivos adjuntos/ }));

      // Change category to CONTRATO
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "CONTRATO" } });

      const file = new File(["content"], "contrato.pdf", { type: "application/pdf" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mocks.fetch).toHaveBeenCalled();
      });

      // Verify the FormData includes the category
      const fetchCall = mocks.fetch.mock.calls[0] as [string, { body: FormData }];
      const formData = fetchCall[1]?.body as FormData;
      expect(formData.get("category")).toBe("CONTRATO");
    });
  });

  describe("delete", () => {
    it("removes the attachment from the list on successful delete", async () => {
      mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const attachment = createAttachment();
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[attachment]} />);

      // Click delete button (the Trash2 icon's parent button)
      const deleteButton = screen.getByTitle("Eliminar archivo");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText("plano-estructural.pdf")).toBeNull();
        expect(screen.getByText("No hay archivos adjuntos en este proyecto.")).toBeTruthy();
      });
    });

    it("shows error message on delete failure", async () => {
      mocks.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 }),
      );
      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={[createAttachment()]} />);

      const deleteButton = screen.getByTitle("Eliminar archivo");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText("No autorizado")).toBeTruthy();
      });
    });
  });

  describe("integration: multiple attachments", () => {
    it("renders multiple attachment rows with correct count", () => {
      const attachments = [
        createAttachment({ id: "att-1", fileName: "a.pdf", fileSize: 1024000, category: "PLANO" }),
        createAttachment({ id: "att-2", fileName: "b.docx", fileSize: 512000, category: "CONTRATO" }),
        createAttachment({ id: "att-3", fileName: "c.jpg", fileSize: 256000, category: "FOTO" }),
      ];

      render(<ProjectAttachmentUpload projectId="proj-1" initialAttachments={attachments} />);

      expect(screen.getByText("Archivos adjuntos (3)")).toBeTruthy();
      expect(screen.getByText("a.pdf")).toBeTruthy();
      expect(screen.getByText("b.docx")).toBeTruthy();
      expect(screen.getByText("c.jpg")).toBeTruthy();
    });
  });
});
