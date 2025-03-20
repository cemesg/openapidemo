/* eslint-disable no-restricted-globals */
import React, { useState, useEffect } from "react";
import { parse, stringify } from "yaml";

/** -------------------------------------------------------------
 *  CHANNEL OPTIONS (for multi-select)
 *  -------------------------------------------------------------
 **/
const EXPOSE_OPTIONS = ["internet", "openApi", "extranet"];

/** -------------------------------------------------------------
 *  TYPES
 *  -------------------------------------------------------------
 **/
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
  'x-expose-to'?: string;
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
  'x-expose-to'?: string;
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

/** Default skeleton for a fresh OpenAPI Document */
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

/** For example usage in the MethodsList select. */
const METHOD_OPTIONS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];

/** -------------------------------------------------------------
 *  MAIN EDITOR COMPONENT
 *  -------------------------------------------------------------
 **/
const OpenAPIEditorGeneric: React.FC = () => {
  const [apiDoc, setApiDoc] = useState<OpenAPIDocument>(DEFAULT_OPENAPI);
  const [yamlOutput, setYamlOutput] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);

  const [confirmModalData, setConfirmModalData] = useState<ConfirmModalData | null>(null);

  useEffect(() => {
    try {
      setYamlOutput(stringify(apiDoc));
    } catch (err) {
      showMessage("Error converting to YAML", "error");
    }
  }, [apiDoc]);

  /** HELPER: Show ephemeral messages in the messages bar */
  function showMessage(text: string, type: "info" | "error") {
    const id = new Date().getTime() + Math.random();
    setMessages((prev) => [...prev, { id, text, type }]);
  }

  /** HELPER: Hide a single message */
  function dismissMessage(id: number) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  /** Confirm Modal open/close */
  function openConfirmDialog(opts: ConfirmModalData) {
    setConfirmModalData(opts);
  }
  function closeConfirmDialog() {
    setConfirmModalData(null);
  }

  /** Load file & parse */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = parse(content);
        setApiDoc(parsed);
        showMessage("YAML file loaded successfully.", "info");
      } catch (err) {
        showMessage("Invalid YAML file. Please check the file content.", "error");
        console.error("Error parsing YAML:", err);
      }
    };
    reader.readAsText(file);
  };

  /** Download the current YAML */
  const handleDownload = () => {
    const blob = new Blob([yamlOutput], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "api.yaml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 900, margin: "auto", fontFamily: "sans-serif", padding: 20 }}>
      <h2>OpenAPI Generic Editor - Multi-Select for Expose Channels</h2>

      {/* MESSAGES BAR */}
      <MessagesBar messages={messages} onDismiss={dismissMessage} />

      {/* File + Start Fresh */}
      <div style={{ marginBottom: 20 }}>
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

      {/* Info Editor */}
      <InfoEditor apiDoc={apiDoc} setApiDoc={setApiDoc} />

      {/* Paths */}
      <PathsList
        apiDoc={apiDoc}
        setApiDoc={setApiDoc}
        showMessage={showMessage}
        openConfirm={openConfirmDialog}
      />

      {/* Schemas */}
      <SchemasList
        apiDoc={apiDoc}
        setApiDoc={setApiDoc}
        showMessage={showMessage}
        openConfirm={openConfirmDialog}
      />

      {/* YAML Output */}
      <fieldset style={{ border: "1px solid #aaa", padding: 10, marginBottom: 20 }}>
        <legend>
          <strong>YAML Output</strong>
        </legend>
        <textarea
          readOnly
          value={yamlOutput}
          style={{ width: "100%", height: 150, fontFamily: "monospace" }}
          aria-label="Generated YAML Output"
        />
      </fieldset>

      <button onClick={handleDownload}>Download YAML</button>

      {/* GLOBAL CONFIRMATION MODAL */}
      {confirmModalData && (
        <ConfirmationModal
          title={confirmModalData.title}
          message={confirmModalData.message}
          onConfirm={() => {
            confirmModalData.onConfirm();
            closeConfirmDialog();
          }}
          onCancel={() => {
            confirmModalData.onCancel?.();
            closeConfirmDialog();
          }}
        />
      )}
    </div>
  );
};

export default OpenAPIEditorGeneric;

/** -------------------------------------------------------------
 *  MESSAGES BAR (Notifications for user)
 *  -------------------------------------------------------------
 **/
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
    <div style={{ marginBottom: 16 }}>
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

/** -------------------------------------------------------------
 *  CONFIRMATION MODAL
 *  -------------------------------------------------------------
 **/
interface ConfirmModalData {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle} aria-modal="true" role="dialog" aria-labelledby="confirmTitle">
        <div style={{ marginBottom: 10 }}>
          <h3 id="confirmTitle" style={{ margin: 0 }}>
            {title}
          </h3>
        </div>
        <div style={{ marginBottom: 20 }}>{message}</div>
        <div>
          <button
            onClick={onConfirm}
            style={{ marginRight: 8, padding: "5px 12px", cursor: "pointer" }}
          >
            Confirm
          </button>
          <button onClick={onCancel} style={{ padding: "5px 12px", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(0,0,0,0.3)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  padding: 20,
  borderRadius: 6,
  maxWidth: 600,
  width: "80%",
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
};

/** -------------------------------------------------------------
 *  INFO EDITOR 
 *  -------------------------------------------------------------
 **/
interface InfoEditorProps {
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
}

const InfoEditor: React.FC<InfoEditorProps> = ({ apiDoc, setApiDoc }) => {
  const infoFields: GenericFieldConfig[] = [
    { key: "title", label: "Title", type: "text" },
    { key: "version", label: "Version", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
  ];

  const handleInfoSave = (newInfo: any) => {
    setApiDoc({
      ...apiDoc,
      info: { ...apiDoc.info, ...newInfo },
    });
  };

  return (
    <fieldset style={{ border: "1px solid #aaa", padding: 10, marginBottom: 20 }}>
      <legend>
        <strong>API Information</strong>
      </legend>
      <GenericSectionEditor title="Edit Info" data={apiDoc.info} fields={infoFields} onSave={handleInfoSave} />
    </fieldset>
  );
};

/** -------------------------------------------------------------
 *  PATHS LIST + PATH ROW
 *  -------------------------------------------------------------
 **/
interface PathsListProps {
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  showMessage: (msg: string, type: "info" | "error") => void;
  openConfirm: (data: ConfirmModalData) => void;
}

const PathsList: React.FC<PathsListProps> = ({ apiDoc, setApiDoc, showMessage, openConfirm }) => {
  const [showCreatePath, setShowCreatePath] = useState(false);
  const [newPathName, setNewPathName] = useState("");

  const handleAddPath = () => {
    const pathNameTrimmed = newPathName.trim();
    if (!pathNameTrimmed) {
      showMessage("Path name cannot be empty.", "error");
      return;
    }
    if (apiDoc.paths[pathNameTrimmed]) {
      showMessage(`Path "${pathNameTrimmed}" already exists!`, "error");
      return;
    }
    setApiDoc({
      ...apiDoc,
      paths: {
        ...apiDoc.paths,
        [pathNameTrimmed]: {},
      },
    });
    showMessage(`Path "${pathNameTrimmed}" created.`, "info");
    setNewPathName("");
    setShowCreatePath(false);
  };

  const handleDeletePath = (pathName: string) => {
    openConfirm({
      title: "Delete Path?",
      message: `Are you sure you want to delete path "${pathName}"?`,
      onConfirm: () => {
        const updatedPaths = { ...apiDoc.paths };
        delete updatedPaths[pathName];
        setApiDoc({ ...apiDoc, paths: updatedPaths });
        showMessage(`Path "${pathName}" deleted.`, "info");
      },
    });
  };

  return (
    <fieldset style={{ border: "1px solid #aaa", padding: 10, marginBottom: 20 }}>
      <legend>
        <strong>Paths</strong>
      </legend>

      {Object.keys(apiDoc.paths).length === 0 && <p>No paths defined.</p>}

      {Object.entries(apiDoc.paths).map(([pathName, pathItem]) => (
        <PathItemRow
          key={pathName}
          pathName={pathName}
          pathItem={pathItem}
          apiDoc={apiDoc}
          setApiDoc={setApiDoc}
          onDeletePath={() => handleDeletePath(pathName)}
        />
      ))}

      {showCreatePath ? (
        <div style={{ marginTop: 8 }}>
          <label htmlFor="newPathInput" style={{ marginRight: 5 }}>
            New Path:
          </label>
          <input
            id="newPathInput"
            type="text"
            placeholder="/new-path"
            value={newPathName}
            onChange={(e) => setNewPathName(e.target.value)}
            aria-label="New path name"
          />
          <button onClick={handleAddPath} style={{ marginLeft: 5 }}>
            Save
          </button>
          <button onClick={() => setShowCreatePath(false)} style={{ marginLeft: 5 }}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setShowCreatePath(true)} style={{ marginTop: 8 }}>
          + Add Path
        </button>
      )}
    </fieldset>
  );
};

interface PathItemRowProps {
  pathName: string;
  pathItem: PathItem;
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  onDeletePath: () => void;
}

const PathItemRow: React.FC<PathItemRowProps> = ({ pathName, pathItem, apiDoc, setApiDoc, onDeletePath }) => {
  const [editPathModal, setEditPathModal] = useState(false);
  const [tempPathName, setTempPathName] = useState(pathName);

  const handleRenamePath = () => {
    const trimmed = tempPathName.trim();
    if (!trimmed) return;
    if (trimmed === pathName) {
      setEditPathModal(false);
      return;
    }
    if (apiDoc.paths[trimmed]) {
      alert("Path name already exists!");
      return;
    }
    const updated = { ...apiDoc.paths };
    updated[trimmed] = updated[pathName];
    delete updated[pathName];
    setApiDoc({ ...apiDoc, paths: updated });
    setEditPathModal(false);
  };

  return (
    <div style={{ padding: 5, borderBottom: "1px solid #ddd" }}>
      <strong>{pathName}</strong>{" "}
      <button style={{ marginLeft: 10 }} onClick={() => setEditPathModal(true)}>
        Edit
      </button>
      <button style={{ marginLeft: 5 }} onClick={onDeletePath}>
        Delete
      </button>

      <MethodsList pathName={pathName} pathItem={pathItem} apiDoc={apiDoc} setApiDoc={setApiDoc} />

      {editPathModal && (
        <Modal title="Edit Path" onClose={() => setEditPathModal(false)}>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="pathRenameInput">Path Name: </label>
            <input
              id="pathRenameInput"
              type="text"
              value={tempPathName}
              onChange={(e) => setTempPathName(e.target.value)}
            />
          </div>
          <div>
            <button onClick={handleRenamePath} style={{ marginRight: 5 }}>
              Save
            </button>
            <button onClick={() => setEditPathModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

/** -------------------------------------------------------------
 *  METHODS LIST + METHOD ROW
 *  -------------------------------------------------------------
 **/
interface MethodsListProps {
  pathName: string;
  pathItem: PathItem;
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
}

const MethodsList: React.FC<MethodsListProps> = ({ pathName, pathItem, apiDoc, setApiDoc }) => {
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("GET");

  const handleAddMethod = () => {
    const methodLower = selectedMethod.toLowerCase();
    if (pathItem[methodLower]) {
      alert("Method already exists on this path!");
      return;
    }
    setApiDoc({
      ...apiDoc,
      paths: {
        ...apiDoc.paths,
        [pathName]: {
          ...apiDoc.paths[pathName],
          [methodLower]: {
            summary: `New ${selectedMethod} endpoint`,
            responses: { "200": { description: "OK" } },
            'x-expose-to': "", // default
          },
        },
      },
    });
    setShowAddMethod(false);
  };

  const handleDeleteMethod = (method: string) => {
    const updated = { ...apiDoc.paths };
    delete updated[pathName][method];
    setApiDoc({ ...apiDoc, paths: updated });
  };

  return (
    <div style={{ marginLeft: 20, marginTop: 5 }}>
      {Object.entries(pathItem).map(([method, operation]) => (
        <MethodRow
          key={method}
          pathName={pathName}
          method={method}
          operation={operation}
          apiDoc={apiDoc}
          setApiDoc={setApiDoc}
          onDeleteMethod={() => handleDeleteMethod(method)}
        />
      ))}

      {showAddMethod ? (
        <div style={{ marginTop: 5 }}>
          <select value={selectedMethod} onChange={(e) => setSelectedMethod(e.target.value)}>
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button onClick={handleAddMethod} style={{ marginLeft: 5 }}>
            Add
          </button>
          <button onClick={() => setShowAddMethod(false)} style={{ marginLeft: 5 }}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAddMethod(true)} style={{ marginTop: 5 }}>
          + Add Method
        </button>
      )}
    </div>
  );
};

interface MethodRowProps {
  pathName: string;
  method: string;
  operation: OperationObject;
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  onDeleteMethod: () => void;
}

const MethodRow: React.FC<MethodRowProps> = ({
  pathName,
  method,
  operation,
  apiDoc,
  setApiDoc,
  onDeleteMethod,
}) => {
  const [editMethodModal, setEditMethodModal] = useState(false);
  const [editTagsModal, setEditTagsModal] = useState(false);
  const [editReqRespModal, setEditReqRespModal] = useState(false);
  const [exposeModal, setExposeModal] = useState(false);

  const methodFields: GenericFieldConfig[] = [
    { key: "summary", label: "Summary", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "operationId", label: "Operation ID", type: "text" },
  ];

  const handleMethodSave = (updated: any) => {
    const updatedPaths = { ...apiDoc.paths };
    updatedPaths[pathName][method] = {
      ...operation,
      ...updated,
    };
    setApiDoc({ ...apiDoc, paths: updatedPaths });
  };

  // Update tags
  const tags = operation.tags || [];
  const handleAddTag = (newTag: string) => {
    if (!newTag.trim()) return;
    const updatedPaths = { ...apiDoc.paths };
    updatedPaths[pathName][method].tags = [...tags, newTag.trim()];
    setApiDoc({ ...apiDoc, paths: updatedPaths });
  };

  const handleDeleteTag = (tagToDelete: string) => {
    const updatedPaths = { ...apiDoc.paths };
    updatedPaths[pathName][method].tags = tags.filter((t) => t !== tagToDelete);
    setApiDoc({ ...apiDoc, paths: updatedPaths });
  };

  return (
    <div style={{ marginBottom: 5 }}>
      <em>{method.toUpperCase()}:</em> {operation.summary || "(no summary)"}
      <button style={{ marginLeft: 5 }} onClick={() => setEditMethodModal(true)}>
        Edit
      </button>
      <button style={{ marginLeft: 5 }} onClick={() => setEditTagsModal(true)}>
        Tags
      </button>
      <button style={{ marginLeft: 5 }} onClick={() => setEditReqRespModal(true)}>
        Req/Resp
      </button>
      <button style={{ marginLeft: 5 }} onClick={() => setExposeModal(true)}>
        Expose
      </button>
      <button style={{ marginLeft: 5 }} onClick={onDeleteMethod}>
        Delete
      </button>

      {/* Edit Method Basic Info */}
      {editMethodModal && (
        <Modal title={`Edit Method: ${method.toUpperCase()}`} onClose={() => setEditMethodModal(false)}>
          <GenericSectionEditor
            title=""
            data={operation}
            fields={methodFields}
            onSave={(vals) => {
              handleMethodSave(vals);
              setEditMethodModal(false);
            }}
          />
        </Modal>
      )}

      {/* Edit Tags */}
      {editTagsModal && (
        <Modal title={`Tags for ${method.toUpperCase()}`} onClose={() => setEditTagsModal(false)}>
          <TagsEditor tags={tags} onAddTag={handleAddTag} onDeleteTag={handleDeleteTag} />
        </Modal>
      )}

      {/* Edit Request/Response */}
      {editReqRespModal && (
        <Modal
          title={`Request & Response - ${method.toUpperCase()}`}
          onClose={() => setEditReqRespModal(false)}
        >
          <RequestResponseEditor operation={operation} apiDoc={apiDoc} setApiDoc={setApiDoc} pathName={pathName} method={method} />
        </Modal>
      )}

      {/* Edit Expose Channels */}
      {exposeModal && (
        <Modal title={`Set Expose for ${method.toUpperCase()}`} onClose={() => setExposeModal(false)}>
          <MultiSelectExpose
            currentValue={operation['x-expose-to'] || ""}
            onSave={(val) => {
              handleMethodSave({ 'x-expose-to': val });
              setExposeModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

/** -------------------------------------------------------------
 *  TAGS EDITOR
 *  -------------------------------------------------------------
 **/
interface TagsEditorProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
}

const TagsEditor: React.FC<TagsEditorProps> = ({ tags, onAddTag, onDeleteTag }) => {
  const [newTag, setNewTag] = useState("");

  return (
    <div style={{ minWidth: 300 }}>
      <ul>
        {tags.map((tag) => (
          <li key={tag}>
            {tag}{" "}
            <button onClick={() => onDeleteTag(tag)} style={{ marginLeft: 8 }}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 8 }}>
        <label htmlFor="addTagInput">Add Tag:</label>
        <input
          id="addTagInput"
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="New Tag"
          style={{ marginLeft: 5 }}
        />
        <button
          onClick={() => {
            onAddTag(newTag);
            setNewTag("");
          }}
          style={{ marginLeft: 5 }}
        >
          Add Tag
        </button>
      </div>
    </div>
  );
};

/** -------------------------------------------------------------
 *  REQUEST/RESPONSE EDITOR
 *  -------------------------------------------------------------
 **/
interface RequestResponseEditorProps {
  operation: OperationObject;
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  pathName: string;
  method: string;
}
const RequestResponseEditor: React.FC<RequestResponseEditorProps> = ({
  operation,
  apiDoc,
  setApiDoc,
  pathName,
  method,
}) => {
  const [requestSchemaRef, setRequestSchemaRef] = useState("");
  const [responseSchemaRef, setResponseSchemaRef] = useState("");

  const schemaNames = Object.keys(apiDoc.components?.schemas || {});

  useEffect(() => {
    const reqRef = operation.requestBody?.content?.["application/json"]?.schema?.$ref || "";
    const resRef = operation.responses?.["200"]?.content?.["application/json"]?.schema?.$ref || "";
    setRequestSchemaRef(reqRef);
    setResponseSchemaRef(resRef);
  }, [operation]);

  const handleSave = () => {
    const updatedPaths = { ...apiDoc.paths };
    const op = { ...updatedPaths[pathName][method] };

    // Request
    if (!requestSchemaRef) {
      delete op.requestBody;
    } else {
      op.requestBody = {
        content: {
          "application/json": {
            schema: { $ref: requestSchemaRef },
          },
        },
      };
    }

    // 200 Response
    if (!responseSchemaRef) {
      if (op.responses?.["200"]) {
        op.responses["200"].content = undefined;
      }
    } else {
      const desc = op.responses["200"]?.description || "OK";
      op.responses["200"] = {
        description: desc,
        content: {
          "application/json": {
            schema: { $ref: responseSchemaRef },
          },
        },
      };
    }

    updatedPaths[pathName][method] = op;
    setApiDoc((prev) => ({ ...prev, paths: updatedPaths }));
  };

  return (
    <div style={{ minWidth: 300 }}>
      <div>
        <label htmlFor="reqSchemaSelect">Request Schema:</label>
        <select
          id="reqSchemaSelect"
          style={{ marginLeft: 5, marginBottom: 8 }}
          value={requestSchemaRef}
          onChange={(e) => setRequestSchemaRef(e.target.value)}
        >
          <option value="">(None)</option>
          {schemaNames.map((sn) => {
            const fullRef = `#/components/schemas/${sn}`;
            return (
              <option key={sn} value={fullRef}>
                {sn}
              </option>
            );
          })}
        </select>
      </div>
      <div>
        <label htmlFor="resSchemaSelect">200 Response Schema:</label>
        <select
          id="resSchemaSelect"
          style={{ marginLeft: 5 }}
          value={responseSchemaRef}
          onChange={(e) => setResponseSchemaRef(e.target.value)}
        >
          <option value="">(None)</option>
          {schemaNames.map((sn) => {
            const fullRef = `#/components/schemas/${sn}`;
            return (
              <option key={sn} value={fullRef}>
                {sn}
              </option>
            );
          })}
        </select>
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={handleSave} style={{ marginRight: 8 }}>
          Save
        </button>
      </div>
    </div>
  );
};

/** -------------------------------------------------------------
 *  SCHEMAS LIST
 *  -------------------------------------------------------------
 **/
interface SchemasListProps {
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  showMessage: (msg: string, type: "info" | "error") => void;
  openConfirm: (data: ConfirmModalData) => void;
}

const SchemasList: React.FC<SchemasListProps> = ({ apiDoc, setApiDoc, showMessage, openConfirm }) => {
  const [showAddSchema, setShowAddSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState("");

  const handleCreateSchema = () => {
    const trimmedName = newSchemaName.trim();
    if (!trimmedName) {
      showMessage("Schema name cannot be empty.", "error");
      return;
    }
    const existing = apiDoc.components?.schemas || {};
    if (existing[trimmedName]) {
      showMessage(`Schema "${trimmedName}" already exists!`, "error");
      return;
    }
    existing[trimmedName] = { type: "object", properties: {} };
    setApiDoc({
      ...apiDoc,
      components: { ...apiDoc.components, schemas: { ...existing } },
    });
    showMessage(`Schema "${trimmedName}" created.`, "info");
    setNewSchemaName("");
    setShowAddSchema(false);
  };

  const handleDeleteSchema = (schemaName: string) => {
    openConfirm({
      title: "Delete Schema?",
      message: `Are you sure you want to delete schema "${schemaName}"?`,
      onConfirm: () => {
        const updated = { ...apiDoc.components?.schemas };
        delete updated[schemaName];
        setApiDoc({ ...apiDoc, components: { ...apiDoc.components, schemas: updated } });
        showMessage(`Schema "${schemaName}" deleted.`, "info");
      },
    });
  };

  const allSchemas = apiDoc.components?.schemas || {};

  return (
    <fieldset style={{ border: "1px solid #aaa", padding: 10, marginBottom: 20 }}>
      <legend>
        <strong>Schemas</strong>
      </legend>

      {Object.keys(allSchemas).length === 0 && <p>No schemas defined.</p>}

      {Object.entries(allSchemas).map(([schemaName, schemaObj]) => (
        <SchemaRow
          key={schemaName}
          schemaName={schemaName}
          schemaObj={schemaObj}
          apiDoc={apiDoc}
          setApiDoc={setApiDoc}
          onDeleteSchema={() => handleDeleteSchema(schemaName)}
        />
      ))}

      {showAddSchema ? (
        <div style={{ marginTop: 8 }}>
          <label htmlFor="newSchemaInput" style={{ marginRight: 5 }}>
            Schema Name:
          </label>
          <input
            id="newSchemaInput"
            type="text"
            placeholder="MyNewSchema"
            value={newSchemaName}
            onChange={(e) => setNewSchemaName(e.target.value)}
          />
          <button onClick={handleCreateSchema} style={{ marginLeft: 5 }}>
            Create
          </button>
          <button onClick={() => setShowAddSchema(false)} style={{ marginLeft: 5 }}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAddSchema(true)} style={{ marginTop: 10 }}>
          + Add Schema
        </button>
      )}
    </fieldset>
  );
};

interface SchemaRowProps {
  schemaName: string;
  schemaObj: SchemaObject;
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  onDeleteSchema: () => void;
}

const SchemaRow: React.FC<SchemaRowProps> = ({ schemaName, schemaObj, apiDoc, setApiDoc, onDeleteSchema }) => {
  const [editSchemaModal, setEditSchemaModal] = useState(false);

  const isObject = schemaObj.type === "object";
  const isArray = schemaObj.type === "array";
  const props = isObject && schemaObj.properties ? schemaObj.properties : {};

  return (
    <div style={{ padding: 5, borderBottom: "1px solid #ddd" }}>
      <div>
        <strong>{schemaName}</strong>{" "}
        <small>(type: {schemaObj.type || (schemaObj.$ref ? "$ref" : "??")})</small>
        <button style={{ marginLeft: 5 }} onClick={() => setEditSchemaModal(true)}>
          Edit
        </button>
        <button style={{ marginLeft: 5 }} onClick={onDeleteSchema}>
          Delete
        </button>
      </div>

      {isObject && (
        <SchemaPropertiesList
          schemaName={schemaName}
          properties={props}
          apiDoc={apiDoc}
          setApiDoc={setApiDoc}
        />
      )}
      {isArray && schemaObj.items && (
        <div style={{ marginLeft: 20, marginTop: 5 }}>
          <strong>Array Items:</strong>{" "}
          {schemaObj.items.$ref
            ? `($ref) ${schemaObj.items.$ref}`
            : `(type=${schemaObj.items.type || "object"})`}
        </div>
      )}

      {editSchemaModal && (
        <Modal title={`Edit Schema: ${schemaName}`} onClose={() => setEditSchemaModal(false)}>
          <SchemaTypeEditor
            schemaObj={schemaObj}
            onSave={(updated) => {
              const newSchemas = { ...apiDoc.components!.schemas! };
              newSchemas[schemaName] = updated;
              setApiDoc({ ...apiDoc, components: { ...apiDoc.components, schemas: newSchemas } });
              setEditSchemaModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

/** -------------------------------------------------------------
 *  SCHEMA PROPERTIES LIST
 *  -------------------------------------------------------------
 **/
interface SchemaPropertiesListProps {
  schemaName: string;
  properties: Record<string, SchemaObject>;
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
}

const SchemaPropertiesList: React.FC<SchemaPropertiesListProps> = ({
  schemaName,
  properties,
  apiDoc,
  setApiDoc,
}) => {
  const [showAddProp, setShowAddProp] = useState(false);
  const [newPropName, setNewPropName] = useState("");

  const handleAddProperty = () => {
    const trimmed = newPropName.trim();
    if (!trimmed) return;
    const schemaObj = apiDoc.components!.schemas![schemaName];
    const currProps = schemaObj.properties || {};
    if (currProps[trimmed]) {
      alert("Property already exists!");
      return;
    }
    currProps[trimmed] = { type: "string" };
    const newSchemaObj = { ...schemaObj, properties: { ...currProps } };
    setApiDoc({
      ...apiDoc,
      components: {
        ...apiDoc.components,
        schemas: { ...apiDoc.components!.schemas!, [schemaName]: newSchemaObj },
      },
    });
    setNewPropName("");
    setShowAddProp(false);
  };

  const handleDeleteProperty = (propName: string) => {
    const schemaObj = apiDoc.components!.schemas![schemaName];
    const newProps = { ...schemaObj.properties };
    delete newProps[propName];
    schemaObj.properties = newProps;
    setApiDoc({
      ...apiDoc,
      components: {
        ...apiDoc.components,
        schemas: { ...apiDoc.components!.schemas!, [schemaName]: schemaObj },
      },
    });
  };

  return (
    <div style={{ marginLeft: 20, marginTop: 5 }}>
      <strong>Properties:</strong>
      {Object.keys(properties).length === 0 && <p>(no properties)</p>}

      {Object.entries(properties).map(([propName, propSchema]) => (
        <PropertyRow
          key={propName}
          propName={propName}
          propSchema={propSchema}
          schemaName={schemaName}
          apiDoc={apiDoc}
          setApiDoc={setApiDoc}
          onDelete={() => handleDeleteProperty(propName)}
        />
      ))}

      {showAddProp ? (
        <div style={{ marginTop: 8 }}>
          <label htmlFor="newPropInput" style={{ marginRight: 5 }}>
            New Property:
          </label>
          <input
            id="newPropInput"
            type="text"
            placeholder="newProperty"
            value={newPropName}
            onChange={(e) => setNewPropName(e.target.value)}
          />
          <button onClick={handleAddProperty} style={{ marginLeft: 5 }}>
            Add
          </button>
          <button onClick={() => setShowAddProp(false)} style={{ marginLeft: 5 }}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAddProp(true)} style={{ marginTop: 5 }}>
          + Add Property
        </button>
      )}
    </div>
  );
};

/** -------------------------------------------------------------
 *  PROPERTY ROW 
 *  -------------------------------------------------------------
 **/
interface PropertyRowProps {
  propName: string;
  propSchema: SchemaObject;
  schemaName: string;
  apiDoc: OpenAPIDocument;
  setApiDoc: React.Dispatch<React.SetStateAction<OpenAPIDocument>>;
  onDelete: () => void;
}

const PropertyRow: React.FC<PropertyRowProps> = ({
  propName,
  propSchema,
  schemaName,
  apiDoc,
  setApiDoc,
  onDelete,
}) => {
  const [editPropModal, setEditPropModal] = useState(false);

  const handlePropSave = (updated: SchemaObject) => {
    const schemaObj = apiDoc.components!.schemas![schemaName];
    const newProps = { ...schemaObj.properties, [propName]: updated };
    schemaObj.properties = newProps;
    setApiDoc({
      ...apiDoc,
      components: {
        ...apiDoc.components,
        schemas: { ...apiDoc.components!.schemas!, [schemaName]: schemaObj },
      },
    });
  };

  let propLabel = "";
  if (propSchema.$ref) propLabel = `$ref: ${propSchema.$ref}`;
  else if (propSchema.type) propLabel = propSchema.type;
  else propLabel = "(unknown)";

  return (
    <div>
      - <strong>{propName}</strong> <small>({propLabel})</small>
      <button style={{ marginLeft: 5 }} onClick={() => setEditPropModal(true)}>
        Edit
      </button>
      <button style={{ marginLeft: 5 }} onClick={onDelete}>
        Delete
      </button>

      {editPropModal && (
        <Modal title={`Edit Property: ${propName}`} onClose={() => setEditPropModal(false)}>
          <SchemaTypeEditor
            schemaObj={propSchema}
            onSave={(updated) => {
              handlePropSave(updated);
              setEditPropModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

/** -------------------------------------------------------------
 *  SCHEMA TYPE EDITOR
 *  -------------------------------------------------------------
 **/
interface SchemaTypeEditorProps {
  schemaObj: SchemaObject;
  onSave: (updated: SchemaObject) => void;
}
const SchemaTypeEditor: React.FC<SchemaTypeEditorProps> = ({ schemaObj, onSave }) => {
  const [typeChoice, setTypeChoice] = useState(schemaObj.$ref ? "$ref" : schemaObj.type || "object");
  const [refValue, setRefValue] = useState(schemaObj.$ref || "");
  const [itemType, setItemType] = useState(schemaObj.items?.type || "");
  const [itemRef, setItemRef] = useState(schemaObj.items?.$ref || "");

  // Convert the comma-separated xExpose to an array for the multi-select
  const initialExpose = schemaObj['x-expose-to'] ? schemaObj['x-expose-to'].split(",").map((s) => s.trim()) : [];
  const [exposeArray, setExposeArray] = useState<string[]>(initialExpose);

  useEffect(() => {
    if (typeChoice !== "$ref") {
      setRefValue("");
    }
    if (typeChoice !== "array") {
      setItemType("");
      setItemRef("");
    }
  }, [typeChoice]);

  const handleSaveClick = () => {
    let newSchema: SchemaObject = {};

    // handle types
    if (typeChoice === "$ref") {
      newSchema.$ref = refValue.trim();
    } else if (typeChoice === "object") {
      newSchema.type = "object";
      newSchema.properties = schemaObj.properties || {};
    } else if (typeChoice === "array") {
      newSchema.type = "array";
      if (itemRef.trim()) {
        newSchema.items = { $ref: itemRef.trim() };
      } else if (itemType) {
        if (itemType === "object") {
          newSchema.items = { type: "object", properties: {} };
        } else {
          newSchema.items = { type: itemType };
        }
      } else {
        newSchema.items = { type: "string" };
      }
    } else if (["string", "number", "boolean"].includes(typeChoice)) {
      newSchema.type = typeChoice;
    } else {
      // fallback
      newSchema.type = "object";
      newSchema.properties = {};
    }

    // handle xExpose
    if (exposeArray.length > 0) {
      newSchema['x-expose-to'] = exposeArray.join(", ");
    } else {
      delete newSchema['x-expose-to'];
    }

    onSave(newSchema);
  };

  // multi-select event handler
  const handleExposeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValues = Array.from(e.target.selectedOptions).map((option) => option.value);
    setExposeArray(selectedValues);
  };

  return (
    <div style={{ minWidth: 300 }}>
      {/* Type */}
      <div style={{ marginBottom: 8 }}>
        <label htmlFor="schemaTypeSelect">Schema Type:</label>{" "}
        <select
          id="schemaTypeSelect"
          value={typeChoice}
          onChange={(e) => setTypeChoice(e.target.value)}
        >
          <option value="object">object</option>
          <option value="array">array</option>
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="$ref">$ref</option>
        </select>
      </div>

      {typeChoice === "$ref" && (
        <div style={{ marginBottom: 8 }}>
          <label htmlFor="refInput">Reference: </label>{" "}
          <input
            id="refInput"
            type="text"
            value={refValue}
            onChange={(e) => setRefValue(e.target.value)}
            placeholder="#/components/schemas/AnotherSchema"
            style={{ width: "100%" }}
          />
        </div>
      )}

      {typeChoice === "array" && (
        <div style={{ marginBottom: 8 }}>
          <label htmlFor="itemTypeSelect">Array Items: </label>{" "}
          <select
            id="itemTypeSelect"
            value={itemType}
            onChange={(e) => {
              setItemType(e.target.value);
              setItemRef("");
            }}
          >
            <option value="">(select)</option>
            <option value="object">object</option>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="$ref">$ref</option>
          </select>
          {itemType === "$ref" && (
            <div style={{ marginTop: 5 }}>
              <input
                type="text"
                placeholder="#/components/schemas/SomeItemSchema"
                value={itemRef}
                onChange={(e) => setItemRef(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Expose multi-select */}
      <div style={{ marginBottom: 8 }}>
        <label htmlFor="schemaExposeSelect">Expose Channels:</label>
        <select
          id="schemaExposeSelect"
          multiple
          value={exposeArray}
          onChange={handleExposeChange}
          style={{ width: "100%", minHeight: "5em" }}
        >
          {EXPOSE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={handleSaveClick} style={{ marginRight: 8 }}>
          Save
        </button>
      </div>
    </div>
  );
};

/** -------------------------------------------------------------
 *  MULTI-SELECT EXPOSE (for endpoints)
 *  -------------------------------------------------------------
 **/
interface MultiSelectExposeProps {
  currentValue: string;
  onSave: (val: string) => void;
}
const MultiSelectExpose: React.FC<MultiSelectExposeProps> = ({ currentValue, onSave }) => {
  const initialChannels = currentValue ? currentValue.split(",").map((s) => s.trim()) : [];
  const [selected, setSelected] = useState<string[]>(initialChannels);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelected(vals);
  };

  const handleSaveClick = () => {
    onSave(selected.join(", "));
  };

  return (
    <div style={{ minWidth: 300 }}>
      <label htmlFor="multiExposeSelect">Expose Channels:</label>
      <select
        id="multiExposeSelect"
        multiple
        value={selected}
        onChange={handleChange}
        style={{ width: "100%", minHeight: "5em", marginTop: 5 }}
      >
        {EXPOSE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 10 }}>
        <button onClick={handleSaveClick}>Save</button>
      </div>
    </div>
  );
};

/** -------------------------------------------------------------
 *  GENERIC SECTION EDITOR
 *  -------------------------------------------------------------
 **/
interface GenericFieldConfig {
  key: string; // property key in the data object
  label: string;
  type: "text" | "textarea";
}

interface GenericSectionEditorProps {
  title?: string;
  data: any;
  fields: GenericFieldConfig[];
  onSave: (updatedData: any) => void;
}

const GenericSectionEditor: React.FC<GenericSectionEditorProps> = ({
  title,
  data,
  fields,
  onSave,
}) => {
  const [localData, setLocalData] = useState<any>(data || {});

  const handleChange = (key: string, value: string) => {
    setLocalData({ ...localData, [key]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
      {title && <h3>{title}</h3>}
      {fields.map((field) => {
        const val = localData[field.key] || "";
        return (
          <div key={field.key} style={{ marginBottom: 10 }}>
            <label htmlFor={`generic-${field.key}`} style={{ display: "block", marginBottom: 4 }}>
              {field.label}:
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={`generic-${field.key}`}
                value={val}
                onChange={(e) => handleChange(field.key, e.target.value)}
                rows={3}
                style={{ width: "100%" }}
              />
            ) : (
              <input
                id={`generic-${field.key}`}
                type="text"
                value={val}
                onChange={(e) => handleChange(field.key, e.target.value)}
                style={{ width: "100%" }}
              />
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 10 }}>
        <button type="submit" style={{ marginRight: 10 }}>
          Save
        </button>
      </div>
    </form>
  );
};

/** -------------------------------------------------------------
 *  BASIC MODAL WRAPPER
 *  -------------------------------------------------------------
 **/
interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}
const Modal: React.FC<ModalProps> = ({ title, children, onClose }) => {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle} aria-modal="true" role="dialog" aria-labelledby="modalTitle">
        <div style={{ marginBottom: 10 }}>
          <h3 id="modalTitle" style={{ margin: 0 }}>
            {title}
          </h3>
        </div>
        <div>{children}</div>
        <div style={{ marginTop: 10 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};