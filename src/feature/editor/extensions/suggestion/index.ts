import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap,
} from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

import { fetcher } from "./fetcher";

// StateEffect类似于action，用于设置建议文本的动作
const setSuggestionEffect = StateEffect.define<string | null>();

// StateField类似于 Reducer+state的结合体，即一个访问器，访问state
// 其中create()用于初始化state，update()用于接收Effect(action)更新state
// 接收到的effect就包括上述我们定义的StateEffect
const suggestionState = StateField.define<string | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    // 找到我们定义的effect，并更新值
    for (const effect of transaction.effects) {
      if (effect.is(setSuggestionEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

// WidgetType，在编辑器中展示创建的自定义dom元素
// toDOM，被codemirror调用去获取创建的dom元素
class SuggestionWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.text;
    span.style.opacity = "0.4";
    span.style.pointerEvents = "none";
    return span;
  }
}

let debounceTimer: number | null = null;
let isWaitingForSuggestion = false;
const DEBOUNCE_DELAY = 300;

let currentAbortController: AbortController | null = null;

const generatePayload = (view: EditorView, fileName: string) => {
  const code = view.state.doc.toString();
  if (!code || code.trim().length === 0) return null;

  const cursorPosition = view.state.selection.main.head;
  const currentLine = view.state.doc.lineAt(cursorPosition);
  // cursorInLine行内相对位置，cursorPosition全局位置
  const cursorInLine = cursorPosition - currentLine.from;

  const previousLines: string[] = [];
  const previousLinesToFetch = Math.min(50, currentLine.number - 1);
  for (let i = previousLinesToFetch; i >= 1; i--) {
    previousLines.push(view.state.doc.line(currentLine.number - i).text);
  }

  const nextLines: string[] = [];
  const totalLines = view.state.doc.lines;
  const linesToFetch = Math.min(30, totalLines - currentLine.number);
  for (let i = 1; i <= linesToFetch; i++) {
    nextLines.push(view.state.doc.line(currentLine.number + i).text);
  }

  return {
    fileName,
    previousLines: previousLines.join("\n"),
    textBeforeCursor: currentLine.text.slice(0, cursorInLine),
    textAfterCursor: currentLine.text.slice(cursorInLine),
    nextLines: nextLines.join("\n"),
  };
};

const createDebouncePlugin = (fileNmae: string) => {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.triggerSuggestion(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.triggerSuggestion(update.view);
        }
      }

      triggerSuggestion(view: EditorView) {
        // 请求在DEBOUNCE_DELAY内发生，不发出请求
        if (debounceTimer !== null) clearTimeout(debounceTimer);

        // 取消已经发送的请求
        if (currentAbortController !== null) currentAbortController.abort();

        isWaitingForSuggestion = true;
        debounceTimer = window.setTimeout(async () => {
          const payload = generatePayload(view, fileNmae);

          if (!payload) {
            isWaitingForSuggestion = false;
            view.dispatch({ effects: setSuggestionEffect.of(null) });
            return;
          }
          currentAbortController = new AbortController();
          const suggestion = await fetcher(
            payload,
            currentAbortController.signal,
          );

          isWaitingForSuggestion = false;
          view.dispatch({
            effects: setSuggestionEffect.of(suggestion),
          });
        }, DEBOUNCE_DELAY);
      }

      destroy() {
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        if (currentAbortController !== null) currentAbortController.abort();
      }
    },
  );
};

// ViewPlugin.fromClass，响应视图变化以及与Dom或外界交互
// 即产生副作用的地方，类似于useEffect
const renderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      // view和update.view即整个编辑器实例，不会变，除非被销毁
      // view.state即当前编辑器状态,会随ViewUpdate的变化而变化(新的state替换旧的state)
      this.decorations = this.build(view);
    }

    // update即本次视图变化的所有信息
    // 即view.state一变，update函数便会被调用
    update(update: ViewUpdate) {
      const suggestionChanged = update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(setSuggestionEffect)),
      );
      // 副作用包括文本变化，光标移动，setSuggestionEffect
      const shouldRebuild =
        update.docChanged || update.selectionSet || suggestionChanged;
      if (shouldRebuild) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView) {
      if (isWaitingForSuggestion) return Decoration.none;

      const suggestion = view.state.field(suggestionState);
      if (!suggestion) return Decoration.none;

      const cursor = view.state.selection.main.head;
      return Decoration.set([
        Decoration.widget({
          widget: new SuggestionWidget(suggestion),
          side: 1, // 在光标之后渲染建议
        }).range(cursor),
      ]);
    }
  },
  // 通知CodeMirror使用我们的decorations
  { decorations: (plugin) => plugin.decorations },
);

const acceptSuggestionKeymap = keymap.of([
  {
    key: "Tab",
    run: (view) => {
      const suggestion = view.state.field(suggestionState);
      // 没有建议就执行默认功能，比如缩进
      if (!suggestion) return false;

      const cursor = view.state.selection.main.head;
      view.dispatch({
        changes: { from: cursor, insert: suggestion },
        selection: { anchor: cursor + suggestion.length },
        effects: setSuggestionEffect.of(null),
      });
      return true;
    },
  },
]);

export const suggestion = (fileName: string) => [
  suggestionState, // 建议文本的状态管理
  createDebouncePlugin(fileName), // 编辑时创建建议
  renderPlugin, // 建议文本的渲染
  acceptSuggestionKeymap, // Tab键接受建议
];
