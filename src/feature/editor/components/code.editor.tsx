"use client";

import { useEffect, useMemo, useRef } from "react";

import { minimap } from "../extensions/minimap";
import { customTheme } from "../extensions/theme";
import { suggestion } from "../extensions/suggestion";
import { customSetup } from "../extensions/custom-setup";
import { getLanguageExtension } from "../extensions/language-extension";

import { keymap, EditorView } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { quickEdit } from "../extensions/quick-edit";
import { selectionTooltip } from "../extensions/selection-tooltip";

interface CodeEditorProps {
  filename: string;
  initialValue?: string;
  onChange: (value: string) => void;
  onSaveImmediately?: (value: string) => void;
}

const CodeEditor = ({
  filename,
  initialValue = "",
  onChange,
  onSaveImmediately,
}: CodeEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const languageExtension = useMemo(
    () => getLanguageExtension(filename),
    [filename],
  );

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      doc: initialValue,
      parent: editorRef.current,
      extensions: [
        oneDark,
        customTheme,
        customSetup,
        languageExtension,
        suggestion(filename),
        quickEdit(filename),
        selectionTooltip(),
        minimap(),
        indentationMarkers(),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    viewRef.current = view;

    return () => {
      // 页面关闭前直接保存一次内容
      if (onSaveImmediately && viewRef.current) {
        onSaveImmediately(viewRef.current.state.doc.toString());
      }
      view.destroy();
    };
    // initialValue只是用于初始化
    // onSaveImmediately只在组件销毁时调用
    // 若依赖initialValue或onSaveImmediately更新，就会导致编辑器内容重建，从而导致光标丢失等问题
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageExtension]);

  return <div ref={editorRef} className="size-full pl-4 bg-background" />;
};

export default CodeEditor;
