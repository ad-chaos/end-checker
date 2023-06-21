import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
   Decoration,
   DecorationSet,
   EditorView,
   PluginValue,
   ViewPlugin,
   ViewUpdate,
   WidgetType,
} from "@codemirror/view";
import { Plugin } from "obsidian";

class CheckboxWidget extends WidgetType {
   constructor(readonly checked: boolean) {
      super();
   }

   eq(other: CheckboxWidget) {
      return other.checked == this.checked;
   }

   toDOM() {
      const box = document.createElement("input");
      box.classList.add("task-list-item-checkbox", "ec-task-list-toggle");
      box.style.marginLeft = "6px";
      box.type = "checkbox";
      box.checked = this.checked;

      return box;
   }

   ignoreEvent() {
      return false;
   }
}

class CheckBoxPlugin implements PluginValue {
   decorations: DecorationSet;

   constructor(view: EditorView) {
      this.decorations = CheckBoxPlugin.checkboxes(view);
   }

   update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet)
         this.decorations = CheckBoxPlugin.checkboxes(update.view);
   }

   static checkboxes(view: EditorView) {
      const widgets = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
         syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
               const maybe_list = view.state.doc.sliceString(
                  node.from - 3,
                  node.from
               );

               if (
                  node.type.name.startsWith("list") &&
                  /\[.\]/.test(maybe_list)
               ) {
                  const cur_pos = view.state.selection.main.head;
                  if (!(node.from - 5 <= cur_pos && cur_pos <= node.from)) {
                     widgets.add(
                        node.from - 4,
                        node.from,
                        Decoration.replace({})
                     );
                  }

                  widgets.add(
                     node.to,
                     node.to,
                     Decoration.widget({
                        widget: new CheckboxWidget(maybe_list[1] == "x"),
                        side: 1,
                     })
                  );
               }
            },
         });
      }
      return widgets.finish();
   }
}

const toggleTaskHandler = {
   mousedown: (e: Event, view: EditorView) => {
      const target = e.target as HTMLInputElement;
      if (
         target.nodeName == "INPUT" &&
         target.classList.contains("ec-task-list-toggle")
      ) {
         e.preventDefault();
         const line = view.state.doc.lineAt(view.posAtDOM(target));
         const start = line.from + line.text.indexOf("- [");
         view.dispatch({
            changes: {
               from: start + 3,
               to: start + 4,
               insert: target.checked ? " " : "x",
            },
         });
      }
   },
};

export default class EndCheckerPlugin extends Plugin {
   async onload() {
      this.registerEditorExtension([
         ViewPlugin.fromClass(CheckBoxPlugin, {
            decorations: (v) => v.decorations,
            eventHandlers: toggleTaskHandler,
         }),
      ]);
   }
}
