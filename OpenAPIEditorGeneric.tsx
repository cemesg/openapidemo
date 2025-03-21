/* eslint-disable no-restricted-globals */
import React, { useState, useEffect } from "react";
import { parse, stringify } from "yaml";

/** ========================================================================
 *  CHANNEL OPTIONS (for multi-select)
 * ========================================================================
 */
const EXPOSE_OPTIONS = ["internet", "openApi", "extranet"];

/** ========================================================================
 *  TYPES & INTERFACES
 * ========================================================================
 */
interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  /** Our custom extension for exposure (comma-separated channels) */
  "x-expose-to"?: string;
}

interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}

interface PathItem {
  [method: string]: OperationObject;
}

interface OperationObject {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  /** Our custom extension for exposure (comma-separated channels) */
  "x-expose-to"?: string;
  parameters?: ParameterObject[];
  requestBody?: {
    content: {
      [mediaType: string]: {
        schema: {
          $ref: string;
        };
      };
    };
  };
  responses: {
    [statusCode: string]: ResponseObject;
  };
}

interface ResponseObject {
  description: string;
  content?: {
    [mediaType: string]: {
      schema: {
        $ref: string;
      };
    };
  };
}

/**
 * Default skeleton for a fresh OpenAPI Document
 */
const DEFAULT_OPENAPI: OpenAPIDocument = {
  openapi: "3.0.0",
  info: {
    title: "New API",
    version: "1.0.0",
    description: "API Description",
  },
  paths: {},
  components: {
    schemas: {},
  },
};

/** Methods for new operations */
const METHOD_OPTIONS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];

const OpenAPIEditorGeneric: React.FC = () => {
  /**
   * The 'real' OpenAPI document. We only commit changes to this
   * once the user explicitly confirms them.
   */
  const [apiDoc, setApiDoc] = useState<OpenAPIDocument>(DEFAULT_OPENAPI);

  /**
   * The 'editorState' is a local working copy or portion of the doc
   * that the user edits inline. After confirmation, we merge it into apiDoc.
   */
  const [editorState, setEditorState] = useState<OpenAPIDocument>(apiDoc);

  const [yamlOutput, setYamlOutput] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);

  // On mount or whenever we change `apiDoc`, reset the editorState
  useEffect(() => {
    setEditorState(apiDoc);
  }, [apiDoc]);

  // Keep YAML output in sync with the 'real' doc
  useEffect(() => {
    try {
      setYamlOutput(stringify(apiDoc));
    } catch (err) {
      showMessage("Error converting to YAML", "error");
    }
  }, [apiDoc]);

  function showMessage(text: string, type: "info" | "error") {
    const id = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id, text, type }]);
  }

  function dismissMessage(id: number) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  /**
   * Handle file loading
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsedDoc = parse(content);
        setApiDoc(parsedDoc);
        showMessage("YAML file loaded successfully.", "info");
      } catch (err) {
        showMessage("Invalid YAML file. Please check the file content.", "error");
      }
    };
    reader.readAsText(file);
  };

  /**
   * Download the current real doc as YAML
   */
  const handleDownload = () => {
    const blob = new Blob([yamlOutput], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "api.yaml";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  /**
   * Called when user wants to commit the editorState to apiDoc.
   */
  const handleSaveAllChanges = () => {
    setApiDoc(editorState);
    showMessage("All changes saved to the main document.", "info");
  };

  /**
   * Called when user wants to discard edits and revert.
   */
  const handleDiscardChanges = () => {
    setEditorState(apiDoc);
    showMessage("All unsaved changes have been discarded.", "info");
  };

  return (
    <div style={styles.mainContainer}>
      <h2>OpenAPI Editor (Addressing Points 3,4,6)</h2>

      <MessagesBar messages={messages} onDismiss={dismissMessage} />

      {/* File Import / Export */}
      <div style={styles.fileActionsContainer}>
        <label htmlFor="fileInput" style={{ marginRight: 10 }}>
          Load YAML:
        </label>
        <input
          id="fileInput"
          type="file"
          accept=".yaml,.yml"
          onChange={handleFileUpload}
          aria-label="Upload a YAML file"
        />
        <button
          onClick={() => {
            setApiDoc({ ...DEFAULT_OPENAPI });
            showMessage("New blank API document started.", "info");
          }}
          style={{ marginLeft: 10 }}
        >
          Start Fresh
        </button>
      </div>

      <InfoEditor editorState={editorState} setEditorState={setEditorState} />

      <PathsEditor editorState={editorState} setEditorState={setEditorState} showMessage={showMessage} />
      <SchemasEditor editorState={editorState} setEditorState={setEditorState} showMessage={showMessage} />

      {/* Editor-Wide Save / Discard */}
      <div style={{ margin: "20px 0" }}>
        <button onClick={handleSaveAllChanges} style={{ marginRight: 10 }}>
          Save All Changes
        </button>
        <button onClick={handleDiscardChanges}>Discard Changes</button>
      </div>

      {/* YAML Output */}
      <fieldset style={styles.yamlContainer}>
        <legend>
          <strong>YAML Output (current committed doc)</strong>
        </legend>
        <textarea readOnly value={yamlOutput} style={styles.yamlOutput} aria-label="Generated YAML" />
      </fieldset>
      <button onClick={handleDownload}>Download YAML</button>
    </div>
  );
};

export default OpenAPIEditorGeneric;

/** ========================================================================
 *  STYLES
 * ========================================================================
 */
const styles: Record<string, React.CSSProperties> = {
  mainContainer: {
    maxWidth: 1000,
    margin: "auto",
    fontFamily: "sans-serif",
    padding: 20,
  },
  fileActionsContainer: {
    marginBottom: 20,
  },
  yamlContainer: {
    border: "1px solid #aaa",
    padding: 10,
    marginBottom: 20,
  },
  yamlOutput: {
    width: "100%",
    height: 150,
    fontFamily: "monospace",
  },
  messageContainer: {
    marginBottom: 16,
  },
};

/** ========================================================================
 *  MESSAGES BAR
 * ========================================================================
 */
interface MessageItem {
  id: number;
  text: string;
  type: "info" | "error";
}
interface MessagesBarProps {
  messages: MessageItem[];
  onDismiss: (id: number) => void;
}

const MessagesBar: React.FC<MessagesBarProps> = ({ messages, onDismiss }) => {
  if (!messages.length) return null;

  return (
    <div style={styles.messageContainer}>
      {messages.map((msg) => {
        const bgColor = msg.type === "error" ? "#ffe5e5" : "#e5ffe5";
        const borderColor = msg.type === "error" ? "#ff8888" : "#88ff88";
        return (
          <div
            key={msg.id}
            style={{
              backgroundColor: bgColor,
              border: `1px solid ${borderColor}`,
              padding: "8px 12px",
              borderRadius: 4,
              marginBottom: 4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{msg.text}</span>
            <button
              onClick={() => onDismiss(msg.id)}
              style={{
                marginLeft: 8,
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </div>
  );
};

/** ========================================================================
 *  INFO EDITOR (inline editing, no separate modals)
 * ========================================================================
 */
interface InfoEditorProps {
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
}

const InfoEditor: React.FC<InfoEditorProps> = ({ editorState, setEditorState }) => {
  const { info } = editorState;

  function handleChange(key: keyof typeof info, value: string) {
    const newInfo = { ...info, [key]: value };
    setEditorState((prev) => ({ ...prev, info: newInfo }));
  }

  return (
    <fieldset style={{ border: "1px solid #aaa", padding: 10, marginBottom: 20 }}>
      <legend>
        <strong>API Information</strong>
      </legend>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block" }}>Title:</label>
        <input
          type="text"
          value={info.title}
          onChange={(e) => handleChange("title", e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block" }}>Version:</label>
        <input
          type="text"
          value={info.version}
          onChange={(e) => handleChange("version", e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block" }}>Description:</label>
        <textarea
          value={info.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          rows={3}
          style={{ width: "100%" }}
        />
      </div>
    </fieldset>
  );
};

/** ========================================================================
 *  PATHS EDITOR (inline forms, no modals)
 * ========================================================================
 */
interface PathsEditorProps {
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  showMessage: (msg: string, type: "info" | "error") => void;
}

const PathsEditor: React.FC<PathsEditorProps> = ({ editorState, setEditorState, showMessage }) => {
  const [newPathName, setNewPathName] = useState("");

  const pathsEntries = Object.entries(editorState.paths);

  const handleAddPath = () => {
    const trimmed = newPathName.trim();
    if (!trimmed) {
      showMessage("Path name cannot be empty.", "error");
      return;
    }
    if (editorState.paths[trimmed]) {
      showMessage(`Path "${trimmed}" already exists!`, "error");
      return;
    }
    const updatedPaths = { ...editorState.paths, [trimmed]: {} };
    setEditorState({ ...editorState, paths: updatedPaths });
    setNewPathName("");
    showMessage(`Path "${trimmed}" created`, "info");
  };

  function handleDeletePath(pathName: string) {
    const updated = { ...editorState.paths };
    delete updated[pathName];
    setEditorState((prev) => ({ ...prev, paths: updated }));
    showMessage(`Path "${pathName}" deleted`, "info");
  }

  return (
    <fieldset style={{ border: "1px solid #aaa", padding: 10, marginBottom: 20 }}>
      <legend>
        <strong>Paths</strong>
      </legend>

      {/* List existing paths */}
      {pathsEntries.map(([path, item]) => (
        <PathRow
          key={path}
          pathName={path}
          pathItem={item}
          editorState={editorState}
          setEditorState={setEditorState}
          onDeletePath={() => handleDeletePath(path)}
        />
      ))}

      {/* Inline form for new path */}
      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="/new-path"
          value={newPathName}
          onChange={(e) => setNewPathName(e.target.value)}
          style={{ marginRight: 5 }}
        />
        <button onClick={handleAddPath}>Add Path</button>
      </div>
    </fieldset>
  );
};

interface PathRowProps {
  pathName: string;
  pathItem: PathItem;
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  onDeletePath: () => void;
}

const PathRow: React.FC<PathRowProps> = ({
  pathName,
  pathItem,
  editorState,
  setEditorState,
  onDeletePath,
}) => {
  const [editPathName, setEditPathName] = useState(pathName);

  const handleRenamePath = () => {
    const trimmed = editPathName.trim();
    if (!trimmed || trimmed === pathName) return; // no rename

    if (editorState.paths[trimmed]) {
      alert(`Path "${trimmed}" already exists!`);
      return;
    }
    // rename
    const newPaths = { ...editorState.paths };
    newPaths[trimmed] = newPaths[pathName];
    delete newPaths[pathName];
    setEditorState({ ...editorState, paths: newPaths });
  };

  return (
    <div style={{ padding: 5, borderBottom: "1px solid #ddd" }}>
      <div style={{ marginBottom: 5 }}>
        <input
          style={{ minWidth: 150, marginRight: 5 }}
          value={editPathName}
          onChange={(e) => setEditPathName(e.target.value)}
        />
        <button onClick={handleRenamePath} style={{ marginRight: 5 }}>
          Rename
        </button>
        <button onClick={onDeletePath}>Delete</button>
      </div>

      <MethodsEditor
        pathName={pathName}
        pathItem={pathItem}
        editorState={editorState}
        setEditorState={setEditorState}
      />
    </div>
  );
};

/** ========================================================================
 *  METHODS EDITOR (inline, no modals)
 * ========================================================================
 */
interface MethodsEditorProps {
  pathName: string;
  pathItem: PathItem;
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
}

const MethodsEditor: React.FC<MethodsEditorProps> = ({ pathName, pathItem, editorState, setEditorState }) => {
  const [newMethod, setNewMethod] = useState("GET");

  const methodsEntries = Object.entries(pathItem);

  const handleAddMethod = () => {
    const lower = newMethod.toLowerCase();
    if (pathItem[lower]) {
      alert(`Method "${newMethod}" already exists!`);
      return;
    }
    const newOperation: OperationObject = {
      summary: `New ${newMethod} endpoint`,
      responses: { "200": { description: "OK" } },
      "x-expose-to": "",
    };
    const updatedPathItem = { ...pathItem, [lower]: newOperation };
    setEditorState((prev) => ({
      ...prev,
      paths: {
        ...prev.paths,
        [pathName]: updatedPathItem,
      },
    }));
  };

  const handleDeleteMethod = (m: string) => {
    const updatedPath = { ...pathItem };
    delete updatedPath[m];
    setEditorState((prev) => ({
      ...prev,
      paths: {
        ...prev.paths,
        [pathName]: updatedPath,
      },
    }));
  };

  return (
    <div style={{ marginLeft: 20 }}>
      {methodsEntries.map(([method, operation]) => (
        <MethodRow
          key={method}
          pathName={pathName}
          method={method}
          operation={operation}
          editorState={editorState}
          setEditorState={setEditorState}
          onDelete={() => handleDeleteMethod(method)}
        />
      ))}

      <div style={{ marginTop: 5 }}>
        <select value={newMethod} onChange={(e) => setNewMethod(e.target.value)}>
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={handleAddMethod} style={{ marginLeft: 5 }}>
          Add Method
        </button>
      </div>
    </div>
  );
};

interface MethodRowProps {
  pathName: string;
  method: string;
  operation: OperationObject;
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  onDelete: () => void;
}

const MethodRow: React.FC<MethodRowProps> = ({
  pathName,
  method,
  operation,
  editorState,
  setEditorState,
  onDelete,
}) => {
  const [summary, setSummary] = useState(operation.summary || "");
  const [desc, setDesc] = useState(operation.description || "");
  const [expose, setExpose] = useState<string[]>(
    operation["x-expose-to"] ? operation["x-expose-to"].split(",").map((s) => s.trim()) : []
  );
  const tags = operation.tags || [];

  function commitOperation(changes: Partial<OperationObject>) {
    const updatedMethod = { ...operation, ...changes };
    const updatedPath = { ...editorState.paths[pathName], [method]: updatedMethod };
    setEditorState((prev) => ({
      ...prev,
      paths: { ...prev.paths, [pathName]: updatedPath },
    }));
  }

    // -------------------------------------------------------------------
  // REINTRODUCE REQUEST/RESPONSE EDITING (Inline)
  // -------------------------------------------------------------------
  // Track local references for request & 200-response:
  const [reqRef, setReqRef] = useState(
    operation.requestBody?.content?.["application/json"]?.schema?.$ref || ""
  );
  const [resRef, setResRef] = useState(
    operation.responses?.["200"]?.content?.["application/json"]?.schema?.$ref || ""
  );

  function commitReqResp() {
    // Build updated operation
    const updated: OperationObject = { ...operation };

    // If reqRef is empty, remove requestBody
    if (!reqRef.trim()) {
      delete updated.requestBody;
    } else {
      updated.requestBody = {
        content: {
          "application/json": { schema: { $ref: reqRef.trim() } },
        },
      };
    }

    // If resRef is empty, remove 200's content
    if (!resRef.trim()) {
      if (updated.responses?.["200"]) {
        updated.responses["200"] = {
          description: updated.responses["200"].description || "OK",
        };
      }
    } else {
      // Ensure we have a 200 object
      const old200 = updated.responses?.["200"] || { description: "OK" };
      updated.responses = {
        ...updated.responses,
        "200": {
          ...old200,
          content: { "application/json": { schema: { $ref: resRef.trim() } } },
        },
      };
    }

    commitOperation(updated);
  }


  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    const updatedTags = [...tags, tag.trim()];
    commitOperation({ tags: updatedTags });
  };

  const handleDeleteTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    commitOperation({ tags: updatedTags });
  };

  // Request/Response editing is omitted here for brevity, but you can do inline selects, etc.

  return (
    <div style={{ marginTop: 5, padding: "5px 0", borderBottom: "1px solid #ddd" }}>
      <div>
        <strong>{method.toUpperCase()}</strong>
        <button onClick={onDelete} style={{ marginLeft: 10 }}>
          Delete
        </button>
      </div>
      <div style={{ marginTop: 5 }}>
        <label>Summary: </label>
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => commitOperation({ summary })}
          style={{ width: 200 }}
        />
      </div>
      <div style={{ marginTop: 5 }}>
        <label>Description:</label>
        <textarea
          rows={2}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => commitOperation({ description: desc })}
          style={{ width: 300 }}
        />
      </div>

      {/* Multi-expose */}
      <div style={{ marginTop: 5 }}>
        <label>Expose Channels:</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {EXPOSE_OPTIONS.map((opt) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                value={opt}
                checked={expose.includes(opt)}
                onChange={(e) => {
                  const newExpose = e.target.checked
                    ? [...expose, opt]
                    : expose.filter((item) => item !== opt);
                  setExpose(newExpose);
                  commitOperation({ "x-expose-to": expose.join(", ") });
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      {/* Tags inline */}
      <div style={{ marginTop: 5 }}>
        <strong>Tags:</strong>{" "}
        {tags.map((t) => (
          <span key={t} style={{ marginRight: 5 }}>
            {t}{" "}
            <button onClick={() => handleDeleteTag(t)} style={{ marginLeft: 2 }}>
              x
            </button>
          </span>
        ))}
        <AddTagInline onAddTag={handleAddTag} />
      </div>
      {/* Inline Request/Response Editor */}
  <div style={{ marginTop: 10, padding: "6px 0", borderTop: "1px solid #ccc" }}>
    <strong>Request/Response Schemas:</strong>
    <div style={{ marginTop: 5 }}>
      <label style={{ marginRight: 5 }}>Request Schema ($ref):</label>
      <select
        value={reqRef}
        onChange={(e) => setReqRef(e.target.value)}
        style={{ width: 280, marginRight: 5 }}
      >
        <option value="">(None)</option>
        {Object.keys(editorState.components?.schemas || {}).map((name) => (
          <option key={name} value={`#/components/schemas/${name}`}>{name}</option>
        ))}
      </select>
    </div>
    <div style={{ marginTop: 5 }}>
      <label style={{ marginRight: 5 }}>200 Response Schema ($ref):</label>
      <select
        value={resRef}
        onChange={(e) => setResRef(e.target.value)}
        style={{ width: 280, marginRight: 5 }}
      >
        <option value="">(None)</option>
        {Object.keys(editorState.components?.schemas || {}).map((name) => (
          <option key={name} value={`#/components/schemas/${name}`}>{name}</option>
        ))}
      </select>
    </div>
    <div style={{ marginTop: 5 }}>
      <button onClick={commitReqResp}>Save Req/Resp</button>
    </div>
  </div>
    </div>
  );
};

/** Simple inline tag-adder */
const AddTagInline: React.FC<{ onAddTag: (tag: string) => void }> = ({ onAddTag }) => {
  const [tagInput, setTagInput] = useState("");

  return (
    <>
      <input
        type="text"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        style={{ marginLeft: 10 }}
        placeholder="New tag..."
      />
      <button
        onClick={() => {
          onAddTag(tagInput);
          setTagInput("");
        }}
        style={{ marginLeft: 5 }}
      >
        +
      </button>
    </>
  );
};

/** ========================================================================
 *  SCHEMAS EDITOR (Enforce 'No inline arrays of objects')
 * ========================================================================
 */
interface SchemasEditorProps {
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  showMessage: (msg: string, type: "info" | "error") => void;
}

const SchemasEditor: React.FC<SchemasEditorProps> = ({ editorState, setEditorState, showMessage }) => {
  const [newSchemaName, setNewSchemaName] = useState("");
  const schemas = editorState.components?.schemas || {};

  function handleAddSchema() {
    const trimmed = newSchemaName.trim();
    if (!trimmed) {
      showMessage("Schema name cannot be empty.", "error");
      return;
    }
    if (schemas[trimmed]) {
      showMessage(`Schema "${trimmed}" already exists!`, "error");
      return;
    }
    const newSchemas = { ...schemas, [trimmed]: { type: "object", properties: {} } };
    setEditorState((prev) => ({
      ...prev,
      components: { ...prev.components, schemas: newSchemas },
    }));
    setNewSchemaName("");
    showMessage(`Schema "${trimmed}" created.`, "info");
  }

  function handleDeleteSchema(schemaName: string) {
    const updatedSchemas = { ...schemas };
    delete updatedSchemas[schemaName];
    setEditorState((prev) => ({
      ...prev,
      components: { ...prev.components, schemas: updatedSchemas },
    }));
    showMessage(`Schema "${schemaName}" deleted.`, "info");
  }

  // Render each schema
  return (
    <fieldset style={{ border: "1px solid #aaa", padding: 10, marginBottom: 20 }}>
      <legend>
        <strong>Schemas</strong>
      </legend>

      {Object.entries(schemas).map(([schemaName, schemaObj]) => (
        <SchemaRow
          key={schemaName}
          schemaName={schemaName}
          schemaObj={schemaObj}
          editorState={editorState}
          setEditorState={setEditorState}
          onDeleteSchema={() => handleDeleteSchema(schemaName)}
        />
      ))}

      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="NewSchemaName"
          value={newSchemaName}
          onChange={(e) => setNewSchemaName(e.target.value)}
          style={{ marginRight: 5 }}
        />
        <button onClick={handleAddSchema}>Add Schema</button>
      </div>
    </fieldset>
  );
};

interface SchemaRowProps {
  schemaName: string;
  schemaObj: SchemaObject;
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  onDeleteSchema: () => void;
}

/**
 * If user chooses array + object items, we create a new named schema behind the scenes
 * and store its $ref in .items.
 */
const SchemaRow: React.FC<SchemaRowProps> = ({
  schemaName,
  schemaObj,
  editorState,
  setEditorState,
  onDeleteSchema,
}) => {
  const [typeChoice, setTypeChoice] = useState(schemaObj.$ref ? "$ref" : schemaObj.type || "object");
  const [refValue, setRefValue] = useState(schemaObj.$ref || "");

  const initialExpose = schemaObj["x-expose-to"] ? schemaObj["x-expose-to"]!.split(",").map((s) => s.trim()) : [];
  const [expose, setExpose] = useState<string[]>(initialExpose);

  // If it's an object, show properties inline
  const isObject = typeChoice === "object";
  const isArray = typeChoice === "array";

  // If user picks array + object, we auto-create a named schema
  const [arrayItemType, setArrayItemType] = useState(schemaObj.items?.type || "");
  const [arrayItemRef, setArrayItemRef] = useState(schemaObj.items?.$ref || "");

  const properties = schemaObj.properties || {};

  function commitSchema(newSchema: SchemaObject) {
    const newSchemas = { ...(editorState.components?.schemas || {}) };
    newSchemas[schemaName] = newSchema;
    setEditorState((prev) => ({
      ...prev,
      components: {
        ...prev.components,
        schemas: newSchemas,
      },
    }));
  }

  function handleSaveClick() {
    const updated: SchemaObject = {};

    // If $ref, set $ref
    if (typeChoice === "$ref") {
      updated.$ref = refValue.trim();
    } else if (typeChoice === "object") {
      updated.type = "object";
      updated.properties = properties; // keep existing properties
    } else if (typeChoice === "array") {
      updated.type = "array";
      // If user picks 'object' for items, create a new named schema
      if (arrayItemType === "object" && !arrayItemRef) {
        // Make a new schema name, e.g.: MySchema_items
        const newItemSchemaName = `${schemaName}_items`;
        // If it doesn't exist, create it:
        const schemaExists = editorState.components?.schemas?.[newItemSchemaName];
        if (!schemaExists) {
          const newSub = { type: "object", properties: {} };
          const updatedSchemas = { ...(editorState.components?.schemas || {}) };
          updatedSchemas[newItemSchemaName] = newSub;
          setEditorState((prev) => ({
            ...prev,
            components: {
              ...prev.components,
              schemas: updatedSchemas,
            },
          }));
        }
        // Then reference it
        updated.items = { $ref: `#/components/schemas/${newItemSchemaName}` };
      } else if (arrayItemRef.trim()) {
        // if user typed/picked an existing ref
        updated.items = { $ref: arrayItemRef.trim() };
      } else if (["string", "number", "boolean"].includes(arrayItemType)) {
        updated.items = { type: arrayItemType };
      } else {
        // fallback
        updated.items = { type: "string" };
      }
    } else {
      // handle basic scalar: string, number, boolean
      updated.type = typeChoice;
    }

    // Expose channels
    if (expose.length > 0) {
      updated["x-expose-to"] = expose.join(", ");
    }

    // Merge any pre-existing subproperties if we had them
    if (schemaObj.properties && !updated.properties) {
      updated.properties = schemaObj.properties;
    }

    commitSchema(updated);
  }

  return (
    <div style={{ borderBottom: "1px solid #ddd", padding: 5 }}>
      <div style={{ marginBottom: 5 }}>
        <strong>{schemaName}</strong>
        <button onClick={onDeleteSchema} style={{ marginLeft: 10 }}>
          Delete
        </button>
      </div>

      {/* Type / $ref selection */}
      <div style={{ marginBottom: 5 }}>
        <label>Type:</label>{" "}
        <select
          value={typeChoice}
          onChange={(e) => {
            setTypeChoice(e.target.value);
            setRefValue("");
          }}
        >
          <option value="object">object</option>
          <option value="array">array</option>
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="$ref">$ref</option>
        </select>

        {typeChoice === "$ref" && (
          <div style={{ marginTop: 5 }}>
            <label>$ref:</label>{" "}
            <input
              type="text"
              value={refValue}
              onChange={(e) => setRefValue(e.target.value)}
              placeholder="#/components/schemas/AnotherSchema"
              style={{ width: 300, marginLeft: 5 }}
            />
          </div>
        )}

        {typeChoice === "array" && (
          <div style={{ marginTop: 5 }}>
            <label>Array Items Type:</label>{" "}
            <select
              value={arrayItemType}
              onChange={(e) => {
                setArrayItemType(e.target.value);
                setArrayItemRef("");
              }}
            >
              <option value="">(select)</option>
              <option value="object">object (new named schema)</option>
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="$ref">Existing $ref</option>
            </select>

            {arrayItemType === "$ref" && (
              <div style={{ marginTop: 5 }}>
                <label>Item $ref:</label>{" "}
                <input
                  type="text"
                  value={arrayItemRef}
                  onChange={(e) => setArrayItemRef(e.target.value)}
                  placeholder="#/components/schemas/SomeExisting"
                  style={{ width: 300, marginLeft: 5 }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expose channels multi-select */}
      <div style={{ marginBottom: 5 }}>
        <label>Expose Channels:</label>
        <br />
        <select
          multiple
          value={expose}
          onChange={(e) => {
            const selectedVals = Array.from(e.target.selectedOptions).map((o) => o.value);
            setExpose(selectedVals);
          }}
          style={{ width: 200, minHeight: 60 }}
        >
          {EXPOSE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <button onClick={handleSaveClick} style={{ marginBottom: 8 }}>
        Save Type
      </button>

      {/* If it's an object, show the properties inline */}
      {isObject && (
        <PropertiesEditor schemaName={schemaName} schemaObj={schemaObj} editorState={editorState} setEditorState={setEditorState} />
      )}
    </div>
  );
};

/**
 * PROPERTIES EDITOR
 * For object-type schemas. Uses inline forms, no modals.
 */
interface PropertiesEditorProps {
  schemaName: string;
  schemaObj: SchemaObject;
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
}

const PropertiesEditor: React.FC<PropertiesEditorProps> = ({
  schemaName,
  schemaObj,
  editorState,
  setEditorState,
}) => {
  const properties = schemaObj.properties || {};
  const [newPropName, setNewPropName] = useState("");

  function commitProperties(newProps: Record<string, SchemaObject>) {
    const newSchema = { ...schemaObj, properties: newProps };
    const schemas = { ...(editorState.components?.schemas || {}) };
    schemas[schemaName] = newSchema;
    setEditorState((prev) => ({
      ...prev,
      components: { ...prev.components, schemas },
    }));
  }

  function handleAddProperty() {
    const trimmed = newPropName.trim();
    if (!trimmed) return;
    if (properties[trimmed]) {
      alert(`Property "${trimmed}" already exists!`);
      return;
    }
    commitProperties({
      ...properties,
      [trimmed]: { type: "string" },
    });
    setNewPropName("");
  }

  function handleDeleteProperty(prop: string) {
    const updated = { ...properties };
    delete updated[prop];
    commitProperties(updated);
  }

  return (
    <div style={{ marginLeft: 20, marginTop: 5 }}>
      <strong>Properties</strong>
      <div style={{ marginTop: 5 }}>
        {Object.entries(properties).map(([propName, propSchema]) => (
          <PropertyRow
            key={propName}
            schemaName={schemaName}
            propName={propName}
            propSchema={propSchema}
            editorState={editorState}
            setEditorState={setEditorState}
            onDelete={() => handleDeleteProperty(propName)}
          />
        ))}
      </div>

      {/* Inline property add */}
      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="NewProperty"
          value={newPropName}
          onChange={(e) => setNewPropName(e.target.value)}
          style={{ marginRight: 5 }}
        />
        <button onClick={handleAddProperty}>Add Property</button>
      </div>
    </div>
  );
};

interface PropertyRowProps {
  schemaName: string;
  propName: string;
  propSchema: SchemaObject;
  editorState: OpenAPIDocument;
  setEditorState: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  onDelete: () => void;
}

const PropertyRow: React.FC<PropertyRowProps> = ({
  schemaName,
  propName,
  propSchema,
  editorState,
  setEditorState,
  onDelete,
}) => {
  const [typeChoice, setTypeChoice] = useState(propSchema.$ref ? "$ref" : propSchema.type || "string");
  const [refValue, setRefValue] = useState(propSchema.$ref || "");
  const initialExpose = propSchema["x-expose-to"] ? propSchema["x-expose-to"]!.split(",").map((s) => s.trim()) : [];
  const [expose, setExpose] = useState<string[]>(initialExpose);

  function commitProp(newSchema: SchemaObject) {
    const currentSchema = editorState.components?.schemas?.[schemaName];
    if (!currentSchema) return;

    const newProps = { ...(currentSchema.properties || {}) };
    newProps[propName] = newSchema;

    const newSchemaObj = { ...currentSchema, properties: newProps };
    const newSchemas = { ...(editorState.components?.schemas || {}) };
    newSchemas[schemaName] = newSchemaObj;

    setEditorState((prev) => ({
      ...prev,
      components: { ...prev.components, schemas: newSchemas },
    }));
  }

  function handleSaveProp() {
    const updated: SchemaObject = {};
    if (typeChoice === "$ref") {
      updated.$ref = refValue.trim();
    } else {
      updated.type = typeChoice;
    }
    if (expose.length > 0) {
      updated["x-expose-to"] = expose.join(", ");
    }
    commitProp(updated);
  }

  return (
    <div style={{ marginTop: 3, padding: "2px 0" }}>
      - <strong>{propName}</strong>
      <button onClick={onDelete} style={{ marginLeft: 5 }}>
        Delete
      </button>
      <div style={{ marginLeft: 10, marginTop: 2 }}>
        <label>Type:</label>{" "}
        <select
          value={typeChoice}
          onChange={(e) => {
            setTypeChoice(e.target.value);
            setRefValue("");
          }}
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="object">object</option>
          <option value="array">array</option>
          <option value="$ref">$ref</option>
        </select>
        {typeChoice === "$ref" && (
          <input
            type="text"
            value={refValue}
            onChange={(e) => setRefValue(e.target.value)}
            placeholder="#/components/schemas/Another"
            style={{ marginLeft: 5 }}
          />
        )}
        <br />
        <label>Expose:</label>{" "}
        <select
          multiple
          value={expose}
          onChange={(e) => {
            const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
            setExpose(vals);
          }}
          style={{ marginLeft: 5, minHeight: 40 }}
        >
          {EXPOSE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button onClick={handleSaveProp} style={{ marginLeft: 8 }}>
          Save
        </button>
      </div>
    </div>
  );
};
