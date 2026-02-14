"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";

interface TiptapEditorProps {
  content: unknown;
  onChange: (json: unknown) => void;
  placeholder?: string;
}

export function TiptapEditor({
  content,
  onChange,
  placeholder,
}: TiptapEditorProps) {
  const t = useTranslations("notes");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? t("bodyPlaceholder"),
      }),
    ],
    content: (content as Record<string, unknown>) ?? undefined,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
    },
    editorProps: {
      attributes: {
        class: "tiptap prose prose-sm max-w-none p-3 focus:outline-none",
      },
    },
  });

  // Sync external content changes (e.g., loading existing note)
  useEffect(() => {
    if (editor && content) {
      const current = JSON.stringify(editor.getJSON());
      const incoming = JSON.stringify(content);
      if (current !== incoming) {
        editor.commands.setContent(content as Record<string, unknown>);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  return (
    <div className="rounded-md border">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label={t("bold")}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label={t("italic")}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          aria-label={t("heading")}
          className="h-8 w-8 p-0"
        >
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          aria-label={t("bulletList")}
          className="h-8 w-8 p-0"
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          aria-label={t("orderedList")}
          className="h-8 w-8 p-0"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          pressed={false}
          onPressedChange={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label={t("undo")}
          className="h-8 w-8 p-0"
        >
          <Undo2 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={false}
          onPressedChange={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label={t("redo")}
          className="h-8 w-8 p-0"
        >
          <Redo2 className="h-4 w-4" />
        </Toggle>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
