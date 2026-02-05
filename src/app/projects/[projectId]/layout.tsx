import ProjectIdLayout from "@/feature/projects/components/project-id-layout";
import { Id } from "../../../../convex/_generated/dataModel";

const layout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: Id<"projects"> }>;
}) => {
  const { projectId } = await params;

  return <ProjectIdLayout projectId={projectId}>{children}</ProjectIdLayout>;
};

export default layout;
