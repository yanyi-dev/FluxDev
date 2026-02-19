import Link from "next/link";
import { ArrowRightIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { formatTimestamp } from "../utils/formatTime";
import { getProjectIcon } from "../utils/getProjectIcon";

import { Doc } from "../../../../convex/_generated/dataModel";
import { useDeleteProject } from "../hooks/use-projects";

export const ContinueCard = ({ data }: { data: Doc<"projects"> }) => {
  const deleteProject = useDeleteProject();

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">Last updated</span>
      <Button
        variant="outline"
        asChild
        className="h-auto items-start justify-start p-4 bg-background border rounded-none flex flex-col gap-2"
      >
        <Link href={`/projects/${data._id}`} className="group">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {getProjectIcon(data)}
              <span className="font-medium truncate">{data.name}</span>
            </div>
            <ArrowRightIcon className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
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
      </Button>
    </div>
  );
};
