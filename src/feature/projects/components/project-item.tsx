import Link from "next/link";

import { formatTimestamp } from "../utils/formatTime";
import { getProjectIcon } from "../utils/getProjectIcon";
import { Doc } from "../../../../convex/_generated/dataModel";
import { useDeleteProject } from "../hooks/use-projects";
import { TrashIcon } from "lucide-react";

export const ProjectItem = ({ data }: { data: Doc<"projects"> }) => {
  const deleteProject = useDeleteProject();

  return (
    <Link
      href={`/projects/${data._id}`}
      className="text-sm text-foreground/60 font-medium hover:text-foreground py-1 flex items-center justify-between w-full group"
    >
      <div className="flex items-center gap-2">
        {getProjectIcon(data)}
        <span className="truncate">{data.name}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground group-hover:text-foreground/60 transition-colors">
          {formatTimestamp(data.updatedAt)}
        </span>
        <button
          className="p-1 hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteProject(data._id);
          }}
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
    </Link>
  );
};
