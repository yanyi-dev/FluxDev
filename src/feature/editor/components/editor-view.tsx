"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

import {
  useFile,
  useFiles,
  useUpdateFile,
} from "@/feature/projects/hooks/use-files";

import CodeEditor from "./code.editor";
import TopNavigation from "./top-navigation";
import { useEditor } from "../hooks/use-editor";
import FileBreadCrumbs from "./file-breadcrumbs";

import { Id } from "../../../../convex/_generated/dataModel";
import { AlertTriangleIcon } from "lucide-react";

const DEBUNCE_MS = 1500;

const EditorView = ({ projectId }: { projectId: Id<"projects"> }) => {
  // const { activeTabId } = useEditor(projectId);

  const { activeTabId, openTabs, closeTab } = useEditor(projectId);
  const files = useFiles(projectId);
  // 自动清理已删除文件的 tab
  useEffect(() => {
    if (!files) return;
    const fileIds = new Set(files.map((f) => f._id));
    for (const tabId of openTabs) {
      if (!fileIds.has(tabId)) {
        closeTab(tabId); // 文件不存在了，关闭 tab
      }
    }
  }, [files, openTabs, closeTab]);

  const activeFile = useFile(activeTabId);
  const updateFile = useUpdateFile();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActiveFileBinary = activeFile && activeFile.storageId;
  // 文本文件内容可为空，故通过storageId判断
  const isActiveFileText = activeFile && !activeFile.storageId;

  useEffect(() => {
    // 当 activeTabId 变化或EditorView组件销毁时，清除之前的定时器
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [activeTabId]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center">
        <TopNavigation projectId={projectId} />
      </div>
      {activeTabId && <FileBreadCrumbs projectId={projectId} />}
      <div className="flex-1 min-h-0 bg-background">
        {!activeFile && (
          <div className="size-full flex items-center justify-center">
            <Image
              src="/logo.svg"
              alt="FluxDev"
              width={50}
              height={50}
              className="opacity-55"
            />
          </div>
        )}
        {isActiveFileText && (
          <CodeEditor
            // key保证了编辑器组件的销毁重建，即内容正确初始化
            key={activeFile._id}
            filename={activeFile.name}
            initialValue={activeFile.content}
            onChange={(content: string) => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }
              timeoutRef.current = setTimeout(() => {
                updateFile({ id: activeFile._id, content });
              }, DEBUNCE_MS);
            }}
            onSaveImmediately={(content: string) => {
              updateFile({ id: activeFile._id, content });
            }}
          />
        )}
        {isActiveFileBinary && (
          <div className="size-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2.5 max-w-md text-center">
              <AlertTriangleIcon className="size-10 text-yellow-500" />
              <p className="text-sm">
                The file is not displayed in the text editor because it is
                either binary or uses an unsupported text encoding.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorView;
