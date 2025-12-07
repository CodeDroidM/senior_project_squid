/* ------------------------------------------------------------------
   src/ConfigEditor/TextFileTabEditor.jsx
   CodeMirror-based text editor for different file types (GraphQL, SQL, YAML, etc.)
-------------------------------------------------------------------*/
import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
  Typography,
  Chip,
} from "@mui/material";
import {
  Code as CodeIcon,
  QueryStats as GraphqlIcon,
  Storage as SqlIcon,
  DataObject as YamlIcon,
  Article as MarkdownIcon,
  Description as TextIcon,
} from "@mui/icons-material";

import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { xml } from "@codemirror/lang-xml";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";

// GraphQL will use basic highlighting for now since @codemirror/lang-graphql doesn't exist

const TextFileTabEditor = ({ 
  content = '', 
  onChange, 
  onSave,
  fileType = 'text', 
  category = 'document',
  fileName = 'untitled',
  readOnly = false,
  isDirty = false,
  onDirtyChange
}) => {
  // Extract raw content from object structure if needed
  const normalizedContent = (() => {
    if (typeof content === 'string') {
      return content;
    } else if (typeof content === 'object' && content !== null) {
      // If it's an object with raw_content (from database), extract it
      if (content.raw_content !== undefined) {
        return typeof content.raw_content === 'string' ? content.raw_content : String(content.raw_content || '');
      }
      // Otherwise stringify the whole object
      return JSON.stringify(content, null, 2);
    }
    return String(content || '');
  })();
  
  const [localContent, setLocalContent] = useState(normalizedContent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update local content when prop changes
  useEffect(() => {
    const newContent = (() => {
      if (typeof content === 'string') {
        return content;
      } else if (typeof content === 'object' && content !== null) {
        // If it's an object with raw_content (from database), extract it
        if (content.raw_content !== undefined) {
          return typeof content.raw_content === 'string' ? content.raw_content : String(content.raw_content || '');
        }
        // Otherwise stringify the whole object
        return JSON.stringify(content, null, 2);
      }
      return String(content || '');
    })();
    setLocalContent(newContent);
    setHasUnsavedChanges(false);
  }, [content]);

  // Handle content changes
  const handleChange = useCallback((value) => {
    setLocalContent(value);
    // Compare with normalized original content
    const originalNormalized = (() => {
      if (typeof content === 'string') {
        return content;
      } else if (typeof content === 'object' && content !== null) {
        // If it's an object with raw_content (from database), extract it
        if (content.raw_content !== undefined) {
          return typeof content.raw_content === 'string' ? content.raw_content : String(content.raw_content || '');
        }
        // Otherwise stringify the whole object
        return JSON.stringify(content, null, 2);
      }
      return String(content || '');
    })();
    const isChanged = value !== originalNormalized;
    setHasUnsavedChanges(isChanged);
    
    if (onChange) {
      onChange(value);
    }
    
    // Notify parent about dirty state
    if (onDirtyChange) {
      onDirtyChange(isChanged);
    }
  }, [content, onChange, onDirtyChange]);

  // Get file type configuration
  const getFileTypeConfig = useCallback(() => {
    switch (fileType) {
      case 'graphql':
        return {
          label: 'GraphQL',
          icon: GraphqlIcon,
          color: "#E535AB",
          language: null, // Use basic text highlighting for GraphQL
          placeholder: 'Enter your GraphQL query here...\n\nExample:\nquery {\n  user(id: "123") {\n    name\n    email\n  }\n}'
        };
      case 'sql':
        return {
          label: 'SQL',
          icon: SqlIcon,
          color: "#336791",
          language: sql,
          placeholder: 'Enter your SQL query here...\n\nExample:\nSELECT id, name, email\nFROM users\nWHERE active = 1\nORDER BY name;'
        };
      case 'yaml':
        return {
          label: 'YAML',
          icon: YamlIcon,
          color: "#FF6600",
          language: yaml,
          placeholder: 'Enter your YAML content here...\n\nExample:\nname: My Configuration\nversion: 1.0\nsettings:\n  debug: true\n  timeout: 30'
        };
      case 'xml':
        return {
          label: 'XML',
          icon: YamlIcon,
          color: "#FF6600",
          language: xml,
          placeholder: 'Enter your XML content here...\n\nExample:\n<?xml version="1.0" encoding="UTF-8"?>\n<configuration>\n  <setting name="debug">true</setting>\n</configuration>'
        };
      case 'markdown':
        return {
          label: 'Markdown',
          icon: MarkdownIcon,
          color: "#000000",
          language: markdown,
          placeholder: 'Enter your Markdown content here...\n\n# Example Heading\n\nThis is **bold** text and *italic* text.\n\n- List item 1\n- List item 2'
        };
      case 'json':
        return {
          label: 'JSON',
          icon: CodeIcon,
          color: "#F7931E",
          language: json,
          placeholder: 'Enter your JSON content here...\n\nExample:\n{\n  "name": "Example",\n  "version": "1.0",\n  "config": {\n    "enabled": true\n  }\n}'
        };
      case 'text':
      default:
        return {
          label: 'Text',
          icon: TextIcon,
          color: "#666666",
          language: null,
          placeholder: 'Enter your text content here...'
        };
    }
  }, [fileType]);

  const config = getFileTypeConfig();

  // CodeMirror extensions
  const extensions = [
    EditorView.theme({
      '&': {
        fontSize: '14px',
        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
        height: '100%',
      },
      '.cm-content': {
        padding: '16px',
        minHeight: '400px',
      },
      '.cm-scroller': {
        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
        fontSize: '14px',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-editor': {
        height: '100%',
      },
    }),
    EditorView.lineWrapping,
  ];

  // Add language support if available
  if (config.language) {
    extensions.push(config.language());
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      backgroundColor: '#fafafa',
      border: '1px solid #e0e0e0',
      borderRadius: 1,
    }}>
      {/* CodeMirror Editor - Full Size */}
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <CodeMirror
          value={localContent}
          onChange={handleChange}
          extensions={extensions}
          theme={undefined} // Use default light theme
          readOnly={readOnly}
          placeholder={config.placeholder}
          height="100%"
          style={{
            height: '100%',
            fontSize: '14px',
            flex: 1,
          }}
        />
      </Box>

      {/* Footer with file info */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        px: 2, 
        py: 1,
        backgroundColor: '#f5f5f5',
        borderTop: '1px solid #e0e0e0',
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
      }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {fileType.toUpperCase()} • {localContent.length} characters
          {hasUnsavedChanges ? ' • Modified' : ''}
        </Typography>
        
        {category && (
          <Chip 
            label={category.charAt(0).toUpperCase() + category.slice(1)} 
            size="small" 
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        )}
      </Box>
    </Box>
  );
};

export default TextFileTabEditor;
