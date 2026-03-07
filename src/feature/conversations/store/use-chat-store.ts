import { create } from "zustand";

interface ChatStore {
  input: string;
  appendSnippet: (snippet: string) => void;
  setInput: (value: string) => void;
}

// 函数柯里化，ts不支持局部类型推断
export const useChatStore = create<ChatStore>()((set) => ({
  input: "",
  setInput: (value) => set({ input: value }),
  appendSnippet: (snippet) =>
    set((state) => ({
      input: state.input ? `${state.input}\n\n${snippet}` : snippet,
    })),
}));
