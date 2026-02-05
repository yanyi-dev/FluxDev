"use client";

import { Allotment } from "allotment";

import Navbar from "./navbar";
import { Id } from "../../../../convex/_generated/dataModel";

import "allotment/dist/style.css";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_CONVERSATION_SIDEBAR_WIDTH = 400;
const DEFAULT_MAIN_SIZE = 1000;

const ProjectIdLayout = ({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: Id<"projects">;
}) => {
  return (
    <div className="w-full h-screen flex flex-col">
      <Navbar projectId={projectId} />
      <div className="flex flex-1 overflow-hidden">
        <Allotment
          className="flex-1"
          defaultSizes={[DEFAULT_MAIN_SIZE, DEFAULT_CONVERSATION_SIDEBAR_WIDTH]}
        >
          <Allotment.Pane>{children}</Allotment.Pane>
          <Allotment.Pane
            snap
            minSize={MIN_SIDEBAR_WIDTH}
            maxSize={MAX_SIDEBAR_WIDTH}
            preferredSize={DEFAULT_CONVERSATION_SIDEBAR_WIDTH}
          >
            <div>Conversation</div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default ProjectIdLayout;
