/* ------------------------------------------------------------------
   src/ConfigEditor/TableRelationshipDiagram.jsx
   Visualizes the table structure and relationships that will be created
   based on the current configuration settings
-------------------------------------------------------------------*/
import React, { useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  IconButton,
  Collapse,
  FormControlLabel,
  Switch,
} from "@mui/material";
import {
  Storage as TableIcon,
  AccountTree as RelationIcon,
  VisibilityOff as VisibilityOffIcon,
  DataObject as DataIcon,
  Api as ApiIcon,
  Input as SourceIcon,
  ListAlt as HeaderIcon,
} from "@mui/icons-material";

const TableRelationshipDiagram = ({ 
  sharedFormData = {}, 
  loadFormData = {}, 
  importFormData = {},
  showDiagram = true,
  onToggleVisibility 
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  // Generate table information based on configuration
  const tableInfo = useMemo(() => {
    const schema = sharedFormData.SchemaName || "[Schema]";
    const entity = sharedFormData.EntityName || "Entity";
    const systemName = sharedFormData.SystemName || "";
    
    // Build schema name with system prefix as done in backend
    const displaySchema = (() => {
      if (systemName) {
        // Remove brackets if present to build compound schema properly
        const baseSchema = schema.replace(/^\[|\]$/g, '');
        const cleanSystemName = systemName.replace(/^\[|\]$/g, '');
        return `[${cleanSystemName}.${baseSchema}]`;
      } else {
        // Ensure brackets are present for simple schema names
        return schema.startsWith('[') && schema.endsWith(']') ? schema : `[${schema}]`;
      }
    })();
    
    // Source database info
    const sourceDb = sharedFormData.DatabaseName || "Database";
    const apiDb = sharedFormData.ApiDatabaseName || "stage_api";
    const logicDb = sharedFormData.LogicDatabaseName || "stage_logic";
    
    // Table names based on the actual naming convention from backend (esai.py)
    // Source table can be custom or follows "source_EntityName" pattern
    const sourceTableName = importFormData.DestinationInfo?.TableName || `source_${entity}`;
    const dataTableName = `data_${entity}`;
    const headerTableName = `header_${entity}`;
    const apiTableName = entity; // Just the entity name for API table
    
    // Column information
    const columns = loadFormData.Columns || [];
    const businessKeys = columns.filter(col => col.IsBusinessKey);
    const regularColumns = columns.filter(col => !col.IsBusinessKey);
    const keptColumns = columns.filter(col => col.IsKeptColumn);
    
    // Migration behavior
    const schemaMigration = loadFormData.SchemaMigration || "Manual";
    const useDeltaLoad = loadFormData.UseDeltaLoad || false;
    
    // Source type
    const sourceType = importFormData.SourceType || "Unknown";
    
    return {
      schema: displaySchema,
      entity,
      systemName,
      sourceDb,
      apiDb,
      logicDb,
      sourceTableName,
      dataTableName,
      headerTableName,
      apiTableName,
      columns,
      businessKeys,
      regularColumns,
      keptColumns,
      schemaMigration,
      useDeltaLoad,
      sourceType,
      totalColumns: columns.length
    };
  }, [sharedFormData, loadFormData, importFormData]);

  const TableCard = ({ 
    title, 
    database, 
    schema, 
    tableName, 
    icon: Icon, 
    color, 
    description, 
    columns = [], 
    isView = false 
  }) => (
    <Card 
      sx={{ 
        minWidth: 200, 
        maxWidth: 300, 
        border: `2px solid ${color}`,
        '&:hover': { boxShadow: 3 }
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Icon sx={{ color, mr: 1 }} />
          <Typography variant="h6" sx={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
            {title}
          </Typography>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {description}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" display="block">
            <strong>Database:</strong> {database}
          </Typography>
          <Typography variant="caption" display="block">
            <strong>Schema:</strong> {schema}
          </Typography>
          <Typography variant="caption" display="block">
            <strong>{isView ? 'View' : 'Table'}:</strong> {tableName}
          </Typography>
        </Box>
        
        {columns.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              Key Columns ({columns.length}):
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {columns.slice(0, 3).map((col, idx) => (
                <Chip
                  key={idx}
                  label={col.Name || col}
                  size="small"
                  sx={{ 
                    mr: 0.5, 
                    mb: 0.5, 
                    fontSize: '0.7rem',
                    height: '20px'
                  }}
                />
              ))}
              {columns.length > 3 && (
                <Chip
                  label={`+${columns.length - 3} more`}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    mr: 0.5, 
                    mb: 0.5, 
                    fontSize: '0.7rem',
                    height: '20px'
                  }}
                />
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const ConnectionArrow = ({ direction = "right" }) => (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mx: 2,
        transform: direction === "down" ? "rotate(90deg)" : "none"
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 2,
          backgroundColor: '#666',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 0,
            top: -3,
            width: 0,
            height: 0,
            borderLeft: '6px solid #666',
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
          }
        }}
      />
    </Box>
  );

  if (!showDiagram) return null;

  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        mb: 2,
        borderRadius: 2,
        backgroundColor: "#f8f9fa",
        border: "1px solid #e0e0e0"
      }}
    >
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center">
          <RelationIcon sx={{ mr: 1, color: "#1976d2" }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Table Structure Preview
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={showDetails}
                onChange={(e) => setShowDetails(e.target.checked)}
                size="small"
              />
            }
            label="Show Details"
            sx={{ m: 0 }}
          />
          <IconButton 
            size="small" 
            onClick={onToggleVisibility}
            title="Hide diagram"
          >
            <VisibilityOffIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Configuration Summary */}
      <Box sx={{ mb: 3, p: 2, backgroundColor: 'white', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          Configuration Summary:
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={1}>
          <Chip 
            label={`Source: ${tableInfo.sourceType}`} 
            size="small" 
            color="primary" 
          />
          <Chip 
            label={`Schema: ${tableInfo.schema}`} 
            size="small" 
            variant="outlined" 
          />
          <Chip 
            label={`Entity: ${tableInfo.entity}`} 
            size="small" 
            variant="outlined" 
          />
          <Chip 
            label={`Migration: ${tableInfo.schemaMigration}`} 
            size="small" 
            color={tableInfo.schemaMigration === 'Recreate' ? 'warning' : 'default'}
          />
          <Chip 
            label={`Columns: ${tableInfo.totalColumns}`} 
            size="small" 
            variant="outlined" 
          />
          <Chip 
            label={`Business Keys: ${tableInfo.businessKeys.length}`} 
            size="small" 
            color="secondary" 
          />
          {tableInfo.useDeltaLoad && (
            <Chip 
              label="Delta Load" 
              size="small" 
              color="success" 
            />
          )}
        </Box>
      </Box>

      {/* Data Flow Diagram */}
      <Box sx={{ overflowX: 'auto', pb: 2 }}>
        {/* Row 1: Source to Staging */}
        <Box display="flex" alignItems="center" justifyContent="center" flexWrap="wrap" mb={4}>
          <TableCard
            title="Source Data"
            database={`External (${tableInfo.sourceType})`}
            schema="N/A"
            tableName={importFormData.SourceInfo?.TableName || "External Source"}
            icon={SourceIcon}
            color="#ff9800"
            description={`External ${tableInfo.sourceType} data source`}
            columns={[]}
          />
          
          <ConnectionArrow />
          
          <TableCard
            title="Source Table"
            database={tableInfo.sourceDb}
            schema={tableInfo.schema}
            tableName={tableInfo.sourceTableName}
            icon={TableIcon}
            color="#2196f3"
            description="Staging table for raw imported data"
            columns={[
              "stage_id (PK)",
              "hash_value",
              ...tableInfo.columns.map(col => col.Name).slice(0, 2)
            ]}
          />
        </Box>

        {/* Row 2: Staging to Data/Header */}
        <Box display="flex" alignItems="center" justifyContent="center" flexWrap="wrap" mb={4}>
          <TableCard
            title="Data Table"
            database={tableInfo.sourceDb}
            schema={tableInfo.schema}
            tableName={tableInfo.dataTableName}
            icon={DataIcon}
            color="#4caf50"
            description="Clean data with business key constraints"
            columns={[
              "stage_id (PK)",
              "hash_value",
              ...tableInfo.businessKeys.map(col => `${col.Name} (BK)`)
            ]}
          />

          <ConnectionArrow />

          <TableCard
            title="Header Table"
            database={tableInfo.sourceDb}
            schema={tableInfo.schema}
            tableName={tableInfo.headerTableName}
            icon={HeaderIcon}
            color="#9c27b0"
            description="Change tracking and audit log"
            columns={[
              "stage_id (PK)",
              "hash_value",
              "update_timestamp",
              "update_event",
              ...tableInfo.businessKeys.map(col => col.Name).slice(0, 2)
            ]}
          />
        </Box>

        {/* Row 3: Final API View */}
        <Box display="flex" alignItems="center" justifyContent="center" mb={3}>
          <Box display="flex" flexDirection="column" alignItems="center">
            <ConnectionArrow direction="down" />
            <Typography variant="caption" sx={{ my: 1, fontWeight: 'bold' }}>
              API Layer
            </Typography>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" justifyContent="center">
          <TableCard
            title="API View"
            database={tableInfo.apiDb}
            schema={tableInfo.schema}
            tableName={tableInfo.apiTableName}
            icon={ApiIcon}
            color="#f44336"
            description="Public API endpoint view"
            columns={tableInfo.columns.map(col => col.Name)}
            isView={true}
          />
        </Box>
      </Box>

      {/* Detailed Information */}
      <Collapse in={showDetails}>
        <Box sx={{ mt: 3, p: 2, backgroundColor: 'white', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
            Detailed Column Information:
          </Typography>
          
          <Box display="flex" flexWrap="wrap" gap={2}>
            {/* Business Keys */}
            {tableInfo.businessKeys.length > 0 && (
              <Box sx={{ minWidth: 200 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                  Business Keys ({tableInfo.businessKeys.length}):
                </Typography>
                {tableInfo.businessKeys.map((col, idx) => (
                  <Box key={idx} sx={{ ml: 1, mt: 0.5 }}>
                    <Typography variant="caption" display="block">
                      • {col.Name} ({col.DataType})
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* Kept Columns */}
            {tableInfo.keptColumns.length > 0 && (
              <Box sx={{ minWidth: 200 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#9c27b0' }}>
                  Kept Columns ({tableInfo.keptColumns.length}):
                </Typography>
                {tableInfo.keptColumns.map((col, idx) => (
                  <Box key={idx} sx={{ ml: 1, mt: 0.5 }}>
                    <Typography variant="caption" display="block">
                      • {col.Name} ({col.DataType})
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* Regular Columns */}
            {tableInfo.regularColumns.length > 0 && (
              <Box sx={{ minWidth: 200 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                  Data Columns ({tableInfo.regularColumns.length}):
                </Typography>
                {tableInfo.regularColumns.slice(0, 5).map((col, idx) => (
                  <Box key={idx} sx={{ ml: 1, mt: 0.5 }}>
                    <Typography variant="caption" display="block">
                      • {col.Name} ({col.DataType})
                    </Typography>
                  </Box>
                ))}
                {tableInfo.regularColumns.length > 5 && (
                  <Typography variant="caption" sx={{ ml: 1, mt: 0.5, fontStyle: 'italic' }}>
                    ... and {tableInfo.regularColumns.length - 5} more columns
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {/* Special Notes */}
          {(tableInfo.schemaMigration === 'Recreate' || tableInfo.useDeltaLoad) && (
            <Box sx={{ mt: 2, p: 1.5, backgroundColor: '#fff3e0', borderRadius: 1, border: '1px solid #ffcc02' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#e65100' }}>
                Important Notes:
              </Typography>
              {tableInfo.schemaMigration === 'Recreate' && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  ⚠️ Migration mode "Recreate" will DROP existing tables and data!
                </Typography>
              )}
              {tableInfo.useDeltaLoad && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  🔄 Delta Load enabled - only changed records will be processed
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default TableRelationshipDiagram;
