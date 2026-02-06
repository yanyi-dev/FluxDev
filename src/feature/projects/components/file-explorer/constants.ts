// 根目录缩进
export const BASE_PADDING = 12;
// 每层缩进
export const LEVEL_PADDING = 12;

export const getItemPadding = (level: number, isFile: boolean) => {
  // 文件缩进需要额外加上文件夹小箭头图标宽度
  // 文件夹已经有了，所以不需要加
  const fileOffset = isFile ? 16 : 0;
  return BASE_PADDING + level * LEVEL_PADDING + fileOffset;
};
