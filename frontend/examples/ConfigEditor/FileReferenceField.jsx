import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
 
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Box,
  Typography,
  IconButton,
  Chip
} from '@mui/material';
import {
  FolderOpen,
  InsertDriveFile,
  QueryStats as GraphQLIcon,
  Storage as DatabaseIcon,
  Clear as ClearIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { listConfigs } from '../api/configs';

const getFileIcon = (category) => {
  switch (category) {
    case 'query':
      return <GraphQLIcon sx={{ color: "#E535AB" }} />;
    case 'database':
      return <DatabaseIcon sx={{ color: "#336791" }} />;
    default:
      return <InsertDriveFile sx={{ color: "#666" }} />;
  }
};

const FileReferenceField = ({ value, onChange, schema }) => {
  const [open, setOpen] = useState(false);
  //eslint-disable-next-line
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadFiles();
    }
  }, [open]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const configs = await listConfigs();
      
      // Filter for text files (GraphQL, SQL, etc.)
      const textFiles = configs.filter(config => {
        if (typeof config.content === 'object' && config.content.category) {
          return ['query', 'database', 'markup', 'document'].includes(config.content.category);
        }
        return false;
      });

      // Group by folder
      const folderMap = {};
      const fileMap = {};
      
      textFiles.forEach(file => {
        const fileName = file.name;
        const category = file.content.category || 'other';
        const fileType = file.content.file_type || '';
        
        if (file.folder_id) {
          if (!folderMap[file.folder_id]) {
            folderMap[file.folder_id] = [];
          }
          folderMap[file.folder_id].push({
            id: file.id,
            name: fileName,
            category,
            fileType,
            folderId: file.folder_id
          });
        } else {
          // Root level files
          if (!fileMap.root) {
            fileMap.root = [];
          }
          fileMap.root.push({
            id: file.id,
            name: fileName,
            category,
            fileType,
            folderId: null
          });
        }
      });

      setFolders({ ...folderMap, root: fileMap.root || [] });
      setFiles(textFiles);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (fileName) => {
    onChange(fileName);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const renderFolderContents = (folderId, folderName = null, level = 0) => {
    const folderFiles = folders[folderId] || [];
    const isExpanded = expandedFolders[folderId];

    if (folderFiles.length === 0) return null;

    return (
      <Box key={folderId}>
        {folderName && (
          <ListItemButton 
            onClick={() => toggleFolder(folderId)}
            sx={{ pl: level * 2 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <FolderOpen sx={{ color: isExpanded ? "#1976d2" : "#666" }} />
            </ListItemIcon>
            <ListItemText 
              primary={folderName}
              secondary={`${folderFiles.length} files`}
            />
          </ListItemButton>
        )}
        
        {(isExpanded || !folderName) && folderFiles.map(file => (
          <ListItemButton
            key={file.id}
            onClick={() => handleFileSelect(file.name)}
            sx={{ pl: (level + (folderName ? 1 : 0)) * 2 + 1 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {getFileIcon(file.category)}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">{file.name}</Typography>
                  <Chip 
                    label={file.category.toUpperCase()} 
                    size="small" 
                    variant="outlined"
                    sx={{ fontSize: '0.6rem', height: '20px' }}
                  />
                </Box>
              }
              secondary={`${file.fileType || 'text'} file`}
            />
          </ListItemButton>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        fullWidth
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter filename or click browse..."
        helperText={schema?.description || "Reference to a file stored in the database"}
      />
      
      <Button
        variant="outlined"
        startIcon={<SearchIcon />}
        onClick={() => setOpen(true)}
        sx={{ minWidth: 'auto', px: 2 }}
      >
        Browse
      </Button>
      
      {value && (
        <IconButton onClick={handleClear} size="small">
          <ClearIcon />
        </IconButton>
      )}

      <Dialog 
        open={open} 
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Select File Reference
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose a GraphQL, SQL, or other text file stored in the database to reference.
          </Typography>
          
          {loading ? (
            <Typography>Loading files...</Typography>
          ) : (
            <List>
              {/* Root files */}
              {renderFolderContents('root')}
              
              {/* Folder files */}
              {Object.entries(folders)
                .filter(([folderId]) => folderId !== 'root')
                .map(([folderId, folderFiles]) => 
                  renderFolderContents(folderId, `Folder ${folderId}`, 0)
                )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FileReferenceField;
