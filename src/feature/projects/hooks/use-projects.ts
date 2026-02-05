/* eslint-disable react-hooks/purity */

import { api } from "../../../../convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Id } from "../../../../convex/_generated/dataModel";

export const useProjects = () => {
  return useQuery(api.projects.get);
};

export const useProjectsPartial = (limit: number) => {
  return useQuery(api.projects.getPartial, { limit });
};

export const useCreateProject = () => {
  return useMutation(api.projects.create).withOptimisticUpdate(
    (localStore, args) => {
      const existingProjects = localStore.getQuery(api.projects.get);
      const partialProjects = localStore.getQuery(api.projects.getPartial, {
        limit: 6,
      });

      const now = Date.now();
      const newProject = {
        _id: crypto.randomUUID() as Id<"projects">,
        _creationTime: now,
        name: args.name,
        ownerId: "anonymous",
        updatedAt: now,
      };

      if (existingProjects !== undefined) {
        localStore.setQuery(api.projects.get, {}, [
          newProject,
          ...existingProjects,
        ]);
      }
      if (partialProjects !== undefined) {
        localStore.setQuery(api.projects.getPartial, { limit: 6 }, [
          newProject,
          ...partialProjects.slice(0, 5), // 保持总数不超过 6
        ]);
      }
    },
  );
};
