// 创建并导出convex实例，用于后端调用

import { ConvexHttpClient } from "convex/browser";

export const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
