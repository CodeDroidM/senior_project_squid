/* ------------------------------------------------------------------
   src/ConfigEditor/ConfigCodeEditor.jsx
   Two–way-synced CodeMirror-6 JSON editor
-------------------------------------------------------------------*/
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { jsonSchema } from "codemirror-json-schema";
import { EditorView } from "@codemirror/view";

import { combinedSchema } from "./combinedSchema";

/* helper – build canonical JSON (2-space indent) */
const buildJSON = (shared, load, imp) =>
  JSON.stringify(
    {
      SharedConfiguration: shared,
      LoadConfiguration: load,
      ImportConfiguration: imp,
    },
    null,
    2,
  );

export default function ConfigCodeEditor({
  sharedFormData,
  loadFormData,
  importFormData,
  onChangeAll, // <- lifts state back to <App/> / form editor
}) {
  /* ---------------------------------------------------------------
     Local editor doc  (prevents scroll / cursor jumps)
  ----------------------------------------------------------------*/
  const [doc, setDoc] = useState(
    buildJSON(sharedFormData, loadFormData, importFormData),
  );

  /* ---------------------------------------------------------------
     When the form changes ➜ update editor *unless* that change
     originated from this editor (flagged via skipNext.current)
  ----------------------------------------------------------------*/
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return; // ignore the echo of our own edit
    }
    const next = buildJSON(sharedFormData, loadFormData, importFormData);
    if (next !== doc) setDoc(next);
  }, [sharedFormData, loadFormData, importFormData]); // eslint-disable-line

  /* ---------------------------------------------------------------
     Editor → Form  (only when JSON is valid)
  ----------------------------------------------------------------*/
  const handleChange = useCallback(
    (value /*, viewUpdate */) => {
      setDoc(value); // keep local text / cursor
      try {
        const obj = JSON.parse(value);
        skipNext.current = true; // <- tell useEffect to ignore echo
        onChangeAll(obj); //    lift to the form
      } catch {
        /* user is still typing invalid JSON – ignore for now */
      }
    },
    [onChangeAll],
  );

  /* ---------------------------------------------------------------
     Tooltip/Lint bubble styling
  ----------------------------------------------------------------*/
  const tooltipTheme = useMemo(
    () =>
      EditorView.theme(
        {
          ".cm-tooltip": {
            background: "#222",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: "6px",
            fontSize: "0.85rem",
            padding: "4px 6px",
            boxShadow: "0 2px 4px rgba(0,0,0,.3)",
          },
          ".cm-tooltip .cm-tooltip-arrow:before": {
            borderTopColor: "#222",
          },
          /* lint-error bubble */
          ".cm-tooltip-lint": {
            background: "#37352f",
            borderColor: "#c4401a",
          },
          ".cm-tooltip-lint .cm-tooltip-arrow:before": {
            borderTopColor: "#37352f",
          },
          /* completion list */
          ".cm-tooltip-autocomplete": {
            background: "#fff",
            color: "#000",
            border: "1px solid #ccc",
            borderRadius: "4px",
          },
          ".cm-tooltip-autocomplete .cm-tooltip-arrow:before": {
            borderTopColor: "#fff",
          },
        },
        { dark: false },
      ),
    [],
  );

  /* ---------------------------------------------------------------
     CM6 extensions
  ----------------------------------------------------------------*/
  const extensions = useMemo(
    () => [json(), jsonSchema(combinedSchema), tooltipTheme],
    [tooltipTheme],
  );

  /* ---------------------------------------------------------------
     Render
  ----------------------------------------------------------------*/
  return (
    <CodeMirror
      value={doc}
      onChange={handleChange}
      extensions={extensions}
      basicSetup={{ autocompletion: true }}
      theme="light"
      height="100%"
    />
  );
}
