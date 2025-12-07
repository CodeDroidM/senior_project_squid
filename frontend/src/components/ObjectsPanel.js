import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Paper,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ChevronRight from '@mui/icons-material/ChevronRight';
import TableViewIcon from '@mui/icons-material/TableView';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';

const ObjectsPanel = ({ accessData, onTableClick, loading, error }) => {
  const [expandedSchemas, setExpandedSchemas] = useState({});

  const toggleSchema = (schemaName) => {
    setExpandedSchemas(prev => ({
      ...prev,
      [schemaName]: !prev[schemaName]
    }));
  };

  const handleTableClick = (schema, table) => {
    const sampleQuery = `SELECT * FROM ${schema}.${table} FETCH FIRST 10 ROWS ONLY`;
    onTableClick(sampleQuery);
  };

  // Parse access data to organize by schema
  const organizeBySchema = (data) => {
    if (!data) return {};
    
    console.log('Access data received:', data);
    
    const schemas = {};
    try {
      // Handle different response formats
      let parsedData = data;
      
      // If data has a 'data' property, use that
      if (data.data) {
        parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
      }
      
      // If it's still an object with a data property, unwrap it
      if (parsedData && parsedData.data) {
        parsedData = typeof parsedData.data === 'string' ? JSON.parse(parsedData.data) : parsedData.data;
      }
      
      console.log('Parsed data:', parsedData);
      
      if (Array.isArray(parsedData)) {
        parsedData.forEach((item) => {
          // Try multiple field name variations for schema/owner
          // DbSrc returns USERNAME as the schema name
          const schemaName = item.USERNAME || item.username || item.OWNER || item.owner || item.SCHEMA_NAME || item.schema_name || item.SCHEMA || item.schema || 'UNKNOWN';
          
          // Try multiple field name variations for table/object name
          const tableName = item.OBJECT_NAME || item.object_name || item.TABLE_NAME || item.table_name || item.NAME || item.name;
          
          if (!schemas[schemaName]) {
            schemas[schemaName] = [];
          }
          
          if (tableName && !schemas[schemaName].includes(tableName)) {
            schemas[schemaName].push(tableName);
          }
        });
      } else if (typeof parsedData === 'object') {
        // Handle case where data is already organized by schema
        Object.keys(parsedData).forEach((key) => {
          if (Array.isArray(parsedData[key])) {
            schemas[key] = parsedData[key];
          }
        });
      }
    } catch (e) {
      console.error('Error parsing access data:', e, data);
    }
    
    console.log('Organized schemas:', schemas);
    return schemas;
  };

  const schemas = organizeBySchema(accessData);
  const schemaCount = Object.keys(schemas).length;
  const tableCount = Object.values(schemas).reduce((sum, tables) => sum + tables.length, 0);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      {/* Header - matching ConfigDrawer style */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: '#f5f5f5'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <StorageIcon sx={{ color: '#336791', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
            Database Objects
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {schemaCount} {schemaCount === 1 ? 'schema' : 'schemas'} • {tableCount} {tableCount === 1 ? 'object' : 'objects'}
        </Typography>
      </Box>

      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center',
            p: 4,
            gap: 2
          }}>
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              Loading accessible objects...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && Object.keys(schemas).length === 0 && (
          <Alert severity="info" sx={{ m: 2 }}>
            No accessible objects found. Please connect to the database.
          </Alert>
        )}

        {/* Schema/Table List - ConfigDrawer style */}
        {!loading && !error && Object.keys(schemas).length > 0 && (
          <List dense disablePadding>
            {Object.keys(schemas).map((schemaName) => (
              <Box key={schemaName} sx={{ mb: 1 }}>
                {/* Schema Header */}
                <ListItem
                  disablePadding
                  sx={{
                    bgcolor: expandedSchemas[schemaName] ? '#e3f2fd' : 'transparent',
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: expandedSchemas[schemaName] ? '#bbdefb' : '#f5f5f5',
                    },
                  }}
                >
                  <ListItemButton
                    onClick={() => toggleSchema(schemaName)}
                    sx={{ py: 0.75, px: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <IconButton size="small" sx={{ p: 0 }}>
                        {expandedSchemas[schemaName] ? (
                          <ExpandMore sx={{ fontSize: 18 }} />
                        ) : (
                          <ChevronRight sx={{ fontSize: 18 }} />
                        )}
                      </IconButton>
                    </ListItemIcon>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {expandedSchemas[schemaName] ? (
                        <FolderOpenIcon sx={{ fontSize: 18, color: '#ffa726' }} />
                      ) : (
                        <FolderIcon sx={{ fontSize: 18, color: '#ffa726' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={schemaName}
                      secondary={`${schemas[schemaName].length} ${schemas[schemaName].length === 1 ? 'object' : 'objects'}`}
                      primaryTypographyProps={{
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                      }}
                      secondaryTypographyProps={{
                        fontSize: '0.7rem',
                      }}
                    />
                  </ListItemButton>
                </ListItem>

                {/* Tables under schema */}
                <Collapse in={expandedSchemas[schemaName]} timeout="auto" unmountOnExit>
                  <List dense disablePadding sx={{ pl: 3 }}>
                    {schemas[schemaName].map((tableName, index) => (
                      <ListItem
                        key={`${schemaName}-${tableName}-${index}`}
                        disablePadding
                        sx={{
                          '&:hover': {
                            bgcolor: '#f5f5f5',
                          },
                        }}
                      >
                        <ListItemButton
                          onClick={() => handleTableClick(schemaName, tableName)}
                          sx={{ py: 0.5, px: 1, borderRadius: 1 }}
                        >
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <TableChartIcon sx={{ fontSize: 16, color: '#42a5f5' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={tableName}
                            primaryTypographyProps={{
                              fontSize: '0.75rem',
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default ObjectsPanel;
