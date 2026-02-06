import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

import { getItemPadding } from "./constants";

const LoadingRow = ({
  className,
  level = 0,
}: {
  className?: string;
  level?: number;
}) => {
  return (
    <div
      className={cn("h-5.5 flex items-center text-muted-foreground", className)}
      // 指示器的加载需补偿文件夹小箭头图标宽度
      style={{ paddingLeft: getItemPadding(level, true) }}
    >
      <Spinner className="size-4 text-ring ml-0.5" />
    </div>
  );
};

export default LoadingRow;
