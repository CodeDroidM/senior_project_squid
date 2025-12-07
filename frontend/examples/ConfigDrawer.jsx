/* eslint react/prop-types: 0 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Box,
  Typography,
  IconButton,
  Toolbar,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Menu,
  MenuItem,
  Checkbox,
  LinearProgress,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import CloudDownloadOutlined from "@mui/icons-material/CloudDownloadOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FilePresentOutlinedIcon from "@mui/icons-material/FilePresentOutlined";
import InsertFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import DataObjectIcon from "@mui/icons-material/DataObject";
import TableViewIcon from "@mui/icons-material/TableView";
import GraphqlIcon from "@mui/icons-material/GraphicEq";
import CodeIcon from "@mui/icons-material/Code";
import StorageIcon from "@mui/icons-material/Storage";
import AddIcon from "@mui/icons-material/Add";
import ArticleIcon from "@mui/icons-material/Article";
import DatabaseIcon from "@mui/icons-material/SquareRounded";

import {
  listConfigs,
  getConfig,
  saveConfig,
  deleteConfig,
  listConfigFolders,
  getConfigFolder,
  saveConfigFolder,
  deleteConfigFolder,
  toggleConfigScope,
  toggleFolderScope,
} from "../api/configs";

import axiosInstance from "../auth/AxiosInstance";
import { useScope } from "../contexts/ScopeContext";

/* -------------------------------------------------------------------------- */
/* constants / helpers                                                        */
/* -------------------------------------------------------------------------- */
const STORAGE_KEY = "configDrawerState";

const getFileExtension = (filename) => {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot).toLowerCase() : "";
};

const getFileIcon = (filename) => {
  const ext = getFileExtension(filename);
  const iconProps = { fontSize: "small", sx: { color: "#666" } };
  
  switch (ext) {
    case '.json':
      return <DataObjectIcon {...iconProps} sx={{ color: "#F7931E" }} />;
    case '.csv':
    case '.xlsx':
    case '.xls':
      return <TableViewIcon {...iconProps} sx={{ color: "#1D6F42" }} />;
    case '.graphql':
    case '.gql':
      return <GraphqlIcon {...iconProps} sx={{ color: "#E535AB" }} />;
    case '.xml':
    case '.yaml':
    case '.yml':
      return <CodeIcon {...iconProps} sx={{ color: "#FF6600" }} />;
    case '.sql':
      return <StorageIcon {...iconProps} sx={{ color: "#336791" }} />;
    case '.txt':
    case '.md':
      return <FilePresentOutlinedIcon {...iconProps} sx={{ color: "#666" }} />;
    default:
      return <InsertFileOutlined {...iconProps} />;
  }
};

const ALLOWED_FILE_EXTENSIONS = [
  "csv", "xlsx", "xls", "json", "xml", "graphql", "gql", "sql", "yaml", "yml", "txt", "md", "config"
];

const ALLOWED_MIME_TYPES = [
  ".csv", ".xlsx", ".xls", ".json", ".xml", ".graphql", ".gql", ".sql", ".yaml", ".yml", ".txt", ".md", ".config"
].join(",");

const isFileTypeAllowed = (filename) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.includes(extension);
};

// File type categorization for better organization
const getFileCategory = (filename) => {
  const ext = getFileExtension(filename);
  if (['.json', '.config'].includes(ext)) return 'config';
  if (['.csv', '.xlsx', '.xls'].includes(ext)) return 'data';
  if (['.graphql', '.gql'].includes(ext)) return 'query';
  if (['.sql'].includes(ext)) return 'database';
  if (['.xml', '.yaml', '.yml'].includes(ext)) return 'markup';
  if (['.txt', '.md'].includes(ext)) return 'document';
  return 'other';
};

const btnSx = {
  bgcolor: "#fff",
  color: "#000",
  border: "2px solid #000",
  boxShadow: "none",
  "&:hover": {
    bgcolor: "#f5f5f5",
    border: "2px solid #000",
    boxShadow: "none",
  },
};

/* -------------------------------------------------------------------------- */
/* component                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * ConfigDrawer component handles file management and loading for different file types.
 * 
 * When files are selected via onSelectConfigFromDb callback, the parent component
 * receives an object with the following structure:
 * 
 * For JSON config files:
 * {
 *   content: object, // JSON object
 *   filePath: string,
 *   name: string,
 *   fileType: 'json',
 *   category: 'config',
 *   isTextFile: false,
 *   folderId?: number,
 *   folderPath?: string
 * }
 * 
 * For text-based files (GraphQL, SQL, YAML, etc.):
 * {
 *   content: string, // Raw text content
 *   filePath: string,
 *   name: string,
 *   fileType: 'graphql'|'sql'|'yaml'|'xml'|'markdown'|'text',
 *   category: 'query'|'database'|'markup'|'document',
 *   isTextFile: true,
 *   folderId?: number,
 *   folderPath?: string
 * }
 * 
 * The parent component should use the fileType for CodeMirror language mode
 * and handle saving differently based on isTextFile flag.
 */
const ConfigDrawer = forwardRef(
  (
    {
      onSelectConfigFromDb,
      addAlert,
      currentConfig = null,
      onSetImportFolder = () => {}, // Handler for selected import folder
      minWidth = 350,
      maxWidth = 600,
      initialWidth = 380,
    },
    ref,
  ) => {
    //eslint-disable-next-line
    const { currentScope, isOrganizationScope } = useScope();
    /* ──────────── state ──────────────────────────────────────────────────── */
    const [expandedFolders, setExpandedFolders] = useState(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return saved.expandedFolders ?? {};
      } catch {
        return {};
      }
    });

    /* DB cache ------------------------------------------------------------- */
    const [dbFolders, setDbFolders] = useState([]); // all folder rows
    const [dbRootConfigs, setDbRootConfigs] = useState([]); // configs without folder
    const [dbAllConfigs, setDbAllConfigs] = useState([]); // all configs for scope checking
    const [folderContents, setFolderContents] = useState({}); // { folderId: { fileName: {content,updated} } }
    const [loading, setLoading] = useState(false);

    /* dialogs / context menu ----------------------------------------------- */
    const [contextMenu, setContextMenu] = useState(null);
    const [contextFolder, setContextFolder] = useState(null);

    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadName, setUploadName] = useState("");
    const [uploadFolder, setUploadFolder] = useState(null);
    const [dragOverFolder, setDragOverFolder] = useState(null);
    const [uploadProgress, setUploadProgress] = useState({});

    const [renameOpen, setRenameOpen] = useState(false);
    const [renameName, setRenameName] = useState("");
    const [renameCfg, setRenameCfg] = useState(null);

    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [newFolderParentId, setNewFolderParentId] = useState(null);

    const [renameFolderOpen, setRenameFolderOpen] = useState(false);
    const [renameFolderName, setRenameFolderName] = useState("");

    const [configContextMenu, setConfigContextMenu] = useState(null);
    const [contextConfig, setContextConfig] = useState(null);

    const [newFileOpen, setNewFileOpen] = useState(false);
    const [newFileName, setNewFileName] = useState("new.config.json");
    const [newFileFolderId, setNewFileFolderId] = useState(null);
    const [newFileType, setNewFileType] = useState("config");

    const [selectedImportFolderId, setSelectedImportFolderId] = useState(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return saved.selectedImportFolderId || null;
      } catch {
        return null;
      }
    });

    const [renameFolderTarget, setRenameFolderTarget] = useState(null);
    
    const [deleteDialogueOpen, setDeleteDialogueOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);

    // Confirmation dialog states
    const [scopeConfirmOpen, setScopeConfirmOpen] = useState(false);
    const [scopeConfirmData, setScopeConfirmData] = useState(null); // { type: 'folder'|'config', item: {...}, action: function }
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteConfirmData, setDeleteConfirmData] = useState(null); // { type: 'folder'|'config', item: {...}, action: function }

    // Helper functions for confirmation dialogs
    const showScopeConfirmation = (type, item, action) => {
      setScopeConfirmData({ type, item, action });
      setScopeConfirmOpen(true);
    };

    const showDeleteConfirmation = (type, item, action) => {
      setDeleteConfirmData({ type, item, action });
      setDeleteConfirmOpen(true);
    };

    const handleScopeConfirm = () => {
      if (scopeConfirmData?.action) {
        scopeConfirmData.action();
      }
      setScopeConfirmOpen(false);
      setScopeConfirmData(null);
    };

    const handleDeleteConfirm = () => {
      if (deleteConfirmData?.action) {
        deleteConfirmData.action();
      }
      setDeleteConfirmOpen(false);
      setDeleteConfirmData(null);
    };

    /* drag and drop for moving items --------------------------------------- */
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'folder'|'config', item: {...}, source: 'folder'|'root' }
  const [dragOverTarget, setDragOverTarget] = useState(null); // { type: 'folder'|'root', id: folderId|null }
  const [isDragging, setIsDragging] = useState(false);

  // Performance optimization: debounced refresh
  const refreshTimeoutRef = useRef(null);

  // Optimistic updates state
  const [optimisticOperations, setOptimisticOperations] = useState(new Map()); // operationId -> { type, data, timestamp }
  const [failedOperations, setFailedOperations] = useState(new Set()); // Set of failed operation IDs    /* resizing ------------------------------------------------------------- */
    const [width, setWidth] = useState(initialWidth);
    const [isResizing, setResizing] = useState(false);
    const sidebarRef = useRef(null);

    /* ──────────── persistence ────────────────────────────────────────────── */
    useEffect(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          expandedFolders,
          selectedImportFolderId,
        }),
      );
    }, [expandedFolders, selectedImportFolderId]);

    /* ──────────── drag-resize ────────────────────────────────────────────── */
    const handleResizeStart = useCallback((e) => {
      e.preventDefault();
      setResizing(true);
    }, []);

    const handleResize = useCallback(
      (e) => {
        if (!isResizing) return;
        requestAnimationFrame(() => {
          const next = e.clientX;
          if (next >= minWidth && next <= maxWidth) setWidth(next);
        });
      },
      [isResizing, minWidth, maxWidth],
    );

    const handleResizeEnd = useCallback(() => setResizing(false), []);

    useEffect(() => {
      if (!isResizing) return;
      window.addEventListener("mousemove", handleResize);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResize);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }, [isResizing, handleResize, handleResizeEnd]);

    /* ──────────── DB fetch / refresh all ─────────────────────────────────── */
    const refreshAllDb = useCallback(async () => {
      setLoading(true);
      try {
        const [folders, configs] = await Promise.all([
          listConfigFolders(),
          listConfigs(),
        ]);

        setDbFolders(folders);
        setDbAllConfigs(configs); // Store all configs for scope checking
        
        // Filter root configs - be more explicit about null/undefined checking
        const rootConfigs = configs.filter((c) => {
          const hasNoFolder = c.folder_id === null || c.folder_id === undefined || c.folder_id === "";
          return hasNoFolder;
        });
        setDbRootConfigs(rootConfigs);

        const byId = {};
        await Promise.all(
          folders.map(async (f) => {
            try {
              const res = await getConfigFolder(f.id);
              byId[f.id] = res.structure ?? {};
            } catch (err) {
              console.error("Folder fetch failed", err);
            }
          }),
        );
        setFolderContents(byId || {});
      } catch (err) {
        console.error(err);
        addAlert?.({ message: "Unable to fetch data", severity: "error" });
      } finally {
        setLoading(false);
      }
    }, [addAlert]);

    // Optimized debounced refresh - prevents excessive API calls
    const debouncedRefresh = useCallback(() => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      refreshTimeoutRef.current = setTimeout(() => {
        refreshAllDb();
      }, 150); // Quick refresh for responsive feel
    }, [refreshAllDb]);

    // Function to invalidate cache for a specific config
    const invalidateConfigCache = useCallback((configName, folderId = null) => {
      console.log(`Invalidating cache for config: ${configName}, folderId: ${folderId}`);
      
      // Clear from folder contents if it's in a folder
      if (folderId !== null && folderId !== undefined) {
        setFolderContents(prev => {
          const newContents = { ...prev };
          if (newContents[folderId] && newContents[folderId][configName]) {
            const updatedFolderContent = { ...newContents[folderId] };
            delete updatedFolderContent[configName];
            newContents[folderId] = updatedFolderContent;
          }
          return newContents;
        });
      }
      
      // Also trigger a refresh to ensure we get fresh data
      debouncedRefresh();
    }, [debouncedRefresh]);

    // Expose refreshAllDb and invalidateConfigCache to parent components
    useImperativeHandle(
      ref,
      () => ({
        refreshAllDb,
        invalidateConfigCache,
      }),
      [refreshAllDb, invalidateConfigCache],
    );

    /* load on mount and scope changes -------------------------------------- */
    useEffect(() => {
      refreshAllDb();
    }, [refreshAllDb]);

    /* refresh when scope changes ------------------------------------------- */
    useEffect(() => {
      refreshAllDb();
    }, [currentScope, refreshAllDb]);

    /* cleanup drag state on unmount --------------------------------------- */
    useEffect(() => {
      return () => {
        setDraggedItem(null);
        setDragOverTarget(null);
        setIsDragging(false);
      };
    }, []);

    /* ──────────── helpers ────────────────────────────────────────────────── */
    const toggleFolder = (fid) =>
      setExpandedFolders((prev) => ({ ...prev, [fid]: !prev?.[fid] }));

    // Optimistic updates helpers
    const createOptimisticOperation = (type, data) => {
      const operationId = crypto.randomUUID();
      const operation = {
        id: operationId,
        type,
        data,
        timestamp: Date.now()
      };
      
      setOptimisticOperations(prev => new Map(prev.set(operationId, operation)));
      return operationId;
    };

    const resolveOptimisticOperation = (operationId, success = true) => {
      if (success) {
        setOptimisticOperations(prev => {
          const newMap = new Map(prev);
          newMap.delete(operationId);
          return newMap;
        });
        setFailedOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(operationId);
          return newSet;
        });
      } else {
        setFailedOperations(prev => new Set(prev.add(operationId)));
      }
    };

    const getOptimisticDbFolders = () => {
      let folders = [...dbFolders];
      
      // Apply optimistic operations
      for (const [operationId, operation] of optimisticOperations) {
        if (failedOperations.has(operationId)) continue;
        
        switch (operation.type) {
          case 'CREATE_FOLDER':
            folders.push(operation.data);
            break;
          case 'UPDATE_FOLDER':
            folders = folders.map(f => 
              f.id === operation.data.id ? { ...f, ...operation.data.changes } : f
            );
            break;
          case 'DELETE_FOLDER':
            folders = folders.filter(f => f.id !== operation.data.id);
            break;
          case 'MOVE_FOLDER':
            folders = folders.map(f => 
              f.id === operation.data.folderId 
                ? { ...f, parent_id: operation.data.newParentId }
                : f
            );
            break;
          default:
            // Unknown operation type, skip
            break;
        }
      }
      
      return folders;
    };

    const getOptimisticDbRootConfigs = () => {
      let configs = [...dbRootConfigs];
      
      // Apply optimistic operations
      for (const [operationId, operation] of optimisticOperations) {
        if (failedOperations.has(operationId)) continue;
        
        switch (operation.type) {
          case 'CREATE_CONFIG':
            if (!operation.data.folder_id) {
              configs.push(operation.data);
            }
            break;
          case 'UPDATE_CONFIG':
            configs = configs.map(c => 
              c.id === operation.data.id ? { ...c, ...operation.data.changes } : c
            );
            break;
          case 'DELETE_CONFIG':
            configs = configs.filter(c => c.id !== operation.data.id);
            break;
          case 'MOVE_CONFIG':
            // Remove from root if moved to folder
            if (operation.data.newFolderId) {
              configs = configs.filter(c => c.id !== operation.data.configId);
            }
            // Add to root if moved from folder
            if (!operation.data.newFolderId && operation.data.config) {
              configs.push({ ...operation.data.config, folder_id: null });
            }
            break;
          default:
            // Unknown operation type, skip
            break;
        }
      }
      
      return configs;
    };

    const getOptimisticFolderContents = () => {
      let contents = { ...folderContents };
      
      // Apply optimistic operations
      for (const [operationId, operation] of optimisticOperations) {
        if (failedOperations.has(operationId)) continue;
        
        switch (operation.type) {
          case 'CREATE_CONFIG':
            if (operation.data.folder_id) {
              const folderId = operation.data.folder_id;
              if (!contents[folderId]) contents[folderId] = {};
              contents[folderId][operation.data.name] = {
                content: operation.data.content,
                updated: new Date().toISOString()
              };
            }
            break;
          case 'DELETE_CONFIG':
            if (operation.data.folder_id) {
              const folderId = operation.data.folder_id;
              if (contents[folderId]) {
                const newFolderContent = { ...contents[folderId] };
                delete newFolderContent[operation.data.name];
                contents[folderId] = newFolderContent;
              }
            }
            break;
          case 'MOVE_CONFIG':
            // Remove from old location
            if (operation.data.oldFolderId && contents[operation.data.oldFolderId]) {
              const newOldContent = { ...contents[operation.data.oldFolderId] };
              delete newOldContent[operation.data.config.name];
              contents[operation.data.oldFolderId] = newOldContent;
            }
            // Add to new location
            if (operation.data.newFolderId) {
              if (!contents[operation.data.newFolderId]) contents[operation.data.newFolderId] = {};
              contents[operation.data.newFolderId][operation.data.config.name] = {
                content: operation.data.config.content,
                updated: new Date().toISOString()
              };
            }
            break;
          default:
            // Unknown operation type, skip
            break;
        }
      }
      
      return contents;
    };

    // File type configurations for creation
    const fileTypeOptions = [
      { value: "config", label: "Config File (.json)", extension: ".json", icon: DataObjectIcon },
      { value: "query", label: "GraphQL Query (.gql)", extension: ".gql", icon: GraphqlIcon },
      { value: "database", label: "SQL Script (.sql)", extension: ".sql", icon: DatabaseIcon },
      { value: "markup", label: "YAML/XML (.yaml)", extension: ".yaml", icon: CodeIcon },
      { value: "document", label: "Text Document (.txt)", extension: ".txt", icon: ArticleIcon },
    ];

    const getFileTypeConfig = (type) => fileTypeOptions.find(opt => opt.value === type) || fileTypeOptions[0];

    const generateFileName = (type, customName = "") => {
      const config = getFileTypeConfig(type);
      if (customName) {
        const hasExtension = customName.includes(".");
        return hasExtension ? customName : `${customName}${config.extension}`;
      }
      return `new-${type}${config.extension}`;
    };

    const loadDbConfig = async (cfg) => {
      try {
        const data = await getConfig(cfg.id);
        if (!data?.content) throw new Error("Empty config");
        
        // Determine file category first to check for data files
        const fileCategory = getFileCategory(cfg.name);
        
        // Check if this is a SeaweedFS reference or large data file
        if (data.content.file_type === 'seaweed_reference' || 
            (data.content.metadata && data.content.metadata.storage_type === 'seaweed') ||
            (data.content.file_type && data.content.file_type.includes('data')) ||
            fileCategory === 'data' ||
            (cfg.name && (cfg.name.endsWith('.xlsx') || cfg.name.endsWith('.csv') || cfg.name.endsWith('.parquet')))) {
          // For SeaweedFS files or large data files, show information about the file
          const fileType = data.content.file_type === 'seaweed_reference' ? 'SeaweedFS file' : 'Data file';
          addAlert?.({
            message: `${fileType}: ${data.content.original_name || cfg.name} (${data.content.category || 'data file'}). File viewing not yet implemented.`,
            severity: "info",
          });
          return;
        }
        
        // Handle different file types
        let contentToLoad;
        let fileType = 'json'; // Default for CodeMirror
        
        if (fileCategory === 'config') {
          // Traditional JSON config files
          contentToLoad = data.content;
          fileType = 'json';
        } else if (data.content.raw_content !== undefined) {
          // Text-based files (GraphQL, SQL, YAML, etc.) stored with raw_content
          contentToLoad = typeof data.content.raw_content === 'string' 
            ? data.content.raw_content 
            : String(data.content.raw_content || '');
          
          // Determine CodeMirror language mode based on file category
          switch (fileCategory) {
            case 'query':
              fileType = 'graphql';
              break;
            case 'database':
              fileType = 'sql';
              break;
            case 'markup':
              fileType = cfg.name.endsWith('.xml') ? 'xml' : 'yaml';
              break;
            case 'document':
              fileType = cfg.name.endsWith('.md') ? 'markdown' : 'text';
              break;
            default:
              fileType = 'text';
          }
        } else {
          // Fallback for other content types - still determine proper file type based on extension
          contentToLoad = data.content;
          
          // Determine CodeMirror language mode based on file category even for fallback
          switch (fileCategory) {
            case 'query':
              fileType = 'graphql';
              break;
            case 'database':
              fileType = 'sql';
              break;
            case 'markup':
              fileType = cfg.name.endsWith('.xml') ? 'xml' : 'yaml';
              break;
            case 'document':
              fileType = cfg.name.endsWith('.md') ? 'markdown' : 'text';
              break;
            default:
              fileType = fileCategory === 'config' ? 'json' : 'text';
          }
        }
        
        onSelectConfigFromDb?.({
          content: contentToLoad,
          filePath: cfg.name,
          name: cfg.name,
          fileType: fileType, // Pass file type for CodeMirror mode
          category: fileCategory, // Pass category for UI context
          isTextFile: fileCategory !== 'config', // Flag to indicate text file vs JSON config
          folderId: cfg.folder_id, // Pass folder context for standalone configs
          folderPath: cfg.folder_id ? dbFolders.find(f => f.id === cfg.folder_id)?.full_path : null, // Include folder path for context
        });
        
      } catch (err) {
        addAlert?.({
          message: `Failed to load ${cfg.name}`,
          severity: "error",
        });
      }
    };

    const handleDelete = async (id) => {
      // Create optimistic operation first
      const configToDelete = dbAllConfigs.find(c => c.id === id);
      const operationId = createOptimisticOperation('DELETE_CONFIG', {
        id,
        name: configToDelete?.name,
        folder_id: configToDelete?.folder_id
      });
      
      try {
        // First, get the config to check if it has SeaweedFS references
        const config = await getConfig(id);
        
        // Check if this config contains SeaweedFS file references
        if (config.content && typeof config.content === 'object') {
          await cleanupSeaweedFSFiles(config.content);
        }
        
        await deleteConfig(id);
        addAlert?.({ message: "Deleted", severity: "success" });
        resolveOptimisticOperation(operationId, true);
        refreshAllDb();
      } catch (err) {
        console.error(err);
        addAlert?.({ message: "Delete failed", severity: "error" });
        resolveOptimisticOperation(operationId, false);
      }
    };

    const handleDeleteFolder = async (id) => {
      // Create optimistic operation first
      const operationId = createOptimisticOperation('DELETE_FOLDER', { id });
      
      try {
        console.log('Deleting folder with ID:', id);
        
        // First, get all configs in this folder and clean up any SeaweedFS files
        const folderContentsToDelete = folderContents[id] || {};
        console.log('Folder contents to delete:', folderContentsToDelete);
        
        for (const [, fileData] of Object.entries(folderContentsToDelete)) {
          if (fileData.content && typeof fileData.content === 'object') {
            await cleanupSeaweedFSFiles(fileData.content);
          }
        }
        
        await deleteConfigFolder(id);
        addAlert?.({ message: "Folder deleted", severity: "success" });
        resolveOptimisticOperation(operationId, true);
        debouncedRefresh();
      } catch (err) {
        addAlert?.({ message: "Delete folder failed", severity: "error" });
        resolveOptimisticOperation(operationId, false);
      }
    };

    // Helper function to clean up SeaweedFS files
    const cleanupSeaweedFSFiles = async (content) => {
      try {
        
        // Check if this is a SeaweedFS reference
        if (content.file_type === 'seaweed_reference' && content.seaweed_file_id) {
          // Delete the file from SeaweedFS
          await axiosInstance.delete(`/user/files/${content.seaweed_file_id}`);
        }
        
        // Recursively check nested objects for more SeaweedFS references
        if (typeof content === 'object' && content !== null) {
          for (const value of Object.values(content)) {
            if (typeof value === 'object' && value !== null) {
              await cleanupSeaweedFSFiles(value);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to delete SeaweedFS file:`, err);
        // Don't throw here - we still want to delete the database entry even if SeaweedFS cleanup fails
      }
    };

    /* upload / rename / new-local ------------------------------------------ */
    const askUpload = (folderId = null) => {
      if (!currentConfig) {
        addAlert?.({ message: "Nothing to upload", severity: "info" });
        return;
      }
      setUploadName("");
      setUploadFolder(folderId);
      setUploadOpen(true);
    };

    const askNewFile = (folderId, fileType = "config") => {
      setNewFileFolderId(folderId);
      setNewFileType(fileType);
      setNewFileName(generateFileName(fileType));
      setNewFileOpen(true);
    };

    const confirmUpload = async () => {
      const name = uploadName.trim();
      if (!name) return;
      
      // Create optimistic config immediately
      const configContent = typeof currentConfig === "string" ? JSON.parse(currentConfig) : currentConfig;
      const tempConfig = {
        id: `temp-${crypto.randomUUID()}`,
        name,
        content: configContent,
        folder_id: uploadFolder,
        sharing_scope: currentScope || "user",
        _isOptimistic: true
      };
      
      const operationId = createOptimisticOperation('CREATE_CONFIG', tempConfig);
      
      // Close dialog immediately for responsive UI
      setUploadOpen(false);
      
      try {
        const savedConfig = await saveConfig({
          name,
          content: configContent,
          folder_id: uploadFolder,
          sharing_scope: currentScope || "user",
        });
        
        // Update the temp config with real data
        setOptimisticOperations(prev => {
          const newMap = new Map(prev);
          const operation = newMap.get(operationId);
          if (operation) {
            operation.data = { ...savedConfig, _isOptimistic: false };
          }
          return newMap;
        });
        
        addAlert?.({ message: `Saved "${name}"`, severity: "success" });
        resolveOptimisticOperation(operationId, true);
        
        // Add small delay to ensure database transaction is committed
        setTimeout(() => {
          refreshAllDb();
        }, 500);
      } catch (err) {
        console.error(err);
        addAlert?.({ message: "Upload failed", severity: "error" });
        resolveOptimisticOperation(operationId, false);
      }
    };

    // Mixed file upload handling adapted for SeaweedFS
    const handleFileUpload = async (files, targetFolderId = null) => {
      const allFiles = [...files].filter(file => {
        // More robust directory detection
        const isDirectory = (
          (file.type === '' && file.size === 0 && !file.name.includes('.')) || // Original check
          (file.type === '' && file.size === 0 && file.webkitRelativePath === file.name) || // Folder itself
          file.name.endsWith('/') // Some browsers add trailing slash for folders
        );
        
        const isAllowed = isFileTypeAllowed(file.name);
        
        return !isDirectory && isAllowed; // Exclude directories and only include valid files
      });
      
      if (allFiles.length === 0) {
        const rejectedFiles = [...files].filter(file => {
          // More robust directory detection for rejection list too
          const isDirectory = (
            (file.type === '' && file.size === 0 && !file.name.includes('.')) ||
            (file.type === '' && file.size === 0 && file.webkitRelativePath === file.name) ||
            file.name.endsWith('/')
          );
          const isRejectedFile = !isDirectory && !isFileTypeAllowed(file.name);
          
          console.log(`Rejection check: ${file.name}, isDirectory: ${isDirectory}, isRejectedFile: ${isRejectedFile}`);
          
          return isRejectedFile; // Only count actual files as rejected
        });
        
        console.log('All files rejected:', rejectedFiles.map(f => ({ name: f.name, extension: f.name.split(".").pop() })));
        
        // Show different message if there are no actual files (just folders) vs actual rejection
        const actualFiles = [...files].filter(file => {
          const isDirectory = (
            (file.type === '' && file.size === 0 && !file.name.includes('.')) ||
            (file.type === '' && file.size === 0 && file.webkitRelativePath === file.name) ||
            file.name.endsWith('/')
          );
          return !isDirectory;
        });
        
        if (actualFiles.length === 0) {
          addAlert?.({ 
            message: "No files found in the dropped folder. Please ensure the folder contains supported file types: " + ALLOWED_FILE_EXTENSIONS.join(", "), 
            severity: "info" 
          });
        } else {
          addAlert?.({ 
            message: "No supported files found. Supported types: " + ALLOWED_FILE_EXTENSIONS.join(", ") + (rejectedFiles.length > 0 ? ". Rejected files: " + rejectedFiles.map(f => f.name).join(", ") : ""), 
            severity: "warning" 
          });
        }
        return;
      }

      const configFiles = [];
      const seaweedFiles = [];
      
      allFiles.forEach(file => {
        const category = getFileCategory(file.name);
        // Route files based on type - only data files go to SeaweedFS
        if (['data'].includes(category)) {
          seaweedFiles.push(file);
        } else {
          // Config, query (GraphQL), database (SQL), markup, and document files go to config storage
          configFiles.push(file);
        }
      });

      console.log(`SeaweedFS files: ${seaweedFiles.length}, Database files: ${configFiles.length}`);

      // Upload data files to SeaweedFS
      if (seaweedFiles.length > 0) {
        try {
          console.log(`Starting SeaweedFS upload for ${seaweedFiles.length} files...`);
          const seaweedPromises = seaweedFiles.map(async (file) => {
            const fileId = crypto.randomUUID();
            setUploadProgress(prev => ({ 
              ...prev, 
              [fileId]: { name: file.name, progress: 0, type: 'seaweed' } 
            }));
            
            const formData = new FormData();
            formData.append('files', file);
            
            console.log(`Uploading ${file.name} to SeaweedFS...`);
            return axiosInstance.post('/user/files/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              onUploadProgress: (evt) => {
                const pct = evt.total ? (evt.loaded / evt.total) * 100 : 0;
                setUploadProgress(prev => ({
                  ...prev,
                  [fileId]: { ...prev[fileId], progress: pct }
                }));
              }
            }).then(response => {
              console.log(`SeaweedFS upload response for ${file.name}:`, response.data);
              
              // Create a reference entry in config storage for easy access
              if (response.data && response.data.uploaded && response.data.uploaded.length > 0) {
                const uploadedFile = response.data.uploaded[0];
                console.log(`Creating database reference for ${file.name}:`, uploadedFile);
                
                // Get folder path for user-friendly storage naming
                let folderPath = '';
                if (targetFolderId) {
                  // Find the folder to get its path
                  const folder = dbFolders.find(f => f.id === targetFolderId);
                  if (folder) {
                    folderPath = folder.full_path || folder.name;
                  }
                }
                
                return saveConfig({
                  name: file.name, // Use original filename instead of adding .ref
                  content: {
                    file_type: 'seaweed_reference',
                    original_name: file.name,
                    seaweed_file_id: uploadedFile.id,
                    seaweed_fid: uploadedFile.fid,
                    category: getFileCategory(file.name),
                    size: uploadedFile.size || file.size,
                    uploaded_at: new Date().toISOString(),
                    folder_path: folderPath,
                    description: folderPath 
                      ? `SeaweedFS file in ${folderPath}/${file.name}` 
                      : `SeaweedFS file ${file.name} (root level)`
                  },
                  folder_id: targetFolderId, // This can be null for root level
                  sharing_scope: currentScope || "user",
                });
              } else {
                console.log(`Upload failed for ${file.name}`);
              }
              return response;
            }).finally(() => {
              setUploadProgress(prev => {
                const updated = { ...prev };
                delete updated[fileId];
                return updated;
              });
            });
          });
          
          await Promise.all(seaweedPromises);
          addAlert?.({ 
            message: `Uploaded ${seaweedFiles.length} data file(s) to SeaweedFS`, 
            severity: "success" 
          });
          
          // Add small delay to ensure database transactions are committed for SeaweedFS references
          setTimeout(() => {
            refreshAllDb();
          }, 500);
        } catch (error) {
          console.error('Error uploading to SeaweedFS:', error);
          addAlert?.({ message: "Failed to upload some files to SeaweedFS", severity: "error" });
        }
      }

      // Upload config and document files to config storage
      if (configFiles.length > 0) {
        try {
          const configPromises = configFiles.map(async (file) => {
            const fileId = crypto.randomUUID();
            setUploadProgress(prev => ({ 
              ...prev, 
              [fileId]: { name: file.name, progress: 0, type: 'config' } 
            }));
            
            const text = await file.text();
            let content;
            const category = getFileCategory(file.name);
            
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: { ...prev[fileId], progress: 50 }
            }));
            
            if (category === 'config') {
              try {
                content = JSON.parse(text);
              } catch {
                // If not valid JSON, wrap in a structure
                content = { 
                  raw_content: text, 
                  file_type: getFileExtension(file.name),
                  parse_error: "Invalid JSON format",
                  category: category
                };
              }
            } else {
              // For non-JSON files, store as structured content
              content = { 
                raw_content: text, 
                file_type: getFileExtension(file.name),
                category: category,
                metadata: {
                  size: file.size,
                  lastModified: file.lastModified
                }
              };
            }
            
            return saveConfig({
              name: file.name,
              content,
              folder_id: targetFolderId,
              sharing_scope: currentScope || "user",
            }).finally(() => {
              setUploadProgress(prev => {
                const updated = { ...prev };
                delete updated[fileId];
                return updated;
              });
            });
          });
          
          await Promise.all(configPromises);
          addAlert?.({ 
            message: `Uploaded ${configFiles.length} file(s) to config storage`, 
            severity: "success" 
          });
          
          // Add small delay to ensure database transactions are committed
          setTimeout(() => {
            refreshAllDb();
          }, 500);
        } catch (error) {
          console.error('Error uploading config files:', error);
          addAlert?.({ message: "Failed to upload some config files", severity: "error" });
        }
      }
    };

    // Drag and drop handlers for file uploads
    const handleDragOver = (e, folderId) => {
      e.preventDefault();
      setDragOverFolder(folderId);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      setDragOverFolder(null);
    };

    // Drag and drop handlers for moving files and folders
    const handleItemDragStart = (e, item, itemType) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ''); // Required for some browsers
      
      setDraggedItem({
        type: itemType, // 'folder' or 'config'
        item: item,
        source: item.folder_id ? 'folder' : 'root'
      });
      setIsDragging(true);
      
      // Hide the default drag image
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
      e.dataTransfer.setDragImage(img, 0, 0);
    };

    const handleItemDragEnd = (e) => {
      setDraggedItem(null);
      setDragOverTarget(null);
      setIsDragging(false);
    };

    const handleItemDragOver = (e, targetType, targetId) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!draggedItem) return;
      
      // CRITICAL: Prevent dropping a folder into itself
      if (draggedItem.type === 'folder' && targetType === 'folder' && draggedItem.item.id === targetId) {
        e.dataTransfer.dropEffect = 'none'; // Visual feedback that drop is not allowed
        return;
      }
      
      // CRITICAL: Prevent dropping a folder into its own children OR itself
      if (draggedItem.type === 'folder' && targetType === 'folder') {
        const targetFolder = dbFolders.find(f => f.id === targetId);
        if (targetFolder && (isDescendantFolder(targetFolder, draggedItem.item.id) || targetFolder.id === draggedItem.item.id)) {
          e.dataTransfer.dropEffect = 'none'; // Visual feedback that drop is not allowed
          return;
        }
      }
      
      e.dataTransfer.dropEffect = 'move';
      setDragOverTarget({ type: targetType, id: targetId });
    };

    const handleItemDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverTarget(null);
    };

    const handleItemDrop = async (e, targetType, targetId) => {
      e.preventDefault();
      e.stopPropagation();
      
      setDragOverTarget(null);
      
      if (!draggedItem) return;
      
      // CRITICAL: Prevent folder from being dropped into itself
      if (draggedItem.type === 'folder' && targetType === 'folder' && draggedItem.item.id === targetId) {
        addAlert?.({
          message: `Cannot move folder "${draggedItem.item.name}" into itself`,
          severity: "error",
        });
        setDraggedItem(null);
        setIsDragging(false);
        return;
      }
      
      // CRITICAL: Prevent folder from being dropped into its own descendants
      if (draggedItem.type === 'folder' && targetType === 'folder') {
        const targetFolder = dbFolders.find(f => f.id === targetId);
        if (targetFolder && (isDescendantFolder(targetFolder, draggedItem.item.id) || targetFolder.id === draggedItem.item.id)) {
          addAlert?.({
            message: `Cannot move folder "${draggedItem.item.name}" into its own subfolder or itself`,
            severity: "error",
          });
          setDraggedItem(null);
          setIsDragging(false);
          return;
        }
      }
      
      // Check if item is already in the target location - skip unnecessary moves
      const currentLocation = draggedItem.type === 'folder' 
        ? draggedItem.item.parent_id 
        : draggedItem.item.folder_id;
      
      const normalizedTargetId = targetType === 'root' ? null : targetId;
      const normalizedCurrentLocation = currentLocation === 0 ? null : currentLocation;
      
      if (normalizedCurrentLocation === normalizedTargetId) {
        setDraggedItem(null);
        setIsDragging(false);
        return; // Skip move - item already in target location
      }
      
      // Declare operationId outside try block so it's accessible in catch
      let operationId;
      
      try {
        // Create optimistic operation first
        if (draggedItem.type === 'folder') {
          operationId = createOptimisticOperation('MOVE_FOLDER', {
            folderId: draggedItem.item.id,
            newParentId: targetId
          });
          await moveFolder(draggedItem.item.id, targetId);
        } else if (draggedItem.type === 'config') {
          operationId = createOptimisticOperation('MOVE_CONFIG', {
            configId: draggedItem.item.id,
            config: draggedItem.item,
            newFolderId: targetId,
            oldFolderId: draggedItem.item.folder_id
          });
          await moveConfig(draggedItem.item, targetId);
        }
        
        addAlert?.({
          message: `Moved ${draggedItem.item.name} successfully`,
          severity: "success",
        });
        
        if (operationId) {
          resolveOptimisticOperation(operationId, true);
        }
        
        // Use debounced refresh instead of immediate + delayed
        debouncedRefresh();
        
      } catch (error) {
        if (operationId) {
          resolveOptimisticOperation(operationId, false);
        }
        addAlert?.({
          message: `Failed to move ${draggedItem.item.name}: ${error.message || 'Unknown error'}`,
          severity: "error",
        });
      } finally {
        setDraggedItem(null);
        setIsDragging(false);
      }
    };

    // Helper function to check if a folder is descendant of another
    const isDescendantFolder = (folder, ancestorId) => {
      if (!folder.parent_id) return false;
      if (folder.parent_id === ancestorId) return true;
      
      const parent = dbFolders.find(f => f.id === folder.parent_id);
      return parent ? isDescendantFolder(parent, ancestorId) : false;
    };

    // API functions for moving items
    const moveFolder = async (folderId, newParentId) => {
      // CRITICAL: Additional safety check - prevent circular reference at API level
      if (folderId === newParentId) {
        throw new Error('Cannot move folder into itself - this would create a circular reference');
      }
      
      // Check if newParentId is a descendant of folderId
      if (newParentId !== null) {
        const targetFolder = dbFolders.find(f => f.id === newParentId);
        if (targetFolder && isDescendantFolder(targetFolder, folderId)) {
          throw new Error('Cannot move folder into its own subfolder - this would create a circular reference');
        }
      }
      
      // First get the current folder data
      const currentFolder = await getConfigFolder(folderId);
      if (!currentFolder) {
        throw new Error('Could not fetch current folder for move operation');
      }
      
      // Use the save_folder endpoint (POST) to update the folder with new parent_id
      const response = await axiosInstance.post('/user/configs/folders', {
        id: folderId, // Include ID to indicate this is an update
        name: currentFolder.name,
        parent_id: newParentId === null ? null : newParentId, // Explicitly handle null for root level
        folder_order: currentFolder.folder_order,
        sharing_scope: currentFolder.sharing_scope || 'user'
      });
      
      return response.data;
    };

    const moveConfig = async (config, newFolderId) => {
      let configId = config.id;
      
      // If config is in a folder structure, we might need to find the actual database ID
      if (config.isInFolder && config.actualDatabaseId) {
        configId = config.actualDatabaseId;
      } else if (config.isInFolder && !configId) {
        // Find the config in dbAllConfigs
        const foundConfig = dbAllConfigs.find(c => 
          c.name === config.name && c.folder_id === config.folder_id
        );
        if (foundConfig) {
          configId = foundConfig.id;
        } else {
          throw new Error('Could not find config ID for move operation');
        }
      }
      
      // Get the current config content first
      const currentConfig = await getConfig(configId);
      if (!currentConfig) {
        throw new Error('Could not fetch current config for move operation');
      }
      
      // Use the save_config endpoint with the same name but different folder_id
      // This will create a new config with the new folder_id, then delete the old one
      try {
        const response = await axiosInstance.post('/user/configs', {
          name: config.name,
          content: currentConfig.content,
          folder_id: newFolderId === null ? null : newFolderId, // Explicitly handle null for root level
          sharing_scope: currentConfig.sharing_scope || 'user'
        });
        
        // Delete the original config to complete the move operation
        try {
          await axiosInstance.delete(`/user/configs/${config.id}`);
        } catch (deleteError) {
          // Don't throw here as the new config was created successfully
        }
        
        return response.data;
      } catch (error) {
        throw new Error(`Failed to move config: ${error.response?.data?.detail || error.message}`);
      }
    };

    // Modern drag and drop handler using DataTransfer items API
    const handleDrop = async (e, folderId) => {
      e.preventDefault();
      setDragOverFolder(null);
      
      // Use modern DataTransfer items API for better folder support
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const items = Array.from(e.dataTransfer.items);
        const entries = [];
        
        // Get entries using webkitGetAsEntry for proper folder detection
        for (const item of items) {
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
              entries.push(entry);
            }
          }
        }
        
        console.log('Entries detected:', entries.map(entry => ({
          name: entry.name,
          isFile: entry.isFile,
          isDirectory: entry.isDirectory
        })));
        
        // Check if any entry is a directory
        const hasDirectories = entries.some(entry => entry.isDirectory);
        
        if (hasDirectories) {
          console.log('Directory detected - processing folder drop');
          await handleModernFolderDrop(entries, folderId);
        } else {
          console.log('Only files detected - processing file drop');
          // For files, we can still use the traditional approach
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            handleFileUpload(files, folderId);
          }
        }
      } else {
        // Fallback to traditional file API
        console.log('Falling back to traditional DataTransfer files API');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          console.log('Drop detected with files:', Array.from(files).map(f => ({ 
            name: f.name, 
            type: f.type, 
            size: f.size, 
            webkitRelativePath: f.webkitRelativePath 
          })));
          
          // Check if this might be a folder drop using webkitRelativePath
          const hasFolder = Array.from(files).some(file => 
            file.webkitRelativePath && file.webkitRelativePath.includes('/')
          );
          
          if (hasFolder) {
            console.log('Treating as folder drop (webkitRelativePath detected)');
            handleFolderUploadToDatabase(files);
          } else {
            console.log('Treating as individual file drop');
            handleFileUpload(files, folderId);
          }
        }
      }
    };

    const openRename = (cfg) => {
      setRenameCfg(cfg);
      setRenameName(cfg.name);
      setRenameOpen(true);
    };

    const confirmRename = async () => {
      const newName = renameName.trim();
      if (!renameCfg || !newName || newName === renameCfg.name) return;
      try {
        if (renameCfg.isInFolder) {
          // Handle renaming configs within folders
          const folderId = renameCfg.folder_id;
          const oldName = renameCfg.name;

          // Get current folder contents to find the config content
          const folderContent = folderContents[folderId];
          if (!folderContent || !folderContent[oldName]) {
            throw new Error("Config not found in folder");
          }

          // Get the config content
          const configContent =
            folderContent[oldName].content || folderContent[oldName];

          // First, get all configs to find the one we want to rename
          const allConfigs = await listConfigs();
          const configToRename = allConfigs.find(
            (c) => c.name === oldName && c.folder_id === folderId,
          );

          if (configToRename) {
            // Delete the old config first
            await deleteConfig(configToRename.id);
          }

          // Create a new config with the new name
          await saveConfig({
            name: newName,
            content: configContent,
            folder_id: folderId,
            sharing_scope: currentScope || "user",
          });

          addAlert?.({
            message: `Renamed to "${newName}"`,
            severity: "success",
          });
          setRenameOpen(false);
          refreshAllDb();
        } else {
          // Handle renaming standalone configs
          const latest = await getConfig(renameCfg.id);
          await saveConfig({
            name: newName,
            content: latest.content,
            folder_id: renameCfg.folder_id,
            sharing_scope: currentScope || "user",
          });
          await deleteConfig(renameCfg.id);
          addAlert?.({
            message: `Renamed to "${newName}"`,
            severity: "success",
          });
          setRenameOpen(false);
          refreshAllDb();
        }
      } catch (err) {
        console.error(err);
        addAlert?.({ message: "Rename failed", severity: "error" });
      }
    };

    const confirmNewFolder = async () => {
      const name = newFolderName.trim();
      if (!name) return;
      
      // Create optimistic folder immediately
      const tempFolder = {
        id: `temp-${crypto.randomUUID()}`,
        name,
        parent_id: newFolderParentId,
        sharing_scope: currentScope || "user",
        full_path: newFolderParentId ? `${dbFolders.find(f => f.id === newFolderParentId)?.full_path || ''}/${name}` : name,
        _isOptimistic: true
      };
      
      const operationId = createOptimisticOperation('CREATE_FOLDER', tempFolder);
      
      // Close dialog immediately for responsive UI
      setNewFolderOpen(false);
      setNewFolderParentId(null);
      setNewFolderName("");
      
      try {
        const savedFolder = await saveConfigFolder({
          name,
          parent_id: newFolderParentId,
          sharing_scope: currentScope || "user",
        });
        
        // Update the temp folder with real data
        setOptimisticOperations(prev => {
          const newMap = new Map(prev);
          const operation = newMap.get(operationId);
          if (operation) {
            operation.data = { ...savedFolder, _isOptimistic: false };
          }
          return newMap;
        });
        
        addAlert?.({
          message: `Created folder "${name}"`,
          severity: "success",
        });
        
        resolveOptimisticOperation(operationId, true);
        debouncedRefresh();
      } catch (err) {
        console.error(err);
        addAlert?.({ message: "Failed to create folder", severity: "error" });
        resolveOptimisticOperation(operationId, false);
      }
    };

    const confirmRenameFolder = async () => {
      const newName = renameFolderName.trim();
      if (!newName || !renameFolderTarget) return; // guards

      // Create optimistic operation
      const operationId = createOptimisticOperation('UPDATE_FOLDER', {
        id: renameFolderTarget.id,
        changes: { name: newName }
      });

      // Close dialog immediately
      setRenameFolderOpen(false);
      setRenameFolderTarget(null);

      try {
        await saveConfigFolder({
          id: renameFolderTarget.id, // update, don't create
          name: newName,
          parent_id: renameFolderTarget.parent_id,
          folder_order: renameFolderTarget.folder_order,
          sharing_scope: currentScope || "user",
        });

        addAlert?.({
          message: `Renamed folder to “${newName}”`,
          severity: "success",
        });
        
        resolveOptimisticOperation(operationId, true);
        debouncedRefresh(); // refresh sidebar
      } catch (err) {
        console.error(err);
        addAlert?.({ message: "Folder rename failed", severity: "error" });
        resolveOptimisticOperation(operationId, false);
      }
    };

    const confirmNewFile = async () => {
      const name = newFileName.trim();
      if (!name) return;
      
      // Create optimistic file immediately
      const fileConfig = getFileTypeConfig(newFileType);
      let content;

      // Create appropriate content based on file type
      switch (newFileType) {
        case "config":
          content = {}; // Empty JSON object
          break;
        case "query":
          content = {
            raw_content: "# GraphQL Query\nquery {\n  # Your query here\n}",
            file_type: ".gql",
            category: "query",
            metadata: { created: new Date().toISOString() }
          };
          break;
        case "database":
          content = {
            raw_content: "-- SQL Script\n-- Your SQL queries here\n",
            file_type: ".sql", 
            category: "database",
            metadata: { created: new Date().toISOString() }
          };
          break;
        case "markup":
          content = {
            raw_content: "# YAML/XML File\n# Your markup content here\n",
            file_type: ".yaml",
            category: "markup", 
            metadata: { created: new Date().toISOString() }
          };
          break;
        case "document":
          content = {
            raw_content: "# Text Document\nYour text content here\n",
            file_type: ".txt",
            category: "document",
            metadata: { created: new Date().toISOString() }
          };
          break;
        default:
          content = {};
      }

      const tempConfig = {
        id: `temp-${crypto.randomUUID()}`,
        name,
        content,
        folder_id: newFileFolderId,
        sharing_scope: currentScope || "user",
        _isOptimistic: true
      };
      
      const operationId = createOptimisticOperation('CREATE_CONFIG', tempConfig);
      
      // Close dialog immediately
      setNewFileOpen(false);
      
      try {
        await saveConfig({
          name,
          content,
          folder_id: newFileFolderId,
          sharing_scope: currentScope || "user",
        });
        
        addAlert?.({ message: `Created ${fileConfig.label} "${name}"`, severity: "success" });
        resolveOptimisticOperation(operationId, true);
        debouncedRefresh();
      } catch (err) {
        console.error(err);
        addAlert?.({ message: "Failed to create file", severity: "error" });
        resolveOptimisticOperation(operationId, false);
      }
    };

    const confirmDeleteReference = async () => {
      if (!toDelete) return;
      
      try {
        // Get the file entry to find the SeaweedFS file ID
        const entry = toDelete.folder_id ? folderContents[toDelete.folder_id]?.[toDelete.name] : null;
        console.log('Delete entry found:', entry);
        
        if (entry?.content?.seaweed_file_id) {
          // Delete the actual file from SeaweedFS
          console.log(`Deleting Data file: ${entry.content.seaweed_file_id}`);
          const deleteResponse = await axiosInstance.delete(`/user/files/${entry.content.seaweed_file_id}`);
          console.log('Data file delete response:', deleteResponse);
        } else {
          console.log('No Data file ID found in entry:', entry);
        }
        
        // Now delete the reference from the database
        // Find the actual config that contains this reference
        const allConfigs = await listConfigs();
        const configWithRef = allConfigs.find(
          (c) => c.name === toDelete.name && c.folder_id === (toDelete.folder_id || null)
        );
        
        console.log('Config with reference found:', configWithRef);
        
        if (configWithRef) {
          await deleteConfig(configWithRef.id);
          addAlert?.({ 
            message: `Reference to "${toDelete.name}" and associated file removed from Data Storage`, 
            severity: "success" 
          });
        } else {
          addAlert?.({ 
            message: `Reference to "${toDelete.name}" removed`, 
            severity: "success" 
          });
        }
        
        setDeleteDialogueOpen(false);
        setToDelete(null);
        
        // Refresh to update the UI
        debouncedRefresh();
      } catch (err) {
        console.error(err);
        addAlert?.({ 
          message: "Failed to remove file reference", 
          severity: "error" 
        });
      }
    };

    // Modern folder drop handler using FileSystem API
    const handleModernFolderDrop = async (entries, targetFolderId = null) => {
      console.log('Processing modern folder drop with entries:', entries.length);
      
      try {
        setLoading(true);
        
        // Collect all files from directories recursively
        const allFiles = [];
        await Promise.all(entries.map(entry => processEntry(entry, '', allFiles)));
        
        console.log('Collected files from directories:', allFiles.length);
        
        if (allFiles.length === 0) {
          addAlert?.({
            message: "No supported files found in the dropped folders. Supported types: " + ALLOWED_FILE_EXTENSIONS.join(", "),
            severity: "info"
          });
          return;
        }
        
        // Filter files by allowed types
        const validFiles = allFiles.filter(fileInfo => {
          const isAllowed = isFileTypeAllowed(fileInfo.name);
          console.log(`File validation: ${fileInfo.name}, isAllowed: ${isAllowed}`);
          return isAllowed;
        });
        
        if (validFiles.length === 0) {
          const rejectedFiles = allFiles.filter(f => !isFileTypeAllowed(f.name));
          addAlert?.({
            message: `No supported files found. Found ${allFiles.length} files total, ${rejectedFiles.length} unsupported. Supported types: ${ALLOWED_FILE_EXTENSIONS.join(", ")}`,
            severity: "warning"
          });
          return;
        }
        
        // Build folder structure and upload files
        await processFileStructure(validFiles, targetFolderId);
        
        addAlert?.({
          message: `Successfully uploaded folder structure with ${validFiles.length} files`,
          severity: "success"
        });
        
        // Refresh the UI
        setTimeout(() => {
          refreshAllDb();
        }, 500);
        
      } catch (error) {
        console.error("Modern folder drop failed:", error);
        addAlert?.({
          message: "Failed to upload folder structure: " + error.message,
          severity: "error"
        });
      } finally {
        setLoading(false);
      }
    };
    
    // Recursively process directory entries using FileSystem API
    const processEntry = async (entry, currentPath, allFiles) => {
      if (entry.isFile) {
        // Get the file and add it to our collection
        return new Promise((resolve, reject) => {
          entry.file(file => {
            allFiles.push({
              file: file,
              name: file.name,
              relativePath: currentPath ? `${currentPath}/${file.name}` : file.name
            });
            resolve();
          }, reject);
        });
      } else if (entry.isDirectory) {
        // Read directory contents
        return new Promise((resolve, reject) => {
          const dirReader = entry.createReader();
          
          const readEntries = async () => {
            try {
              const entries = await new Promise((resolveRead, rejectRead) => {
                dirReader.readEntries(resolveRead, rejectRead);
              });
              
              if (entries.length === 0) {
                // No more entries
                resolve();
                return;
              }
              
              // Process each entry in this directory
              const subPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
              await Promise.all(entries.map(subEntry => processEntry(subEntry, subPath, allFiles)));
              
              // Continue reading (directories may have more entries)
              await readEntries();
            } catch (error) {
              reject(error);
            }
          };
          
          readEntries().then(resolve).catch(reject);
        });
      }
    };
    
    // Process the file structure and upload to database
    const processFileStructure = async (fileInfos, targetFolderId) => {
      console.log('Processing file structure for upload:', fileInfos.length, 'files');
      
      // Build folder structure map
      const folderMap = new Map(); // path -> folder object
      const filesByFolder = new Map(); // folderId -> files[]
      
      // Extract unique folder paths
      const folderPaths = [...new Set(
        fileInfos.map(fileInfo => {
          const parts = fileInfo.relativePath.split("/");
          const folderParts = parts.slice(0, -1); // Remove filename
          return folderParts.join("/");
        }).filter(path => path) // Remove empty paths for root files
      )].sort(); // Sort to ensure parent folders are created first

      console.log('Creating folder structure:', folderPaths);

      // Create folders in database
      for (const folderPath of folderPaths) {
        const parts = folderPath.split("/");
        let parentId = targetFolderId; // Use target folder as root parent
        let currentPath = "";
        
        // Create each level of the folder hierarchy
        for (let i = 0; i < parts.length; i++) {
          const folderName = parts[i];
          currentPath = parts.slice(0, i + 1).join("/");
          
          if (!folderMap.has(currentPath)) {
            try {
              console.log(`Creating folder: ${folderName} (parent: ${parentId})`);
              const folder = await saveConfigFolder({
                name: folderName,
                parent_id: parentId,
                sharing_scope: currentScope || "user",
              });
              folderMap.set(currentPath, folder);
              addAlert?.({
                message: `Created folder: ${folderName}`,
                severity: "info"
              });
            } catch (err) {
              console.error(`Failed to create folder ${folderName}:`, err);
              addAlert?.({
                message: `Failed to create folder: ${folderName}`,
                severity: "error"
              });
            }
          }
          
          parentId = folderMap.get(currentPath)?.id;
        }
      }

      // Organize files by destination folder
      fileInfos.forEach(fileInfo => {
        const parts = fileInfo.relativePath.split("/");
        const folderPath = parts.slice(0, -1).join("/");
        const folderId = folderPath ? folderMap.get(folderPath)?.id : targetFolderId;
        
        if (!filesByFolder.has(folderId)) {
          filesByFolder.set(folderId, []);
        }
        filesByFolder.get(folderId).push(fileInfo.file);
      });

      // Upload files to their respective folders
      console.log('Uploading files to folders:', filesByFolder.size, 'destinations');
      for (const [folderId, folderFiles] of filesByFolder.entries()) {
        console.log(`Uploading ${folderFiles.length} files to folder ${folderId}`);
        await handleFileUpload(folderFiles, folderId);
      }
    };

    const handleFolderUploadToDatabase = async (fileList) => {
      const allFiles = Array.from(fileList ?? []);
      
      console.log('handleFolderUploadToDatabase called with:', allFiles.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        webkitRelativePath: f.webkitRelativePath
      })));
      
      const files = allFiles.filter((file) => {
        const fileName = file.name;
        const isHidden = fileName.startsWith(".") || fileName === ".DS_Store";
        
        // More robust directory detection
        const isDirectory = (
          (file.type === '' && file.size === 0 && !fileName.includes('.')) || // Original check
          (file.type === '' && file.size === 0 && file.webkitRelativePath === fileName) || // Folder itself
          fileName.endsWith('/') // Some browsers add trailing slash for folders
        );
        
        const isAllowed = isFileTypeAllowed(fileName);
        
        console.log(`Folder upload file validation: ${fileName}, isHidden: ${isHidden}, isDirectory: ${isDirectory}, isAllowed: ${isAllowed}, type: "${file.type}", size: ${file.size}, webkitRelativePath: "${file.webkitRelativePath}"`);
        
        return !isHidden && !isDirectory && isAllowed; // Exclude hidden files, directories, and include only valid files
      });
      
      if (!files.length) {
        const rejectedFiles = allFiles.filter(f => {
          const isHidden = f.name.startsWith(".") || f.name === ".DS_Store";
          
          // More robust directory detection
          const isDirectory = (
            (f.type === '' && f.size === 0 && !f.name.includes('.')) ||
            (f.type === '' && f.size === 0 && f.webkitRelativePath === f.name) ||
            f.name.endsWith('/')
          );
          
          const isAllowed = isFileTypeAllowed(f.name);
          
          // Only count as rejected if it's not hidden, not a directory, and not allowed
          return !isHidden && !isDirectory && !isAllowed;
        });
        
        // Count actual files (not directories) to give better feedback
        const actualFiles = allFiles.filter(f => {
          const isDirectory = (
            (f.type === '' && f.size === 0 && !f.name.includes('.')) ||
            (f.type === '' && f.size === 0 && f.webkitRelativePath === f.name) ||
            f.name.endsWith('/')
          );
          const isHidden = f.name.startsWith(".") || f.name === ".DS_Store";
          return !isDirectory && !isHidden;
        });
        
        console.log(`Folder upload validation failed:`, {
          totalFiles: allFiles.length,
          actualFiles: actualFiles.length,
          supportedFiles: files.length,
          rejectedFiles: rejectedFiles.map(f => ({ name: f.name, extension: f.name.split(".").pop() }))
        });
        
        if (actualFiles.length === 0) {
          addAlert?.({
            message: `No files found in the uploaded folder. The folder appears to be empty or contains only subdirectories.`,
            severity: "info",
          });
        } else {
          addAlert?.({
            message: `No supported files found in the folder. Found ${actualFiles.length} files total, ${rejectedFiles.length} unsupported. Supported types: ${ALLOWED_FILE_EXTENSIONS.join(", ")}. Unsupported files: ${rejectedFiles.map(f => f.name).join(", ")}`,
            severity: "warning",
          });
        }
        return;
      }

      try {
        setLoading(true);
        
        // Build folder structure map
        const folderMap = new Map(); // path -> folder object
        const filesByFolder = new Map(); // folderId -> files[]
        
        // Extract unique folder paths
        const folderPaths = [...new Set(
          files.map(file => {
            const parts = file.webkitRelativePath.split("/");
            const folderParts = parts.slice(0, -1); // Remove filename
            return folderParts.join("/");
          }).filter(path => path) // Remove empty paths for root files
        )].sort(); // Sort to ensure parent folders are created first

        // Create folders in database
        for (const folderPath of folderPaths) {
          const parts = folderPath.split("/");
          let parentId = null;
          let currentPath = "";
          
          // Create each level of the folder hierarchy
          for (let i = 0; i < parts.length; i++) {
            const folderName = parts[i];
            currentPath = parts.slice(0, i + 1).join("/");
            
            if (!folderMap.has(currentPath)) {
              try {
                const folder = await saveConfigFolder({
                  name: folderName,
                  parent_id: parentId,
                  sharing_scope: currentScope || "user",
                });
                folderMap.set(currentPath, folder);
                addAlert?.({
                  message: `Created folder: ${folderName}`,
                  severity: "info"
                });
              } catch (err) {
                console.error(`Failed to create folder ${folderName}:`, err);
                addAlert?.({
                  message: `Failed to create folder: ${folderName}`,
                  severity: "error"
                });
              }
            }
            
            parentId = folderMap.get(currentPath)?.id;
          }
        }

        // Separate files by destination and organize by folder
        files.forEach(file => {
          const parts = file.webkitRelativePath.split("/");
          const folderPath = parts.slice(0, -1).join("/");
          const folderId = folderPath ? folderMap.get(folderPath)?.id : null;
          
          if (!filesByFolder.has(folderId)) {
            filesByFolder.set(folderId, []);
          }
          filesByFolder.get(folderId).push(file);
        });

        // Upload files to their respective folders
        for (const [folderId, folderFiles] of filesByFolder.entries()) {
          await handleFileUpload(folderFiles, folderId);
        }

        addAlert?.({
          message: `Successfully uploaded folder structure with ${files.length} files`,
          severity: "success"
        });
        
        // Use debounced refresh instead of immediate refresh
        debouncedRefresh();
        
      } catch (error) {
        addAlert?.({
          message: "Failed to upload folder structure",
          severity: "error"
        });
      } finally {
        setLoading(false);
      }
    };

    const handleFolderContextMenu = (event, folder) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ x: event.clientX, y: event.clientY });
      setContextFolder(folder);
      setNewFolderParentId(folder.id);
      setConfigContextMenu(null);
      setContextConfig(null);
    };

    const handleConfigContextMenu = (event, config) => {
      event.preventDefault();
      event.stopPropagation();
      setConfigContextMenu({ x: event.clientX, y: event.clientY });
      
      // Check if this is a SeaweedFS reference
      let isSeaweedRef = false;
      if (config.isInFolder && config.folder_id && config.name) {
        const entry = folderContents[config.folder_id]?.[config.name];
        isSeaweedRef = entry?.content?.file_type === 'seaweed_reference';
      }
      
      setContextConfig({
        ...config,
        isSeaweedRef
      });
      setContextMenu(null);
      setContextFolder(null);
    };

    const handleCloseAllContextMenus = () => {
      setContextMenu(null);
      setContextFolder(null);
      setConfigContextMenu(null);
      setContextConfig(null);
    };

    /* ──────────── DB tree renderer ──────────────────────────────────────── */
    const renderDbTree = () => {
      // Use optimistic data instead of raw database data
      const optimisticFolders = getOptimisticDbFolders();
      const optimisticRootConfigs = getOptimisticDbRootConfigs();
      const optimisticFolderContents = getOptimisticFolderContents();
      
      // Sort folders alphabetically
      const rootFolders = optimisticFolders
        .filter((f) => !f.parent_id)
        .sort((a, b) => a.name.localeCompare(b.name));

      // Get all config names that are already inside folders to avoid duplicates
      // But only for configs that have the same content - we allow same-named configs with different content
      const configsInFolders = new Set();
      Object.values(optimisticFolderContents).forEach((folderContent) => {
        Object.keys(folderContent).forEach((configName) => {
          configsInFolders.add(configName);
        });
      });

      // Only show configs that are truly at root level
      // We'll allow root configs even if there are folder configs with the same name
      const sortedRootConfigs = [...optimisticRootConfigs]
        .filter((config) => {
          const isRootLevel =
            config.folder_id === null || 
            config.folder_id === undefined || 
            config.folder_id === "" ||
            config.folder_id === 0; // Some databases might use 0 instead of null
          
          // For now, show all root level configs regardless of name conflicts
          // This will show duplicates, but that's better than hiding moved configs
          const notInAnyFolder = true; // !configsInFolders.has(config.name);
          
          return isRootLevel && notInAnyFolder;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const renderFolder = (folder, level) => {
        // Sort child folders alphabetically
        const childFolders = optimisticFolders
          .filter((f) => f.parent_id === folder.id)
          .sort((a, b) => a.name.localeCompare(b.name));

        // Sort configs alphabetically and group by category
        const allConfigs = Object.entries(optimisticFolderContents[folder.id] || {})
          .map(([name, meta]) => ({ name, updated: meta.updated, category: getFileCategory(name) }))
          .sort((a, b) => {
            // First sort by category, then by name
            if (a.category !== b.category) {
              const categoryOrder = ['config', 'data', 'query', 'database', 'markup', 'document', 'other'];
              return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
            }
            return a.name.localeCompare(b.name);
          });

        const isOpen = !!expandedFolders?.[folder.id];
        const isSelected = selectedImportFolderId === folder.id;

        const handleCheckboxClick = (e) => {
          e.stopPropagation(); // Prevent folder toggle
          const newSelectedId = isSelected ? null : folder.id;
          setSelectedImportFolderId(newSelectedId);

          // Find the selected folder object to pass to the parent component
          const selectedFolder = newSelectedId ? folder : null;

          // Call the external handler with selected folder
          onSetImportFolder(selectedFolder);

          if (newSelectedId) {
            addAlert?.({
              message: `Folder "${folder.name}" selected for import`,
              severity: "success",
            });
          } else {
            addAlert?.({
              message: `Folder "${folder.name}" unselected`,
              severity: "info",
            });
          }
        };

        const isDraggedFolder = draggedItem?.type === 'folder' && draggedItem.item.id === folder.id;
        const isDropTarget = dragOverTarget?.type === 'folder' && dragOverTarget.id === folder.id;
        const isValidDropTarget = draggedItem && !isDraggedFolder && 
          !(draggedItem.type === 'folder' && isDescendantFolder(folder, draggedItem.item.id));

        // Check if this folder is part of an optimistic operation
        const isOptimistic = folder._isOptimistic;
        const hasFailedOperation = isOptimistic && Array.from(optimisticOperations.entries()).some(([operationId, operation]) => 
          operation.data.id === folder.id && failedOperations.has(operationId)
        );

        return (
          <React.Fragment key={`folder-${folder.id}`}>
            <ListItem
              button
              draggable
              data-folder-id={folder.id}
              sx={{
                pl: level * 1.5 + 1,
                py: 0.5,
                minHeight: 32,
                bgcolor: hasFailedOperation
                  ? "rgba(244, 67, 54, 0.08)"
                  : isOptimistic
                  ? "rgba(33, 150, 243, 0.08)"
                  : isSelected
                  ? "rgba(25, 118, 210, 0.08)"
                  : isDropTarget
                  ? "rgba(255, 193, 7, 0.15)"
                  : dragOverFolder === folder.id
                  ? "rgba(76, 175, 80, 0.1)"
                  : "transparent",
                border: hasFailedOperation
                  ? "2px solid #f44336"
                  : isOptimistic
                  ? "2px dashed #2196f3"
                  : isDropTarget
                  ? "2px dashed #ff9800" 
                  : dragOverFolder === folder.id 
                  ? "2px dashed #4caf50" 
                  : "2px solid transparent",
                borderRadius: 1,
                transition: "all 0.2s ease",
                opacity: isDraggedFolder ? 0.5 : (hasFailedOperation ? 0.7 : 1),
                "&:hover": {
                  backgroundColor: isSelected 
                    ? "rgba(25, 118, 210, 0.12)"
                    : isValidDropTarget 
                    ? "rgba(255, 193, 7, 0.08)"
                    : "rgba(0, 0, 0, 0.04)"
                },
                cursor: isDragging && !isDraggedFolder ? 'move' : 'pointer',
              }}
              onClick={() => toggleFolder(folder.id)}
              onContextMenu={(e) => handleFolderContextMenu(e, folder)}
              onDragStart={(e) => handleItemDragStart(e, folder, 'folder')}
              onDragEnd={handleItemDragEnd}
              onDragOver={(e) => {
                if (draggedItem) {
                  // Moving items
                  handleItemDragOver(e, 'folder', folder.id);
                } else {
                  // File uploads
                  handleDragOver(e, folder.id);
                }
              }}
              onDragLeave={(e) => {
                if (draggedItem) {
                  handleItemDragLeave(e);
                } else {
                  handleDragLeave(e);
                }
              }}
              onDrop={(e) => {
                if (draggedItem) {
                  // Moving items
                  handleItemDrop(e, 'folder', folder.id);
                } else {
                  // File uploads
                  handleDrop(e, folder.id);
                }
              }}
            >
              <Checkbox
                checked={isSelected}
                onChange={handleCheckboxClick}
                onClick={(e) => e.stopPropagation()}
                size="small"
                color="primary"
                sx={{ mr: 1 }}
              />
              <ListItemIcon sx={{ minWidth: 30 }}>
                {childFolders.length > 0 || allConfigs.length > 0 ? (
                  isOpen ? (
                    <FolderOpenIcon
                      fontSize="small"
                      sx={{ color: "#1976d2" }}
                    />
                  ) : (
                    <FolderOutlinedIcon
                      fontSize="small"
                      sx={{ color: "#1976d2" }}
                    />
                  )
                ) : (
                  <FolderOutlinedIcon
                    fontSize="small"
                    sx={{ color: "#757575" }}
                  />
                )}
                {childFolders.length > 0 || allConfigs.length > 0 ? (
                  isOpen ? (
                    <ExpandMore
                      fontSize="small"
                      sx={{ ml: 0.5, color: "text.secondary" }}
                    />
                  ) : (
                    <ChevronRight
                      fontSize="small"
                      sx={{ ml: 0.5, color: "text.secondary" }}
                    />
                  )
                ) : null}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: "medium" }}>
                      {folder.name}
                      {isOptimistic && !hasFailedOperation && (
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: "#2196f3" }}>
                          (syncing...)
                        </Typography>
                      )}
                      {hasFailedOperation && (
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: "#f44336" }}>
                          (failed - click to retry)
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      ({allConfigs.length} files)
                    </Typography>
                  </Box>
                }
                secondary={folder.full_path}
                primaryTypographyProps={{
                  noWrap: true,
                }}
                secondaryTypographyProps={{ noWrap: true }}
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFolderContextMenu(e, folder);
                }}
              >
                <MoreVertIcon fontSize="small" sx={{ color: "#666" }} />
              </IconButton>
            </ListItem>

            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <List 
                disablePadding 
                data-folder-id={folder.id}
                sx={{
                  bgcolor: isDropTarget ? "rgba(255, 193, 7, 0.05)" : "transparent",
                  borderLeft: isDropTarget ? "3px solid #ff9800" : "3px solid transparent",
                  transition: "all 0.2s ease"
                }}
                onDragOver={(e) => {
                  if (draggedItem) {
                    // When hovering over folder contents, highlight the folder as drop target
                    handleItemDragOver(e, 'folder', folder.id);
                  } else {
                    // File uploads
                    handleDragOver(e, folder.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (draggedItem) {
                    handleItemDragLeave(e);
                  } else {
                    handleDragLeave(e);
                  }
                }}
                onDrop={(e) => {
                  if (draggedItem) {
                    // Moving items to this folder
                    handleItemDrop(e, 'folder', folder.id);
                  } else {
                    // File uploads
                    handleDrop(e, folder.id);
                  }
                }}
              >
                {/* Render child folders first */}
                {childFolders.map((child) => renderFolder(child, level + 1))}

                {/* Render configs in this folder with SeaweedFS support */}
                {allConfigs.map((cfg) => {
                  const entry = folderContents[folder.id][cfg.name];
                  const isSeaweedRef = entry?.content?.file_type === 'seaweed_reference';
                  
                  // Find the actual config for dragging
                  const actualConfig = dbAllConfigs.find(
                    (c) => c.name === cfg.name && c.folder_id === folder.id
                  );
                  
                  const configForDrag = actualConfig || {
                    id: `${folder.id}-${cfg.name}`,
                    name: cfg.name,
                    folder_id: folder.id,
                    isInFolder: true,
                    actualDatabaseId: actualConfig ? actualConfig.id : null,
                  };
                  
                  const isDraggedConfig = draggedItem?.type === 'config' && 
                    ((draggedItem.item.id === configForDrag.id) || 
                     (draggedItem.item.name === configForDrag.name && draggedItem.item.folder_id === configForDrag.folder_id));
                  
                  // Check if this config is part of an optimistic operation
                  const isOptimisticConfig = configForDrag._isOptimistic;
                  const hasFailedConfigOperation = isOptimisticConfig && Array.from(optimisticOperations.entries()).some(([operationId, operation]) => 
                    operation.data.id === configForDrag.id && failedOperations.has(operationId)
                  );
                  
                  return (
                    <ListItem
                      key={`cfg-${folder.id}-${cfg.name}`}
                      button
                      draggable
                      data-folder-id={folder.id}
                      sx={{ 
                        pl: (level + 1) * 1.5 + 2.5,
                        py: 0.25,
                        minHeight: 28,
                        bgcolor: hasFailedConfigOperation
                          ? 'rgba(244, 67, 54, 0.08)'
                          : isOptimisticConfig
                          ? 'rgba(33, 150, 243, 0.08)'
                          : isSeaweedRef 
                          ? 'rgba(76, 175, 80, 0.05)' 
                          : 'transparent',
                        border: hasFailedConfigOperation
                          ? '1px solid #f44336'
                          : isOptimisticConfig
                          ? '1px dashed #2196f3'
                          : 'none',
                        borderRadius: hasFailedConfigOperation || isOptimisticConfig ? 1 : 0,
                        opacity: isDraggedConfig ? 0.5 : (hasFailedConfigOperation ? 0.7 : 1),
                        cursor: isDragging && !isDraggedConfig ? 'move' : 'pointer',
                        transition: "all 0.2s ease",
                        "&:hover": {
                          backgroundColor: isSeaweedRef 
                            ? "rgba(76, 175, 80, 0.15)" 
                            : "rgba(0, 0, 0, 0.08)"
                        }
                      }}
                      onDragStart={(e) => handleItemDragStart(e, configForDrag, 'config')}
                      onDragEnd={handleItemDragEnd}
                      onClick={() => {
                        if (isSeaweedRef) {
                          // Handle SeaweedFS file reference - could open download or preview
                          const originalName = entry.content.original_name;
                          const fileId = entry.content.seaweed_file_id;
                          addAlert?.({
                            message: `Data file: ${originalName} (ID: ${fileId})`,
                            severity: "info",
                          });
                          // You could implement download logic here:
                          // window.open(`/user/files/${fileId}`, '_blank');
                        } else {
                          // Use the same logic as the main loadDbConfig function
                          try {
                            const fileCategory = getFileCategory(cfg.name);
                            
                            // Check if this is a SeaweedFS reference or large data file (same logic as loadDbConfig)
                            if ((entry.content && entry.content.file_type === 'seaweed_reference') || 
                                (entry.content && entry.content.metadata && entry.content.metadata.storage_type === 'seaweed') ||
                                (entry.content && entry.content.file_type && entry.content.file_type.includes('data')) ||
                                fileCategory === 'data' ||
                                (cfg.name && (cfg.name.endsWith('.xlsx') || cfg.name.endsWith('.csv') || cfg.name.endsWith('.parquet')))) {
                              // For SeaweedFS files or large data files, show information about the file
                              const fileType = (entry.content && entry.content.file_type === 'seaweed_reference') ? 'SeaweedFS file' : 'Data file';
                              addAlert?.({
                                message: `${fileType}: ${(entry.content && entry.content.original_name) || cfg.name} (${(entry.content && entry.content.category) || 'data file'}). File viewing not yet implemented.`,
                                severity: "info",
                              });
                              return;
                            }
                            
                            let contentToLoad;
                            let fileType = 'json'; // Default for CodeMirror
                            
                            if (fileCategory === 'config') {
                              // Traditional JSON config files
                              contentToLoad = entry.content || entry;
                              fileType = 'json';
                            } else if (entry.content && entry.content.raw_content !== undefined) {
                              // Text-based files (GraphQL, SQL, YAML, etc.) stored with raw_content
                              contentToLoad = entry.content.raw_content;
                              
                              // Determine CodeMirror language mode based on file category
                              switch (fileCategory) {
                                case 'query':
                                  fileType = 'graphql';
                                  break;
                                case 'database':
                                  fileType = 'sql';
                                  break;
                                case 'markup':
                                  fileType = cfg.name.endsWith('.xml') ? 'xml' : 'yaml';
                                  break;
                                case 'document':
                                  fileType = cfg.name.endsWith('.md') ? 'markdown' : 'text';
                                  break;
                                default:
                                  fileType = 'text';
                              }
                            } else {
                              // Fallback for other content types - still determine proper file type based on extension
                              contentToLoad = entry.content || entry;
                              
                              // Determine CodeMirror language mode based on file category even for fallback
                              switch (fileCategory) {
                                case 'query':
                                  fileType = 'graphql';
                                  break;
                                case 'database':
                                  fileType = 'sql';
                                  break;
                                case 'markup':
                                  fileType = cfg.name.endsWith('.xml') ? 'xml' : 'yaml';
                                  break;
                                case 'document':
                                  fileType = cfg.name.endsWith('.md') ? 'markdown' : 'text';
                                  break;
                                default:
                                  fileType = fileCategory === 'config' ? 'json' : 'text';
                              }
                            }
                            
                            onSelectConfigFromDb?.({
                              content: contentToLoad,
                              filePath: cfg.name,
                              name: cfg.name,
                              fileType: fileType, // Pass file type for CodeMirror mode
                              category: fileCategory, // Pass category for UI context
                              isTextFile: fileCategory !== 'config', // Flag to indicate text file vs JSON config
                              folderId: folder.id,
                              folderPath: folder.full_path,
                            });
                          } catch (err) {
                            console.error('Error loading folder file:', err);
                            addAlert?.({
                              message: `Failed to load ${cfg.name}`,
                              severity: "error",
                            });
                          }
                        }
                      }}
                      onContextMenu={(e) => {
                        // Find the actual config ID from dbAllConfigs
                        const actualConfig = dbAllConfigs.find(
                          (c) => c.name === cfg.name && c.folder_id === folder.id
                        );
                        
                        handleConfigContextMenu(e, {
                          id: actualConfig ? actualConfig.id : `${folder.id}-${cfg.name}`,
                          name: cfg.name,
                          folder_id: folder.id,
                          isInFolder: true,
                          isSeaweedRef: isSeaweedRef,
                          actualDatabaseId: actualConfig ? actualConfig.id : null,
                        });
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        {isSeaweedRef ? (
                          <StorageIcon fontSize="small" sx={{ color: "#4caf50" }} />
                        ) : (
                          getFileIcon(cfg.name)
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: "medium" }}>
                              {cfg.name}
                              {isOptimisticConfig && !hasFailedConfigOperation && (
                                <Typography component="span" variant="caption" sx={{ ml: 1, color: "#2196f3" }}>
                                  (syncing...)
                                </Typography>
                              )}
                              {hasFailedConfigOperation && (
                                <Typography component="span" variant="caption" sx={{ ml: 1, color: "#f44336" }}>
                                  (failed)
                                </Typography>
                              )}
                            </Typography>
                            {/* Category badge */}
                            <Box
                              sx={{
                                px: 0.5,
                                py: 0.1,
                                bgcolor: isSeaweedRef ? 'rgba(76, 175, 80, 0.1)' : 'rgba(0,0,0,0.05)',
                                borderRadius: 0.5,
                                fontSize: '0.6rem',
                                color: isSeaweedRef ? '#2e7d32' : 'text.secondary',
                                textTransform: 'uppercase',
                                fontWeight: 500
                              }}
                            >
                              {isSeaweedRef ? 'SEAWEED' : cfg.category}
                            </Box>
                          </Box>
                        }
                        secondary={
                          isSeaweedRef 
                            ? entry.content.description || 'SeaweedFS file'
                            : cfg.updated?.slice(0, 19).replace("T", " ") ?? ""
                        }
                        primaryTypographyProps={{ noWrap: true }}
                        secondaryTypographyProps={{ 
                          noWrap: true,
                          sx: { fontSize: '0.75rem' }
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Find the actual config ID from dbAllConfigs
                          const actualConfig = dbAllConfigs.find(
                            (c) => c.name === cfg.name && c.folder_id === folder.id
                          );
                          
                          handleConfigContextMenu(e, {
                            id: actualConfig ? actualConfig.id : `${folder.id}-${cfg.name}`,
                            name: cfg.name,
                            folder_id: folder.id,
                            isInFolder: true,
                            isSeaweedRef: isSeaweedRef,
                            actualDatabaseId: actualConfig ? actualConfig.id : null,
                          });
                        }}
                      >
                        <MoreVertIcon fontSize="small" sx={{ color: "#666" }} />
                      </IconButton>
                    </ListItem>
                  );
                })}

                {/* Upload area that supports both click and drag & drop */}
                <ListItem
                  button
                  data-folder-id={folder.id}
                  sx={{ 
                    pl: (level + 1) * 1.5 + 2.5,
                    py: 0.5,
                    borderTop: "1px dashed #e0e0e0",
                    backgroundColor: dragOverFolder === `folder-${folder.id}` 
                      ? "rgba(76, 175, 80, 0.1)" 
                      : "rgba(0, 0, 0, 0.02)",
                    border: dragOverFolder === `folder-${folder.id}` 
                      ? "2px dashed #4caf50" 
                      : "2px dashed transparent",
                    borderRadius: 1,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      backgroundColor: "rgba(76, 175, 80, 0.05)",
                      borderColor: "#4caf50"
                    }
                  }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = ALLOWED_MIME_TYPES;
                    input.onchange = (e) => {
                      if (e.target.files) {
                        handleFileUpload(e.target.files, folder.id);
                      }
                    };
                    input.click();
                  }}
                  onDragOver={(e) => handleDragOver(e, `folder-${folder.id}`)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, folder.id)}
                >
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <CloudUploadOutlined
                      fontSize="small"
                      sx={{ color: "#4caf50" }}
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Drop files here or click to upload" 
                    primaryTypographyProps={{ 
                      variant: "caption", 
                      sx: { color: "text.secondary", fontStyle: "italic", fontSize: '0.75rem' }
                    }}
                  />
                </ListItem>
              </List>
            </Collapse>
          </React.Fragment>
        );
      };

      return (
        <>
          {/* Render root folders */}
          {rootFolders.map((f) => renderFolder(f, 0))}

          {/* Only render configs that are truly at root level (no folder_id) */}
          {sortedRootConfigs.map((cfg) => {
            // Check if this is a SeaweedFS reference at root level
            const isSeaweedRef = cfg.content?.file_type === 'seaweed_reference';
            const displayName = isSeaweedRef ? cfg.content.original_name : cfg.name;
            
            const isDraggedRootConfig = draggedItem?.type === 'config' && draggedItem.item.id === cfg.id;
            
            // Check if this root config is part of an optimistic operation
            const isOptimisticRootConfig = cfg._isOptimistic;
            const hasFailedRootConfigOperation = isOptimisticRootConfig && Array.from(optimisticOperations.entries()).some(([operationId, operation]) => 
              operation.data.id === cfg.id && failedOperations.has(operationId)
            );
            
            return (
              <ListItem
                key={`rootcfg-${cfg.id}`}
                button
                draggable
                onDragStart={(e) => handleItemDragStart(e, cfg, 'config')}
                onDragEnd={handleItemDragEnd}
                onClick={() => loadDbConfig(cfg)}
                onContextMenu={(e) => handleConfigContextMenu(e, {
                  ...cfg,
                  isSeaweedRef: isSeaweedRef
                })}
                sx={{ 
                  pl: 1, 
                  py: 0.5,
                  bgcolor: hasFailedRootConfigOperation
                    ? 'rgba(244, 67, 54, 0.08)'
                    : isOptimisticRootConfig
                    ? 'rgba(33, 150, 243, 0.08)'
                    : isSeaweedRef 
                    ? 'rgba(76, 175, 80, 0.05)' 
                    : 'transparent',
                  border: hasFailedRootConfigOperation
                    ? '1px solid #f44336'
                    : isOptimisticRootConfig
                    ? '1px dashed #2196f3'
                    : 'none',
                  borderRadius: hasFailedRootConfigOperation || isOptimisticRootConfig ? 1 : 0,
                  opacity: isDraggedRootConfig ? 0.5 : (hasFailedRootConfigOperation ? 0.7 : 1),
                  cursor: isDragging && !isDraggedRootConfig ? 'move' : 'pointer',
                  transition: "all 0.2s ease",
                  "&:hover": {
                    backgroundColor: isSeaweedRef 
                      ? "rgba(76, 175, 80, 0.15)" 
                      : "rgba(0, 0, 0, 0.08)"
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>
                  {isSeaweedRef ? (
                    <StorageIcon fontSize="small" sx={{ color: "#4caf50" }} />
                  ) : (
                    getFileIcon(cfg.name)
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: "medium" }}>
                        {displayName}
                        {isOptimisticRootConfig && !hasFailedRootConfigOperation && (
                          <Typography component="span" variant="caption" sx={{ ml: 1, color: "#2196f3" }}>
                            (syncing...)
                          </Typography>
                        )}
                        {hasFailedRootConfigOperation && (
                          <Typography component="span" variant="caption" sx={{ ml: 1, color: "#f44336" }}>
                            (failed)
                          </Typography>
                        )}
                      </Typography>
                      {/* Category badge */}
                      <Box
                        sx={{
                          px: 0.5,
                          py: 0.1,
                          bgcolor: isSeaweedRef ? 'rgba(76, 175, 80, 0.1)' : 'rgba(0,0,0,0.05)',
                          borderRadius: 0.5,
                          fontSize: '0.6rem',
                          color: isSeaweedRef ? '#2e7d32' : 'text.secondary',
                          textTransform: 'uppercase',
                          fontWeight: 500
                        }}
                      >
                        {isSeaweedRef ? 'SEAWEED' : getFileCategory(cfg.name)}
                      </Box>
                    </Box>
                  }
                  secondary={
                    isSeaweedRef 
                      ? cfg.content.description || 'SeaweedFS file (root level)'
                      : cfg.updated?.slice(0, 19).replace("T", " ")
                  }
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ 
                    noWrap: true,
                    sx: { fontSize: '0.75rem' }
                  }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfigContextMenu(e, {
                      ...cfg,
                      isSeaweedRef: isSeaweedRef
                    });
                  }}
                >
                  <MoreVertIcon fontSize="small" sx={{ color: "#666" }} />
                </IconButton>
              </ListItem>
            );
          })}
        </>
      );
    };
    /* ---------------------------------------------------------------------- */
    /* JSX layout                                                             */
    /* ---------------------------------------------------------------------- */
    return (
      <>
        <Box
          ref={sidebarRef}
          sx={{
            flexShrink: 0,
            width,
            minWidth,
            maxWidth,
            height: "100%",
            borderRight: "1px solid #e0e0e0",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            userSelect: isResizing ? "none" : "auto",
            transition: isResizing ? "none" : "width 0.15s ease-out",
          }}
        >
          {/* header */}
          <Toolbar />
          <Box
            sx={{
              p: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: optimisticOperations.size > 0 ? "2px solid #1976d2" : "none",
              transition: "border-bottom 0.2s ease-in-out",
            }}
          >
            <Typography variant="h6">
              Configurations
              {optimisticOperations.size > 0 && (
                <Typography component="span" variant="caption" sx={{ ml: 1, color: "#1976d2" }}>
                  ({optimisticOperations.size} syncing...)
                </Typography>
              )}
            </Typography>
          </Box>

          {/* Upload progress indicator */}
          {Object.keys(uploadProgress).length > 0 && (
            <Box sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                Uploading files...
              </Typography>
              {Object.entries(uploadProgress).map(([fileId, { name, progress }]) => (
                <Box key={fileId} sx={{ mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" noWrap sx={{ flex: 1, fontSize: '0.7rem' }}>
                      {name}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {Math.round(progress)}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={progress} 
                    size="small"
                    sx={{ 
                      height: 3,
                      borderRadius: 1,
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 1
                      }
                    }} 
                  />
                </Box>
              ))}
            </Box>
          )}

          {/* body */}
          <Box sx={{ height: "88%", flexGrow: 1, overflow: "auto", px: 1 }}>
            {loading && !dbFolders.length && !dbRootConfigs.length ? (
              <Box sx={{ textAlign: "center", mt: 4 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
                  Loading workspace files...
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                  <Button
                    fullWidth
                    startIcon={<CreateNewFolderOutlinedIcon />}
                    onClick={() => {
                      setNewFolderParentId(null);
                      setNewFolderName("");
                      setNewFolderOpen(true);
                    }}
                    sx={btnSx}
                  >
                    New Folder
                  </Button>
                  <Button
                    fullWidth
                    startIcon={<AddIcon />}
                    onClick={() => askNewFile(null, "config")}
                    sx={btnSx}
                  >
                    Create File
                  </Button>
                </Box>

                {/* Main Drop Zone for Folders and Moving Items to Root */}
                <Box
                  sx={{
                    border: "2px dashed #e0e0e0",
                    borderRadius: 2,
                    p: 2,
                    mb: 2,
                    textAlign: "center",
                    backgroundColor: dragOverFolder === 'root' 
                      ? "rgba(76, 175, 80, 0.1)" 
                      : dragOverTarget?.type === 'root'
                      ? "rgba(255, 193, 7, 0.1)"
                      : "rgba(0,0,0,0.02)",
                    borderColor: dragOverFolder === 'root' 
                      ? "#4caf50" 
                      : dragOverTarget?.type === 'root'
                      ? "#ff9800"
                      : "#e0e0e0",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor: "#4caf50",
                      backgroundColor: "rgba(76, 175, 80, 0.05)"
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedItem) {
                      // Moving items to root
                      handleItemDragOver(e, 'root', null);
                    } else {
                      // File uploads
                      handleDragOver(e, 'root');
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (draggedItem) {
                      handleItemDragLeave(e);
                    } else {
                      handleDragLeave(e);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedItem) {
                      // Moving items to root (folder_id = null)
                      handleItemDrop(e, 'root', null);
                    } else {
                      // File uploads to root level
                      handleDrop(e, null);
                    }
                  }}
                >
                  <CloudUploadOutlined sx={{ fontSize: 48, color: "#666", mb: 1 }} />
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                    {draggedItem ? `Drop to move ${draggedItem.item.name} to root level` : 'Drag and drop folders or files here'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {draggedItem ? 'Move files and folders by dragging them' : 'Config files → Database, data files → Data Storage.'}
                  </Typography>
                </Box>

                <List 
                  disablePadding
                  sx={{
                    position: 'relative',
                    minHeight: 200,
                    // Make the entire list area a drop target for root level
                    '&::after': dragOverTarget?.type === 'root' ? {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: '2px dashed #ff9800',
                      borderRadius: 1,
                      backgroundColor: 'rgba(255, 193, 7, 0.05)',
                      pointerEvents: 'none',
                      zIndex: 1,
                    } : {}
                  }}
                  onDragOver={(e) => {
                    if (draggedItem) {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Find the closest folder element (including collapse content)
                      const folderElement = e.target.closest('[data-folder-id]');
                      
                      if (folderElement) {
                        // We're over a folder or its content
                        const folderId = parseInt(folderElement.getAttribute('data-folder-id'));
                        console.log('List drag over folder:', folderId, 'target:', e.target);
                        // Don't override folder-specific drag over handling
                        return;
                      } else {
                        // We're in empty space - root level
                        console.log('List drag over root level', 'target:', e.target);
                        setDragOverTarget({ type: 'root', id: null });
                      }
                    }
                  }}
                  onDragLeave={(e) => {
                    if (draggedItem) {
                      e.preventDefault();
                      e.stopPropagation();
                      // Only clear if we're actually leaving the list area
                      const rect = e.currentTarget.getBoundingClientRect();
                      const isOutside = (
                        e.clientX < rect.left || 
                        e.clientX > rect.right || 
                        e.clientY < rect.top || 
                        e.clientY > rect.bottom
                      );
                      if (isOutside) {
                        setDragOverTarget(null);
                      }
                    }
                  }}
                  onDrop={(e) => {
                    if (draggedItem) {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Find the closest folder element
                      const folderElement = e.target.closest('[data-folder-id]');
                      
                      if (folderElement) {
                        // Dropping into a folder
                        const folderId = parseInt(folderElement.getAttribute('data-folder-id'));
                        console.log('Dropping into folder:', folderId);
                        handleItemDrop(e, 'folder', folderId);
                      } else {
                        // Dropping to root level
                        console.log('Dropping to root level');
                        handleItemDrop(e, 'root', null);
                      }
                    }
                  }}
                >
                  {renderDbTree()}
                </List>
              </>
            )}
          </Box>

          {/* resize handle */}
          <Box
            onMouseDown={handleResizeStart}
            sx={{
              position: "absolute",
              right: -4,
              top: 0,
              bottom: 0,
              width: 8,
              cursor: "ew-resize",
              "&:hover": { backgroundColor: "rgba(0,0,0,0.1)" },
              "&:active": { backgroundColor: "rgba(0,0,0,0.2)" },
            }}
          />

          {/* ────────── MENUS ────────── */}
          {/* FOLDER context menu */}
          <Menu
            open={contextMenu !== null}
            onClose={handleCloseAllContextMenus}
            anchorReference="anchorPosition"
            anchorPosition={
              contextMenu !== null
                ? { top: contextMenu.y, left: contextMenu.x }
                : undefined
            }
          >
            <MenuItem
              onClick={() => {
                const f = contextFolder; // keep reference
                handleCloseAllContextMenus(); // may clear contextFolder
                setRenameFolderTarget(f); // remember the folder we rename
                setRenameFolderName(f?.name || "");
                setRenameFolderOpen(true);
              }}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" sx={{ color: "#666" }} />
              </ListItemIcon>
              <ListItemText>Rename Folder</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                setNewFolderParentId(contextFolder?.id);
                setNewFolderName("");
                setNewFolderOpen(true);
              }}
            >
              <ListItemIcon>
                <CreateNewFolderOutlinedIcon
                  fontSize="small"
                  sx={{ color: "#666" }}
                />
              </ListItemIcon>
              <ListItemText>New Folder</ListItemText>
            </MenuItem>
            
            {/* File Creation Options */}
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                askNewFile(contextFolder?.id, "config");
              }}
            >
              <ListItemIcon>
                <DataObjectIcon fontSize="small" sx={{ color: "#F7931E" }} />
              </ListItemIcon>
              <ListItemText>New Config File</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                askNewFile(contextFolder?.id, "query");
              }}
            >
              <ListItemIcon>
                <GraphqlIcon fontSize="small" sx={{ color: "#E535AB" }} />
              </ListItemIcon>
              <ListItemText>New GraphQL Query</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                askNewFile(contextFolder?.id, "database");
              }}
            >
              <ListItemIcon>
                <DatabaseIcon fontSize="small" sx={{ color: "#336791" }} />
              </ListItemIcon>
              <ListItemText>New SQL Script</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                askNewFile(contextFolder?.id, "document");
              }}
            >
              <ListItemIcon>
                <ArticleIcon fontSize="small" sx={{ color: "#666" }} />
              </ListItemIcon>
              <ListItemText>New Text Document</ListItemText>
            </MenuItem>
            
            {/* Upload from disk */}
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                askUpload(contextFolder?.id);
              }}
            >
              <ListItemIcon>
                <CloudUploadOutlined fontSize="small" sx={{ color: "#666" }} />
              </ListItemIcon>
              <ListItemText>Upload from Disk</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                if (contextFolder) {
                  showScopeConfirmation('folder', contextFolder, () => {
                    toggleFolderScope(contextFolder.id)
                      .then((response) => {
                        // Use the returned sharing_scope from the API response
                        const newScope = response.sharing_scope;
                        addAlert?.({
                          message: `Changed ${contextFolder.name} to ${newScope} scope`,
                          severity: "success",
                        });
                        refreshAllDb();
                      })
                      .catch((err) => {
                        console.error(err);
                        addAlert?.({
                          message:
                            "Failed to change scope: " +
                            (err.message || "Unknown error"),
                          severity: "error",
                        });
                      });
                  });
                }
              }}
            >
              <ListItemIcon>
                {contextFolder?.sharing_scope === "organization" ? (
                  <PersonOutlinedIcon
                    fontSize="small"
                    sx={{ color: "#666" }}
                  />
                ) : (
                  <BusinessOutlinedIcon
                    fontSize="small"
                    sx={{ color: "#666" }}
                  />
                )}
              </ListItemIcon>
              <ListItemText>
                {contextFolder?.sharing_scope === "organization"
                  ? "Change to User Scope"
                  : "Change to Organization Scope"}
              </ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                if (contextFolder) {
                  showDeleteConfirmation('folder', contextFolder, () => {
                    handleDeleteFolder(contextFolder.id);
                  });
                }
              }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" sx={{ color: "#d32f2f" }} />
              </ListItemIcon>
              <ListItemText>Delete Folder</ListItemText>
            </MenuItem>
          </Menu>

          {/* CONFIG context menu */}
          <Menu
            open={configContextMenu !== null}
            onClose={handleCloseAllContextMenus}
            anchorReference="anchorPosition"
            anchorPosition={
              configContextMenu !== null
                ? { top: configContextMenu.y, left: configContextMenu.x }
                : undefined
            }
          >
            {/* Check if this is a SeaweedFS reference */}
            {contextConfig?.isSeaweedRef ? (
              <>
                <MenuItem
                  onClick={() => {
                    handleCloseAllContextMenus();
                    // Download SeaweedFS file
                    const entry = folderContents[contextConfig.folder_id]?.[contextConfig.name];
                    if (entry?.content?.seaweed_file_id) {
                      window.open(`/user/files/${entry.content.seaweed_file_id}`, '_blank');
                    }
                  }}
                >
                  <ListItemIcon>
                    <CloudDownloadOutlined fontSize="small" sx={{ color: "#666" }} />
                  </ListItemIcon>
                  <ListItemText>Download File</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleCloseAllContextMenus();
                    setDeleteDialogueOpen(true);
                    setToDelete(contextConfig);
                  }}
                >
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" sx={{ color: "#f44336" }} />
                  </ListItemIcon>
                  <ListItemText>Delete File</ListItemText>
                </MenuItem>
              </>
            ) : (
              <>
                {/* Check if this is a text file that can be edited */}
                {(contextConfig?.isInFolder && contextConfig?.folder_id && 
                  ['query', 'database'].includes(folderContents[contextConfig.folder_id]?.[contextConfig.name]?.content?.category)) && (
                  <MenuItem
                    onClick={() => {
                      handleCloseAllContextMenus();
                      // Open text file for editing
                      const entry = folderContents[contextConfig.folder_id]?.[contextConfig.name];
                      const textContent = entry?.content?.raw_content || '';
                      const fileType = entry?.content?.category || 'text';
                      
                      onSelectConfigFromDb?.({
                        content: textContent,
                        filePath: contextConfig.name,
                        name: contextConfig.name,
                        folderId: contextConfig.folder_id,
                        folderPath: contextConfig.folder_id ? dbFolders.find(f => f.id === contextConfig.folder_id)?.full_path : null,
                        fileType: fileType,
                        isTextFile: true,
                      });
                    }}
                  >
                    <ListItemIcon>
                      <EditIcon fontSize="small" sx={{ color: "#4caf50" }} />
                    </ListItemIcon>
                    <ListItemText>Edit File Content</ListItemText>
                  </MenuItem>
                )}
                
                {/* Download option for all file types */}
                <MenuItem
                  onClick={() => {
                    handleCloseAllContextMenus();
                    // Download config file as JSON
                    const entry = contextConfig?.isInFolder && contextConfig?.folder_id 
                      ? folderContents[contextConfig.folder_id]?.[contextConfig.name]
                      : contextConfig;
                    
                    if (entry) {
                      const content = entry.content || entry;
                      let downloadContent, fileName, mimeType;
                      
                      if (content.raw_content) {
                        // Text file download
                        downloadContent = content.raw_content;
                        fileName = contextConfig.name;
                        mimeType = "text/plain";
                      } else {
                        // JSON config download
                        downloadContent = JSON.stringify(content, null, 2);
                        fileName = contextConfig.name.endsWith('.json') ? contextConfig.name : `${contextConfig.name}.json`;
                        mimeType = "application/json";
                      }
                      
                      const blob = new Blob([downloadContent], { type: mimeType });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = fileName;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                      
                      addAlert?.({
                        message: `Downloaded "${fileName}"`,
                        severity: "success",
                      });
                    }
                  }}
                >
                  <ListItemIcon>
                    <CloudDownloadOutlined fontSize="small" sx={{ color: "#666" }} />
                  </ListItemIcon>
                  <ListItemText>Download File</ListItemText>
                </MenuItem>
                
                <MenuItem
                  onClick={() => {
                    handleCloseAllContextMenus();
                    if (contextConfig && !contextConfig.isInFolder) {
                      openRename(contextConfig);
                    } else if (contextConfig && contextConfig.isInFolder) {
                      setRenameName(contextConfig.name);
                      setRenameCfg(contextConfig);
                      setRenameOpen(true);
                    }
                  }}
                >
                  <ListItemIcon>
                    <EditIcon fontSize="small" sx={{ color: "#666" }} />
                  </ListItemIcon>
                  <ListItemText>Rename</ListItemText>
                </MenuItem>
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                if (contextConfig) {
                  // Determine current scope for display
                  let currentScope = "user";
                  if (!contextConfig.isInFolder) {
                    const config = dbAllConfigs.find((c) => c.id === contextConfig.id);
                    currentScope = config?.sharing_scope || "user";
                  } else {
                    const config = dbAllConfigs.find(
                      (c) =>
                        c.name === contextConfig.name &&
                        c.folder_id === contextConfig.folder_id,
                    );
                    currentScope = config?.sharing_scope || "user";
                  }
                  
                  const findAndToggleConfig = async () => {
                    try {
                      let configId;

                      if (!contextConfig.isInFolder) {
                        // Direct config reference, use its ID
                        configId = contextConfig.id;
                        console.log("Using direct config ID:", configId);
                      } else if (contextConfig.actualDatabaseId) {
                        // Use the actual database ID we resolved when setting the context
                        configId = contextConfig.actualDatabaseId;
                        console.log("Using actual database ID:", configId);
                      } else if (
                        contextConfig.id &&
                        !isNaN(parseInt(contextConfig.id))
                      ) {
                        // If contextConfig has a numeric ID, use it directly
                        configId = parseInt(contextConfig.id);
                        console.log(
                          "Using numeric ID from contextConfig:",
                          configId,
                        );
                      } else {
                        // Fallback: For configs in folders, we need to find the actual config ID
                        console.log(
                          "Looking up config ID for folder config:",
                          contextConfig.name,
                          "folder_id:",
                          contextConfig.folder_id,
                        );

                        try {
                          const allConfigs = await listConfigs();
                          console.log("Found configs:", allConfigs.length);

                          // First try: Look for exact match by name and folder_id
                          let config = allConfigs.find(
                            (c) =>
                              c.name === contextConfig.name &&
                              c.folder_id === contextConfig.folder_id,
                          );

                          // Second try: If not found, try to match just by name
                          if (!config) {
                            console.log(
                              "Exact match not found, trying to match by name only",
                            );
                            config = allConfigs.find(
                              (c) => c.name === contextConfig.name,
                            );
                          }

                          // Third try: If name has extension .config.json, try without it
                          if (
                            !config &&
                            contextConfig.name.endsWith(".config.json")
                          ) {
                            const simpleName = contextConfig.name.replace(
                              ".config.json",
                              "",
                            );
                            console.log("Trying simplified name:", simpleName);
                            config = allConfigs.find(
                              (c) =>
                                c.name === simpleName ||
                                c.name === simpleName + ".config.json",
                            );
                          }

                          if (!config) {
                            console.error(
                              "Config not found in any folder. Available configs:",
                              allConfigs.map(
                                (c) =>
                                  `${c.name} (ID: ${c.id}, folder: ${c.folder_id})`,
                              ),
                            );

                            throw new Error(
                              `Config "${contextConfig.name}" not found in any folder`,
                            );
                          } else {
                            configId = config.id;
                            console.log("Resolved config ID:", configId);
                          }
                        } catch (error) {
                          console.error("Error fetching configs:", error);
                          throw error;
                        }
                      }

                      console.log("Toggling scope for config ID:", configId);
                      // Now toggle the scope
                      const response = await toggleConfigScope(configId);
                      // Use the returned sharing_scope from the API response
                      const newScope = response.sharing_scope;
                      
                      // Create message with folder info if available
                      let message = `Changed ${contextConfig.name} to ${newScope} scope`;
                      if (response.folder_info) {
                        message += response.folder_info;
                      }
                      
                      // Check if the config moved to a different scope than what we're currently viewing
                      const currentViewingScope = currentScope; // 'user' or 'organization'
                      if (newScope !== currentViewingScope) {
                        message += ` Note: The file is now in ${newScope} scope. Switch scopes to see it again.`;
                      }
                      
                      addAlert?.({
                        message: message,
                        severity: "success",
                      });
                      refreshAllDb();
                    } catch (err) {
                      console.error("Failed to toggle config scope:", err);

                      // Extract the most informative error message
                      let errorMessage = "Unknown error";
                      if (err.response?.data?.detail) {
                        errorMessage = err.response.data.detail;
                      } else if (err.message) {
                        errorMessage = err.message;
                      } else if (typeof err === "string") {
                        errorMessage = err;
                      }

                      addAlert?.({
                        message: `Failed to change scope: ${errorMessage}`,
                        severity: "error",
                      });
                    }
                  };

                  showScopeConfirmation('config', contextConfig, findAndToggleConfig);
                }
              }}
            >
              <ListItemIcon>
                {(() => {
                  // Determine current scope
                  let isOrgScope = false;
                  if (!contextConfig?.isInFolder) {
                    isOrgScope =
                      dbAllConfigs.find((c) => c.id === contextConfig?.id)
                        ?.sharing_scope === "organization";
                  } else {
                    const config = dbAllConfigs.find(
                      (c) =>
                        c.name === contextConfig?.name &&
                        c.folder_id === contextConfig?.folder_id,
                    );
                    isOrgScope = config?.sharing_scope === "organization";
                  }

                  return isOrgScope ? (
                    <PersonOutlinedIcon
                      fontSize="small"
                      sx={{ color: "#666" }}
                    />
                  ) : (
                    <BusinessOutlinedIcon
                      fontSize="small"
                      sx={{ color: "#666" }}
                    />
                  );
                })()}
              </ListItemIcon>
              <ListItemText>
                {(() => {
                  // Determine current scope text
                  let isOrgScope = false;
                  if (!contextConfig?.isInFolder) {
                    isOrgScope =
                      dbAllConfigs.find((c) => c.id === contextConfig?.id)
                        ?.sharing_scope === "organization";
                  } else {
                    const config = dbAllConfigs.find(
                      (c) =>
                        c.name === contextConfig?.name &&
                        c.folder_id === contextConfig?.folder_id,
                    );
                    isOrgScope = config?.sharing_scope === "organization";
                  }

                  return isOrgScope
                    ? "Change to User Scope"
                    : "Change to Organization Scope";
                })()}
              </ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleCloseAllContextMenus();
                if (contextConfig && !contextConfig.isInFolder) {
                  showDeleteConfirmation('config', contextConfig, () => {
                    handleDelete(contextConfig.id);
                  });
                } else if (contextConfig && contextConfig.isInFolder) {
                  const deleteAction = () => {
                    // Handle deletion of configs within folders
                    if (contextConfig.actualDatabaseId) {
                      // Use the actual database ID we resolved when setting the context
                      handleDelete(contextConfig.actualDatabaseId);
                    } else {
                      // Fallback: Find the config by name and folder_id
                      const folderId = contextConfig.folder_id;
                      const configName = contextConfig.name;

                      // Try to find from dbAllConfigs first (already loaded)
                      const configToDelete = dbAllConfigs.find(
                        (c) => c.name === configName && c.folder_id === folderId,
                      );

                      if (configToDelete) {
                        handleDelete(configToDelete.id);
                      } else {
                        // Final fallback: Call listConfigs()
                        listConfigs()
                          .then((allConfigs) => {
                            const configToDelete = allConfigs.find(
                              (c) =>
                                c.name === configName && c.folder_id === folderId,
                            );

                            if (configToDelete) {
                              handleDelete(configToDelete.id);
                            } else {
                              addAlert?.({
                                message: "Config not found for deletion",
                                severity: "error",
                              });
                            }
                          })
                          .catch((err) => {
                            console.error(err);
                            addAlert?.({
                              message: "Failed to delete config",
                              severity: "error",
                            });
                          });
                      }
                    }
                  };
                  
                  showDeleteConfirmation('config', contextConfig, deleteAction);
                }
              }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" sx={{ color: "#d32f2f" }} />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
            </>
            )}
          </Menu>

          {/* ────────── DIALOGS ────────── */}
          {/* upload */}
          <Dialog
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>
              {uploadFolder
                ? "Save configuration to folder"
                : "Save configuration to database"}
            </DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Config name"
                fullWidth
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={confirmUpload}>
                Save
              </Button>
            </DialogActions>
          </Dialog>

          {/* rename config */}
          <Dialog
            open={renameOpen}
            onClose={() => setRenameOpen(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Rename configuration</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="New name"
                fullWidth
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={confirmRename}>
                Save
              </Button>
            </DialogActions>
          </Dialog>

          {/* new folder */}
          <Dialog
            open={newFolderOpen}
            onClose={() => setNewFolderOpen(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Create new folder</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Folder name"
                fullWidth
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                helperText="Enter a name for the new folder"
              />
            </DialogContent>
            <DialogActions>
              <Button sx={btnSx} onClick={() => setNewFolderOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={confirmNewFolder}
                disabled={!newFolderName.trim()}
              >
                Create
              </Button>
            </DialogActions>
          </Dialog>

          {/* rename folder */}
          <Dialog
            open={renameFolderOpen}
            onClose={() => {
              setRenameFolderOpen(false);
              setRenameFolderTarget(null);
            }}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Rename folder</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="New folder name"
                fullWidth
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRenameFolderOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={confirmRenameFolder}>
                Save
              </Button>
            </DialogActions>
          </Dialog>

          {/* new file dialog */}
          <Dialog
            open={newFileOpen}
            onClose={() => setNewFileOpen(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Create New File</DialogTitle>
            <DialogContent>
              <FormControl fullWidth margin="dense">
                <InputLabel>File Type</InputLabel>
                <Select
                  value={newFileType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setNewFileType(newType);
                    setNewFileName(generateFileName(newType, ""));
                  }}
                  label="File Type"
                >
                  {fileTypeOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <MenuItem key={option.value} value={option.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconComponent 
                            fontSize="small" 
                            sx={{ 
                              color: option.value === "config" ? "#F7931E" :
                                     option.value === "query" ? "#E535AB" :
                                     option.value === "database" ? "#336791" : "#666"
                            }} 
                          />
                          {option.label}
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              <TextField
                margin="dense"
                label="File name"
                fullWidth
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                helperText={`Creates a ${getFileTypeConfig(newFileType).label.toLowerCase()}`}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setNewFileOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={confirmNewFile}
                disabled={!newFileName.trim()}
              >
                Create
              </Button>
            </DialogActions>
          </Dialog>

          {/* delete confirmation dialog */}
          <Dialog
            open={deleteDialogueOpen}
            onClose={() => {
              setDeleteDialogueOpen(false);
              setToDelete(null);
            }}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Delete File and Reference</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete "{toDelete?.name}"? 
                This will permanently delete both the file from Data storage and 
                remove its reference from the database.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setDeleteDialogueOpen(false);
                setToDelete(null);
              }}>
                Cancel
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={confirmDeleteReference}
              >
                Delete File and Reference
              </Button>
            </DialogActions>
          </Dialog>

          {/* Scope transfer confirmation dialog */}
          <Dialog
            open={scopeConfirmOpen}
            onClose={() => {
              setScopeConfirmOpen(false);
              setScopeConfirmData(null);
            }}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Confirm Scope Change</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to change the scope of{" "}
                <strong>{scopeConfirmData?.type === 'folder' ? 'folder' : 'file'} "{scopeConfirmData?.item?.name}"</strong>?
              </Typography>
              <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                {scopeConfirmData?.type === 'folder' 
                  ? `This will change the scope of the folder and all files within it to ${
                      scopeConfirmData?.item?.sharing_scope === "organization" ? "user" : "organization"
                    } scope.`
                  : `This will change the scope of this file to ${
                      (() => {
                        // Determine current scope and what it will change to
                        let currentScope = "user";
                        if (scopeConfirmData?.item && !scopeConfirmData.item.isInFolder) {
                          const config = dbAllConfigs.find((c) => c.id === scopeConfirmData.item.id);
                          currentScope = config?.sharing_scope || "user";
                        } else if (scopeConfirmData?.item) {
                          const config = dbAllConfigs.find(
                            (c) =>
                              c.name === scopeConfirmData.item.name &&
                              c.folder_id === scopeConfirmData.item.folder_id,
                          );
                          currentScope = config?.sharing_scope || "user";
                        }
                        return currentScope === "organization" ? "user" : "organization";
                      })()
                    } scope.`
                }
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setScopeConfirmOpen(false);
                setScopeConfirmData(null);
              }}>
                Cancel
              </Button>
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleScopeConfirm}
              >
                Change Scope
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete confirmation dialog */}
          <Dialog
            open={deleteConfirmOpen}
            onClose={() => {
              setDeleteConfirmOpen(false);
              setDeleteConfirmData(null);
            }}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete{" "}
                <strong>{deleteConfirmData?.type === 'folder' ? 'folder' : 'file'} "{deleteConfirmData?.item?.name}"</strong>?
              </Typography>
              <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                {deleteConfirmData?.type === 'folder' 
                  ? "This will permanently delete the folder and all files within it. This action cannot be undone."
                  : "This will permanently delete the file from both the database and storage. This action cannot be undone."
                }
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteConfirmData(null);
              }}>
                Cancel
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={handleDeleteConfirm}
              >
                Delete {deleteConfirmData?.type === 'folder' ? 'Folder' : 'File'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </>
    );
  },
);

export default ConfigDrawer;
