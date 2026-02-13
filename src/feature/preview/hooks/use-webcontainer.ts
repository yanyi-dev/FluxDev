import { useCallback, useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";

import { buildFileTree, getFilePath } from "@/feature/preview/utils/file-tree";
import { useFiles } from "@/feature/projects/hooks/use-files";

import { Id } from "../../../../convex/_generated/dataModel";

// 单个WebContainer实例
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

const getWebContainer = async () => {
  if (webcontainerInstance) return webcontainerInstance;

  // 只允许一个实例存在
  if (!bootPromise) {
    // 请求头的设置是给浏览器看的，这里是给webcontainer看的
    bootPromise = WebContainer.boot({ coep: "credentialless" });
  }

  webcontainerInstance = await bootPromise;
  return webcontainerInstance;
};

const teardownWebContainer = () => {
  if (webcontainerInstance) {
    webcontainerInstance.teardown();
    webcontainerInstance = null;
  }
  bootPromise = null;
};

interface UseWebContainerProps {
  projectId: Id<"projects">;
  enabled: boolean;
  settings?: {
    installCommand?: string;
    devCommand?: string;
  };
}

export const useWebContainer = ({
  projectId,
  enabled,
  settings,
}: UseWebContainerProps) => {
  const [status, setStatus] = useState<
    "idle" | "booting" | "installing" | "running" | "error"
  >("idle");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0); // 用于刷新或者重启WebContainer
  const [terminalOutput, setTerminalOutput] = useState("");

  const containerRef = useRef<WebContainer | null>(null);
  // 确保整个整个预览生命周期中，webcontainer只启动一次
  const hasStartedRef = useRef(false);

  const files = useFiles(projectId);

  // WebContainer的初始化与文件的挂载
  useEffect(() => {
    if (!enabled || !files || files.length === 0 || hasStartedRef.current)
      return;

    hasStartedRef.current = true;
    const abortController = new AbortController();

    const start = async () => {
      try {
        setStatus("booting");
        setError(null);
        setTerminalOutput("");

        const appendOutput = (data: string) => {
          setTerminalOutput((prev) => prev + data);
        };

        const container = await getWebContainer();
        containerRef.current = container;

        const fileTree = buildFileTree(files);
        await container.mount(fileTree);

        // 注册监听server-ready时间的回调函数
        container.on("server-ready", (_port, url) => {
          setPreviewUrl(url);
          setStatus("running");
        });

        setStatus("installing");

        // 解析安装依赖命令
        // webcontainer是一个虚拟容器，所以每次初始化都要安装依赖
        const installCmd = settings?.installCommand || "npm install";
        const [installBin, ...installArgs] = installCmd.split(" ");
        appendOutput(`$ ${installCmd}\n`);
        const installProcess = await container.spawn(installBin, installArgs);
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          }),
        );

        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0)
          throw new Error(`${installCmd} failed with code ${installExitCode}`);

        // 解析运行命令
        const devCmd = settings?.devCommand || "npm run dev";
        const [devBin, ...devArgs] = devCmd.split(" ");
        appendOutput(`\n$ ${devCmd}\n`);
        const devProcess = await container.spawn(devBin, devArgs);
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          }),
        );

        const devExitCode = await devProcess.exit;
        if (devExitCode !== 0)
          throw new Error(`${devCmd} failed with code ${devExitCode}`);
      } catch (error) {
        if (abortController.signal.aborted) return;
        setError(error instanceof Error ? error.message : "Unknown error");
        setStatus("error");
      }
    };

    start();

    return () => abortController.abort();
  }, [
    enabled,
    files,
    restartKey,
    settings?.devCommand,
    settings?.installCommand,
  ]);

  // 同步文件更改(热加载)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !files || status !== "running") return;

    const filesMap = new Map(files.map((f) => [f._id, f]));

    for (const file of files) {
      if (file.type !== "file" || file.storageId || !file.content) continue;

      const filePath = getFilePath(file, filesMap);
      container.fs.writeFile(filePath, file.content);
    }
  }, [files, status]);

  // 初始化的时候，enable为true，清理函数被注册，并不会运行
  // effect监听依赖项变化的时候，是先运行清理函数，再重新执行effect
  // 管理器，管理容器生命周期
  useEffect(() => {
    if (!enabled) return;

    return () => {
      teardownWebContainer();
      containerRef.current = null;
      hasStartedRef.current = false;
      setStatus("idle");
      setPreviewUrl(null);
      setError(null);
    };
  }, [enabled, restartKey, settings?.devCommand, settings?.installCommand]);

  // 重启WebContainer进程
  const restart = useCallback(() => {
    setRestartKey((k) => k + 1);
  }, []);

  return {
    status,
    previewUrl,
    error,
    restart,
    terminalOutput,
  };
};
