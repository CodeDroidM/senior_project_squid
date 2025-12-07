import React, { useMemo, useState } from "react";
import { Paper, Typography, IconButton, Tooltip, Box } from "@mui/material";
import { AccountTree as DiagramIcon } from "@mui/icons-material";
import { withTheme } from "@rjsf/core";
import { Theme as MuiTheme } from "@rjsf/material-ui";
import validator from "@rjsf/validator-ajv8";
import EditableTable from "./EditableTable";
import CustomArrayFieldTemplate from "./ArrayFieldTemplate";
import customButtonTemplates from "./CustomButtonTemplates";
import CustomEnumField from "./CustomEnumField";
import RequestTesterField from "./RequestTesterField";
import FileReferenceField from "./FileReferenceField";
import TableRelationshipDiagram from "./TableRelationshipDiagram";
import { Tabs, Tab } from "@mui/material";

const ThemeForm = withTheme(MuiTheme);

// Recursively build an uiSchema that swaps in custom fields by type or title
const generateUiSchema = (schema, baseUiSchema = {}) => {
  const uiSchema = { ...baseUiSchema };

  const traverse = (subSchema, path = "") => {
    if (subSchema.type === "string" && subSchema.enum) {
      uiSchema[path] = { "ui:field": "CustomEnumField" };
    }
    if (path === "Columns") {
      uiSchema["Columns"] = { "ui:field": "EditableTable" };
    }
    if (subSchema.type === "string" && subSchema.title === "Request Tester") {
      uiSchema[path] = { "ui:field": "RequestTesterField" };
    }
    if (schema.type === "string" && schema.title === "Request Tester") {
      uiSchema[path] = { "ui:field": "RequestTesterField" };
    }
    
    // Add FileReferenceField for ContentFromFile fields
    if (subSchema.type === "string" && subSchema.title === "Content From File") {
      uiSchema[path] = { "ui:field": "FileReferenceField" };
    }

    if (subSchema.properties) {
      Object.entries(subSchema.properties).forEach(([key, val]) => {
        const next = path ? `${path}.${key}` : key;
        traverse(val, next);
      });
    }
    if (subSchema.items && subSchema.items.type === "object") {
      traverse(subSchema.items, path ? `${path}.items` : "items");
    }
  };

  traverse(schema);
  return uiSchema;
};

export default function ConfigForm({
  selectedSection,
  sharedFormData,
  loadFormData,
  importFormData,
  handleSubmit,
  handleSourceTypeChange,
  sections,
  uiSchema: baseUiSchema,
  setSelectedSection,

  validate,
  extraErrors,
  setLoadFormData,
  setImportFormData,
  setSharedFormData,
}) {
  const [showDiagram, setShowDiagram] = useState(false);
  
  /** choose section safely */
  let section = sections[selectedSection] ?? sections["SharedConfiguration"];

  const dynamicUiSchema = useMemo(
    () => generateUiSchema(section.schema, baseUiSchema),
    [section.schema, baseUiSchema],
  );

  const fields = useMemo(
    () => ({
      EditableTable: (props) => (
        <EditableTable {...props} sourceType={importFormData.SourceType} />
      ),
      CustomEnumField,
      RequestTesterField,
      FileReferenceField,
    }),
    [importFormData.SourceType],
  );

  const handleFormChange = ({ formData }) => {
    if (selectedSection === "LoadConfiguration") setLoadFormData(formData);
    else if (selectedSection === "ImportConfiguration") {
      handleSourceTypeChange({ formData });
      setImportFormData(formData);
    } else setSharedFormData(formData);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mb: 2,
        borderRadius: 2,
        backgroundColor: "#ffffff",
        /* Scrollable form panel */
        flexGrow: 1,
        minHeight: 0,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Tabs
            sx={{
              flexGrow: 1,
              minHeight: "auto",
              "&::after": {
                content: '""',
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "1px",
                backgroundColor: "#E0E0E0",
                zIndex: 1,
              },
              "& .MuiTab-root": {
                color: "#000",
                textTransform: "none",
                minWidth: "auto",
                /* slimmer sizing */
                padding: "4px 12px",
                minHeight: 32,
                fontSize: "0.75rem",
                position: "relative",
                zIndex: 2,
                marginBottom: "-1px", // Pull tabs down to sit on the line

                "&.Mui-selected": {
                  color: "#000",
                  backgroundColor: "#FFEB3B",
                  borderTopLeftRadius: "12px",
                  borderTopRightRadius: "12px",
                  borderBottom: "1px solid #FFEB3B", // Hide the line under selected tab
                },

                "&:hover": {
                  textDecoration: "underline",
                },

                "&.Mui-selected:hover": {
                  backgroundColor: "#FFEB3B",
                  textDecoration: "none",
                },

                "&.Mui-focusVisible, &:focus": {
                  boxShadow: "none",
                  outline: "none",
                },
              },

              "& .MuiTabs-indicator": {
                display: "none",
              },
            }}
            value={selectedSection}
            onChange={(_, val) => setSelectedSection(val)}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons={false}
          >
            {Object.entries(sections).map(([key, s]) => (
              <Tab
                key={key}
                label={s.title}
                value={key}
                disableRipple // Add this to remove ripple effect
                sx={{
                  "&:focus-visible": { outline: "none" }, // Remove focus outline
                  "&:focus": { boxShadow: "none" }, // Ensure no box shadow on focus
                }}
              />
            ))}
          </Tabs>
          
          <Tooltip title={showDiagram ? "Hide table diagram" : "Show table diagram"}>
            <IconButton
              onClick={() => setShowDiagram(!showDiagram)}
              sx={{ 
                ml: 2,
                color: showDiagram ? "#1976d2" : "#666",
                "&:hover": { backgroundColor: "#f5f5f5" }
              }}
            >
              <DiagramIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
        {section.title}
      </Typography>

      {/* Table Relationship Diagram */}
      <TableRelationshipDiagram
        sharedFormData={sharedFormData}
        loadFormData={loadFormData}
        importFormData={importFormData}
        showDiagram={showDiagram}
        onToggleVisibility={() => setShowDiagram(false)}
      />

      <ThemeForm
        schema={section.schema}
        formData={
          selectedSection === "SharedConfiguration"
            ? sharedFormData
            : selectedSection === "LoadConfiguration"
              ? loadFormData
              : importFormData
        }
        onSubmit={handleSubmit}
        onChange={handleFormChange}
        validator={validator}
        validate={validate}
        extraErrors={extraErrors}
        uiSchema={dynamicUiSchema}
        fields={fields}
        templates={{
          ArrayFieldTemplate: CustomArrayFieldTemplate,
          ButtonTemplates: customButtonTemplates,
        }}
        formContext={{ sharedFormData, loadFormData, importFormData }}
      />
    </Paper>
  );
}
