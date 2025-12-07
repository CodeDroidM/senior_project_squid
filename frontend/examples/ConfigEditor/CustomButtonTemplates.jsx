import React from "react";
import { IconButton, Box, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

const CustomAddButton = ({ onClick, text, ...props }) => (
  <Box display="flex" alignItems="center" mt={2}>
    <IconButton
      size="small"
      sx={{ color: "black" }}
      onClick={onClick}
      {...props}
    >
      <AddIcon />
    </IconButton>
    <Typography variant="caption" sx={{ ml: 1, fontSize: 16 }}>
      {text}
    </Typography>
  </Box>
);

const CustomRemoveButton = (props) => (
  <IconButton size="small" sx={{ color: "black" }} {...props}>
    <DeleteForeverOutlinedIcon />
  </IconButton>
);

const CustomMoveUpButton = (props) => (
  <IconButton size="small" sx={{ color: "black" }} {...props}>
    <ArrowUpwardIcon />
  </IconButton>
);

const CustomMoveDownButton = (props) => (
  <IconButton size="small" sx={{ color: "black" }} {...props}>
    <ArrowDownwardIcon />
  </IconButton>
);

const customButtonTemplates = {
  AddButton: CustomAddButton,
  RemoveButton: CustomRemoveButton,
  MoveUpButton: CustomMoveUpButton,
  MoveDownButton: CustomMoveDownButton,
};

export default customButtonTemplates;
