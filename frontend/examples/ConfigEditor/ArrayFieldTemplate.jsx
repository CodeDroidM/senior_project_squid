import React from "react";
import { Grid, Typography, Divider, Paper } from "@mui/material";
import customButtonTemplates from "./CustomButtonTemplates";

const CustomArrayFieldTemplate = (props) => {
  let addButtonText = "Add item";

  if (props.title === "Additional Header") {
    addButtonText = "Add Additional Header";
  } else if (props.title === "JSON Path Mappings") {
    addButtonText = "Add JSON Path Mapping";
  } else if (props.title === "ReQuery JSON Path Output") {
    addButtonText = "Add ReQuery JSON Path Output";
  }

  return (
    <Grid container spacing={2}>
      {props.title && (
        <Grid item xs={12}>
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            {props.title}
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>
      )}

      {props.items &&
        props.items.map((element, index) => (
          <Grid item xs={12} key={index}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={10}>
                  {element.children}
                </Grid>
                <Grid item xs={6} md={1}>
                  {element.hasMoveUp && (
                    <customButtonTemplates.MoveUpButton
                      onClick={element.onReorderClick(
                        element.index,
                        element.index - 1,
                      )}
                    />
                  )}
                  {element.hasMoveDown && (
                    <customButtonTemplates.MoveDownButton
                      onClick={element.onReorderClick(
                        element.index,
                        element.index + 1,
                      )}
                    />
                  )}
                </Grid>
                <Grid item xs={6} md={1}>
                  <customButtonTemplates.RemoveButton
                    onClick={element.onDropIndexClick(element.index)}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        ))}

      {props.canAdd && (
        <Grid item xs={12}>
          <customButtonTemplates.AddButton
            onClick={props.onAddClick}
            text={addButtonText}
          />
        </Grid>
      )}
    </Grid>
  );
};

export default CustomArrayFieldTemplate;
