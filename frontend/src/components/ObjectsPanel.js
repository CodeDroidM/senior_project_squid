import React, { useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Collapse,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewListIcon from '@mui/icons-material/ViewList';
import FunctionsIcon from '@mui/icons-material/Functions';
import TagIcon from '@mui/icons-material/Tag';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/* ── palette ──────────────────────────────────────────────────────── */
const C = {
  schema:   '#9c6fde',
  table:    '#89d185',
  view:     '#64b5f6',
  index:    '#80cbc4',
  fn:       '#f48771',
  chevron:  '#6e6e6e',
  hover:    'rgba(255,255,255,0.04)',
  active:   'rgba(156,111,222,0.1)',
  text:     '#d4d4d4',
  dim:      '#9a9a9a',
};

const ROW = {
  display: 'flex', alignItems: 'center', gap: 0.5,
  py: '2px', cursor: 'pointer', userSelect: 'none',
  '&:hover': { bgcolor: C.hover },
};

const Chev = ({ open }) => open
  ? <ExpandMoreIcon  sx={{ fontSize: 14, color: C.chevron, flexShrink: 0 }} />
  : <ChevronRightIcon sx={{ fontSize: 14, color: C.chevron, flexShrink: 0 }} />;

const Row = ({ depth = 0, left, label, badge, onClick, onContextMenu, sx = {} }) => (
  <Box onClick={onClick} onContextMenu={onContextMenu} sx={{ ...ROW, pl: depth * 1.4 + 0.5, ...sx }}>
    {left}
    <Typography sx={{ flex: 1, fontSize: 12.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
    {badge !== undefined && (
      <Typography sx={{ fontSize: 10, color: C.dim, flexShrink: 0, pr: 1 }}>{badge}</Typography>
    )}
  </Box>
);

const FOLDERS = [
  { key: 'tables',    label: 'Tables',    icon: <TableChartIcon sx={{ fontSize: 14, color: C.table,  flexShrink: 0 }} /> },
  { key: 'views',     label: 'Views',     icon: <ViewListIcon   sx={{ fontSize: 14, color: C.view,   flexShrink: 0 }} /> },
  { key: 'indexes',   label: 'Indexes',   icon: <TagIcon        sx={{ fontSize: 14, color: C.index,  flexShrink: 0 }} /> },
  { key: 'functions', label: 'Functions', icon: <FunctionsIcon  sx={{ fontSize: 14, color: C.fn,     flexShrink: 0 }} /> },
];

/* ── Oracle DDL / inspection queries ─────────────────────────────── */
const oracleQueries = {
  select100:    (owner, name)       => `SELECT * FROM ${owner}.${name} FETCH FIRST 100 ROWS ONLY`,
  selectCount:  (owner, name)       => `SELECT COUNT(*) AS ROW_COUNT FROM ${owner}.${name}`,
  describe:     (owner, name)       => `SELECT
  col.COLUMN_ID,
  col.COLUMN_NAME,
  col.DATA_TYPE ||
    CASE
      WHEN col.DATA_TYPE IN ('VARCHAR2','NVARCHAR2','CHAR','NCHAR') THEN '(' || col.CHAR_LENGTH || ')'
      WHEN col.DATA_TYPE = 'NUMBER' AND col.DATA_PRECISION IS NOT NULL
        THEN '(' || col.DATA_PRECISION || ',' || col.DATA_SCALE || ')'
      ELSE ''
    END AS DATA_TYPE,
  col.NULLABLE,
  col.DATA_DEFAULT,
  CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END AS PRIMARY_KEY
FROM ALL_TAB_COLUMNS col
LEFT JOIN (
  SELECT ac.OWNER, ac.TABLE_NAME, acc.COLUMN_NAME
  FROM ALL_CONSTRAINTS ac
  JOIN ALL_CONS_COLUMNS acc
    ON acc.CONSTRAINT_NAME = ac.CONSTRAINT_NAME AND acc.OWNER = ac.OWNER
  WHERE ac.CONSTRAINT_TYPE = 'P'
) pk ON pk.OWNER = col.OWNER AND pk.TABLE_NAME = col.TABLE_NAME AND pk.COLUMN_NAME = col.COLUMN_NAME
WHERE col.OWNER = '${owner}'
  AND col.TABLE_NAME = '${name}'
ORDER BY col.COLUMN_ID`,

  constraints:  (owner, name)       => `SELECT
  ac.CONSTRAINT_NAME,
  ac.CONSTRAINT_TYPE,
  CASE ac.CONSTRAINT_TYPE
    WHEN 'P' THEN 'PRIMARY KEY'
    WHEN 'U' THEN 'UNIQUE'
    WHEN 'R' THEN 'FOREIGN KEY'
    WHEN 'C' THEN 'CHECK'
    ELSE ac.CONSTRAINT_TYPE
  END AS TYPE_DESC,
  LISTAGG(acc.COLUMN_NAME, ', ') WITHIN GROUP (ORDER BY acc.POSITION) AS COLUMNS,
  ac.R_CONSTRAINT_NAME AS REF_CONSTRAINT,
  ac.STATUS,
  ac.VALIDATED
FROM ALL_CONSTRAINTS ac
JOIN ALL_CONS_COLUMNS acc
  ON acc.CONSTRAINT_NAME = ac.CONSTRAINT_NAME AND acc.OWNER = ac.OWNER
WHERE ac.OWNER = '${owner}'
  AND ac.TABLE_NAME = '${name}'
GROUP BY ac.CONSTRAINT_NAME, ac.CONSTRAINT_TYPE, ac.R_CONSTRAINT_NAME, ac.STATUS, ac.VALIDATED
ORDER BY ac.CONSTRAINT_TYPE, ac.CONSTRAINT_NAME`,

  indexes:      (owner, name)       => `SELECT
  ai.INDEX_NAME,
  ai.INDEX_TYPE,
  ai.UNIQUENESS,
  LISTAGG(aic.COLUMN_NAME || CASE WHEN aic.DESCEND = 'DESC' THEN ' DESC' ELSE '' END, ', ')
    WITHIN GROUP (ORDER BY aic.COLUMN_POSITION) AS COLUMNS,
  ai.STATUS,
  ai.PARTITIONED,
  ai.NUM_ROWS,
  ai.LAST_ANALYZED
FROM ALL_INDEXES ai
JOIN ALL_IND_COLUMNS aic
  ON aic.INDEX_NAME = ai.INDEX_NAME AND aic.TABLE_OWNER = ai.TABLE_OWNER
WHERE ai.TABLE_OWNER = '${owner}'
  AND ai.TABLE_NAME  = '${name}'
GROUP BY ai.INDEX_NAME, ai.INDEX_TYPE, ai.UNIQUENESS, ai.STATUS,
         ai.PARTITIONED, ai.NUM_ROWS, ai.LAST_ANALYZED
ORDER BY ai.INDEX_NAME`,

  tableStats:   (owner, name)       => `SELECT
  t.NUM_ROWS,
  t.BLOCKS,
  t.AVG_ROW_LEN,
  t.LAST_ANALYZED,
  t.PARTITIONED,
  t.ROW_MOVEMENT,
  t.COMPRESSION,
  t.COMPRESS_FOR,
  ts.TABLESPACE_NAME
FROM ALL_TABLES t
LEFT JOIN ALL_SEGMENTS ts
  ON ts.OWNER = t.OWNER AND ts.SEGMENT_NAME = t.TABLE_NAME AND ts.SEGMENT_TYPE = 'TABLE'
WHERE t.OWNER = '${owner}'
  AND t.TABLE_NAME = '${name}'`,

  viewDef:      (owner, name)       => `SELECT TEXT_VC AS VIEW_DEFINITION
FROM ALL_VIEWS
WHERE OWNER = '${owner}'
  AND VIEW_NAME = '${name}'`,

  dependencies: (owner, name)       => `SELECT
  TYPE AS OBJECT_TYPE,
  NAME AS OBJECT_NAME,
  REFERENCED_OWNER,
  REFERENCED_TYPE,
  REFERENCED_NAME
FROM ALL_DEPENDENCIES
WHERE OWNER = '${owner}'
  AND NAME  = '${name}'
ORDER BY REFERENCED_TYPE, REFERENCED_NAME`,

  grantedPrivs: (owner, name)       => `SELECT
  GRANTEE,
  PRIVILEGE,
  GRANTABLE,
  HIERARCHY
FROM ALL_TAB_PRIVS
WHERE TABLE_SCHEMA = '${owner}'
  AND TABLE_NAME   = '${name}'
ORDER BY GRANTEE, PRIVILEGE`,
};

/* ── context menu items per object type ─────────────────────────── */
const getMenuItems = (folderKey, owner, name, onExec) => {
  const isTableOrView = folderKey === 'tables' || folderKey === 'views';
  const isTable = folderKey === 'tables';
  const isView  = folderKey === 'views';

  const items = [];

  if (isTableOrView) {
    items.push(
      { label: `SELECT TOP 100 Rows`,   icon: '▶', action: () => onExec(oracleQueries.select100(owner, name)) },
      { label: `Count Rows`,            icon: '#', action: () => onExec(oracleQueries.selectCount(owner, name)) },
      { divider: true },
      { label: `Describe (Columns)`,    icon: '≡', action: () => onExec(oracleQueries.describe(owner, name)) },
      { label: `Show Indexes`,          icon: '⌖', action: () => onExec(oracleQueries.indexes(owner, name)) },
    );
    if (isTable) {
      items.push(
        { label: `Show Constraints`,    icon: '🔑', action: () => onExec(oracleQueries.constraints(owner, name)) },
        { label: `Table Statistics`,    icon: '📊', action: () => onExec(oracleQueries.tableStats(owner, name)) },
      );
    }
    if (isView) {
      items.push(
        { label: `View Definition`,     icon: '📄', action: () => onExec(oracleQueries.viewDef(owner, name)) },
      );
    }
    items.push(
      { divider: true },
      { label: `Dependencies`,          icon: '↗', action: () => onExec(oracleQueries.dependencies(owner, name)) },
      { label: `Granted Privileges`,    icon: '🔒', action: () => onExec(oracleQueries.grantedPrivs(owner, name)) },
    );
  }

  if (folderKey === 'indexes') {
    items.push(
      { label: `Show Indexes for Schema`, icon: '⌖', action: () => onExec(
          `SELECT ai.INDEX_NAME, ai.TABLE_NAME, ai.INDEX_TYPE, ai.UNIQUENESS,
  LISTAGG(aic.COLUMN_NAME, ', ') WITHIN GROUP (ORDER BY aic.COLUMN_POSITION) AS COLUMNS
FROM ALL_INDEXES ai
JOIN ALL_IND_COLUMNS aic ON aic.INDEX_NAME = ai.INDEX_NAME AND aic.TABLE_OWNER = ai.TABLE_OWNER
WHERE ai.TABLE_OWNER = '${owner}'
GROUP BY ai.INDEX_NAME, ai.TABLE_NAME, ai.INDEX_TYPE, ai.UNIQUENESS
ORDER BY ai.TABLE_NAME, ai.INDEX_NAME`
        )
      },
    );
  }

  return items;
};

const ObjectsPanel = ({ accessData, onTableClick, loading, error }) => {
  const [openSchemas, setOpenSchemas] = useState({});
  const [openFolders, setOpenFolders] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null); // { mouseX, mouseY, owner, name, folderKey }

  const toggleSchema = (s)   => setOpenSchemas(p => ({ ...p, [s]: !p[s] }));
  const toggleFolder = (key) => setOpenFolders(p => ({ ...p, [key]: !p[key] }));

  const handleContextMenu = (e, owner, name, folderKey) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ mouseX: e.clientX - 2, mouseY: e.clientY - 4, owner, name, folderKey });
  };

  const closeCtxMenu = () => setCtxMenu(null);

  const handleCtxAction = (action) => {
    action();
    closeCtxMenu();
  };

  const organizeBySchema = (data) => {
    if (!data) return {};
    const schemas = {};
    try {
      let parsedData = data;
      if (data.data) parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
      if (parsedData?.data) parsedData = typeof parsedData.data === 'string' ? JSON.parse(parsedData.data) : parsedData.data;
      const ensure = (s) => { if (!schemas[s]) schemas[s] = { tables: [], views: [], indexes: [], functions: [] }; };
      const normType = (raw) => {
        const t = String(raw || '').toUpperCase().trim();
        if (t === 'TABLE' || t === 'TABLES') return 'tables';
        if (t === 'VIEW'  || t === 'VIEWS')  return 'views';
        if (t === 'INDEX' || t === 'INDEXES') return 'indexes';
        if (t === 'FUNCTION' || t === 'FUNCTIONS') return 'functions';
        return null;
      };
      if (Array.isArray(parsedData)) {
        parsedData.forEach((item) => {
          const schema = item.USERNAME || item.OWNER || item.SCHEMA_NAME || item.schema || 'UNKNOWN';
          const name   = item.OBJECT_NAME || item.TABLE_NAME || item.NAME || item.name;
          const bucket = normType(item.OBJECT_TYPE || item.TYPE) || 'tables';
          ensure(schema);
          if (name && !schemas[schema][bucket].includes(name)) schemas[schema][bucket].push(name);
        });
      } else if (typeof parsedData === 'object') {
        Object.keys(parsedData).forEach((k) => {
          const v = parsedData[k];
          ensure(k);
          if (Array.isArray(v)) { schemas[k].tables = v; return; }
          if (v && typeof v === 'object') {
            schemas[k].tables    = v.tables    || v.TABLES    || schemas[k].tables;
            schemas[k].views     = v.views     || v.VIEWS     || schemas[k].views;
            schemas[k].indexes   = v.indexes   || v.INDEXES   || schemas[k].indexes;
            schemas[k].functions = v.functions || v.FUNCTIONS || schemas[k].functions;
          }
        });
      }
    } catch (e) { console.error('ObjectsPanel parse error', e); }
    return schemas;
  };

  const schemas     = organizeBySchema(accessData);
  const schemaNames = Object.keys(schemas);
  const totalObjs   = schemaNames.reduce((n, s) =>
    n + FOLDERS.reduce((m, f) => m + (schemas[s][f.key]?.length || 0), 0), 0);

  const ctxMenuItems = ctxMenu
    ? getMenuItems(ctxMenu.folderKey, ctxMenu.owner, ctxMenu.name, onTableClick)
    : [];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#252526', overflow: 'hidden' }}>
      {/* subtitle */}
      <Box sx={{ px: 1.5, py: 0.5, borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 10.5, color: C.dim }}>
          {schemaNames.length} schema{schemaNames.length !== 1 ? 's' : ''} · {totalObjs} object{totalObjs !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
            <CircularProgress size={14} sx={{ color: '#4fc3f7' }} />
            <Typography sx={{ fontSize: 12, color: C.dim }}>Loading…</Typography>
          </Box>
        )}
        {error && !loading && (
          <Alert severity="error" sx={{ m: 1, fontSize: 12, bgcolor: '#3c2020', color: '#f48771', border: '1px solid #5c3030', '& .MuiAlert-icon': { color: '#f48771' } }}>
            {error}
          </Alert>
        )}
        {!loading && !error && schemaNames.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <StorageIcon sx={{ fontSize: 32, color: '#3c3c3c', mb: 1 }} />
            <Typography sx={{ fontSize: 12, color: C.dim }}>No objects found</Typography>
          </Box>
        )}

        {!loading && schemaNames.map((schemaName) => {
          const schemaOpen = !!openSchemas[schemaName];
          const schemaTotalObjs = FOLDERS.reduce((n, f) => n + (schemas[schemaName][f.key]?.length || 0), 0);
          return (
            <Box key={schemaName}>
              <Row
                depth={0}
                left={<><Chev open={schemaOpen} /><StorageIcon sx={{ fontSize: 14, color: C.schema, flexShrink: 0 }} /></>}
                label={schemaName}
                badge={schemaTotalObjs}
                onClick={() => toggleSchema(schemaName)}
                sx={{ '&:hover': { bgcolor: 'rgba(156,111,222,0.08)' } }}
              />
              <Collapse in={schemaOpen} timeout={80} unmountOnExit>
                {FOLDERS.map((folder) => {
                  const items      = schemas[schemaName][folder.key] || [];
                  const fKey       = `${schemaName}::${folder.key}`;
                  const folderOpen = !!openFolders[fKey];
                  return (
                    <Box key={fKey}>
                      <Row
                        depth={1}
                        left={<><Chev open={folderOpen} />{folder.icon}</>}
                        label={folder.label}
                        badge={items.length}
                        onClick={() => toggleFolder(fKey)}
                      />
                      <Collapse in={folderOpen} timeout={60} unmountOnExit>
                        {items.length === 0 ? (
                          <Row depth={2.5} left={null} label={`No ${folder.label.toLowerCase()}`}
                            sx={{ color: C.dim, cursor: 'default', '&:hover': {} }} />
                        ) : items.map((name) => (
                          <Row
                            key={`${fKey}::${name}`}
                            depth={2.5}
                            left={folder.icon}
                            label={name}
                            onClick={() => {
                              if (folder.key === 'tables' || folder.key === 'views') {
                                onTableClick(`SELECT * FROM ${schemaName}.${name} FETCH FIRST 10 ROWS ONLY`);
                              } else {
                                onTableClick(`-- ${folder.label}: ${schemaName}.${name}`);
                              }
                            }}
                            onContextMenu={(e) => handleContextMenu(e, schemaName, name, folder.key)}
                            sx={{ '&:hover': { bgcolor: C.active } }}
                          />
                        ))}
                      </Collapse>
                    </Box>
                  );
                })}
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* ── Right-click context menu ── */}
      <Menu
        open={Boolean(ctxMenu)}
        onClose={closeCtxMenu}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
        PaperProps={{
          sx: {
            bgcolor: '#252526', border: '1px solid #3c3c3c',
            boxShadow: '0 6px 24px rgba(0,0,0,0.7)', minWidth: 220,
            '& .MuiMenuItem-root': { fontSize: 12.5, py: 0.6, color: '#d4d4d4' },
          }
        }}
      >
        {/* Header */}
        {ctxMenu && (
          <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid #3c3c3c' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#9c6fde' }}>
              {ctxMenu.owner}.{ctxMenu.name}
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#6e6e6e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {ctxMenu.folderKey?.slice(0, -1)}
            </Typography>
          </Box>
        )}
        {ctxMenuItems.map((item, i) =>
          item.divider ? (
            <Divider key={i} sx={{ borderColor: '#3c3c3c', my: 0.25 }} />
          ) : (
            <MenuItem
              key={i}
              onClick={() => handleCtxAction(item.action)}
              sx={{ gap: 1.5, '&:hover': { bgcolor: '#37373d' } }}
            >
              <Typography sx={{ fontSize: 13, width: 18, textAlign: 'center', color: '#9c6fde', lineHeight: 1 }}>
                {item.icon}
              </Typography>
              {item.label}
            </MenuItem>
          )
        )}
      </Menu>
    </Box>
  );
};

export default ObjectsPanel;
