import Link from "next/link";

import { formatTimestamp } from "../utils/formatTime";
import { getProjectIcon } from "../utils/getProjectIcon";
import { Doc } from "../../../../convex/_generated/dataModel";

export const ProjectItem = ({ data }: { data: Doc<"projects"> }) => {
  return (
    <Link
      href={`/projects/${data._id}`}
      className="text-sm text-foreground/60 font-medium hover:text-foreground py-1 flex items-center justify-between w-full group"
    >
      <div className="flex items-center gap-2">
        {getProjectIcon(data)}
        <span className="truncate">{data.name}</span>
      </div>
      <span className="text-xs text-muted-foreground group-hover:text-foreground/60 transition-colors">
        {formatTimestamp(data.updatedAt)}
      </span>
    </Link>
  );
};
