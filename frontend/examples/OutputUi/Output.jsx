import React from "react";
import { Box } from "@mui/material";
import Terminal from "./Terminal";

const Output = ({ configPath }) => {
  return (
    <Box
      sx={{
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Terminal configPath={configPath} />
    </Box>
  );
};

export default Output;
