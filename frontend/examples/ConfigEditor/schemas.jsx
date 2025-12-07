export const sharedSchema = {
  type: "object",
  required: ["ServerName", "DatabaseName", "SchemaName"],
  properties: {
    ServerName: {
      type: "string",
      title: "Server Name",
      description:
        "Server name to connect to. Default is '.' (equivalent to localhost)",
      default: ".",
    },
    DatabaseName: {
      type: "string",
      title: "Database Name",
      description:
        "The database name where the source & header/data tables are located.",
    },
    User: {
      type: "string",
      title: "User",
      description:
        "SQL Username used to authenticate with the server. Leave empty for integrated security.",
    },
    Password: {
      type: "string",
      title: "Password",
      description: "Password for SQL user. Not needed for integrated security.",
      default: "",
    },
    SchemaName: {
      type: "string",
      title: "Schema Name",
      description: "Schema name used when creating tables or views.",
    },
    SystemName: {
      type: "string",
      title: "System Name",
      description: "System name used as a prefix when creating tables.",
    },
    EntityName: {
      type: "string",
      title: "Entity Name",
      description: "Entity name used as a prefix when creating tables.",
    },
    LogicDatabaseName: {
      type: "string",
      title: "Logic Database Name",
      description: "Database for sync key tables/procedures in delta load.",
      default: "stage_logic",
    },
    ApiDatabaseName: {
      type: "string",
      title: "API Database Name",
      description: "Database where the API tables are located/created.",
      default: "stage_api",
    },
  },
};

export const loadSchema = {
  type: "object",
  required: ["SchemaMigration", "Columns"],
  properties: {
    SchemaMigration: {
      type: "string",
      title: "Schema Migration",
      enum: ["Manual", "Recreate", "Automatic"],
      description: "Action to take if table definitions differ during update.",
      default: "Manual",
    },
    OnlySourceToData: {
      type: "boolean",
      title: "Only Source to Data",
      description: "Only copy data from source to data/header tables if true.",
    },
    OnlyDataToApi: {
      type: "boolean",
      title: "Only Data to API",
      description:
        "Only copy data from data/header tables to API table if true.",
    },
    NoUpdateApiViews: {
      type: "boolean",
      title: "No Update API Views",
      description: "If true, default endpoint view won't be overwritten.",
      default: false,
    },
    UseDeltaLoad: {
      type: "boolean",
      title: "Use Delta Load",
      description: "Execute import and merge in delta mode if true.",
      default: false,
    },
    Columns: {
      type: "array",
      title: "Columns",
      items: {
        type: "object",
        required: ["Name", "DataType"],
        properties: {
          Name: {
            type: "string",
            title: "Name",
            description: "Name of the column",
          },
          OutputName: {
            type: "string",
            title: "Output Name",
            description: "Rename the column in table",
            default: "",
          },
          IsBusinessKey: {
            type: "boolean",
            title: "Is Business Key",
            description:
              "Defines if the column is part of a unique business key for the data.",
          },
          IsKeptColumn: {
            type: "boolean",
            title: "Is Kept Column",
            description:
              "Defines if the column should be kept as is in the data header staging.",
          },
          DataType: {
            type: "string",
            title: "Data Type",
            description: "SQL Server Data type for the column.",
          },
          AllowNulls: {
            type: "boolean",
            title: "Allow Nulls",
            description: "If false, the column will be non-nullable.",
          },
          FixedValue: {
            title: "Fixed Value",
            description: "Assign a constant value to a column.",
            default: "",
          },
          XMLTag: {
            type: "string",
            title: "XML Tag",
            description: "XML path for the column",
          },
          RepeatingGroup: {
            type: "string",
            title: "Repeating Group",
            description: "Repeating group withtin XML path for the column",
          },

          Attributes: {
            type: "object",
            title: "Attributes",
            description: "XML path for the column",
          },
        },
        dependencies: {
          XMLTag: {
            oneOf: [
              {
                properties: {
                  XMLTag: {
                    type: "string",
                    minLength: 1,
                  },
                  Attributes: {
                    type: "object",
                    title: "Attributes",
                    additionalProperties: {
                      type: "string",
                    },
                  },
                },
                required: ["XMLTag"],
              },
              {
                not: {
                  required: ["XMLTag"],
                },
              },
            ],
          },
        },
      },
    },
  },
};

export const importSchema = {
  type: "object",
  required: ["SourceType"],
  properties: {
    SourceType: {
      type: "string",
      title: "Source Type",
      enum: ["Json", "Excel", "Database", "Csv", "XML"],
      description: "Format of the input data.",
      default: "Json",
    },
    IgnoreDataSetsWithEmptyBusinessKeys: {
      type: "boolean",
      title: "Ignore Data Sets with Empty Business Keys",
      description: "Filter out rows with empty business keys if true.",
    },
    UpdateDateColumnName: {
      type: "string",
      title: "Update Date Column Name",
      description: "Name of a date or datetime column used for delta sync.",
    },
    UpdateDateColumnDateType: {
      type: "string",
      title: "Update Date Column Type",
      enum: ["INT", "ISO8601", "UnixTimestampMilliseconds", "TROWVERSION"],
      description: "Type of a date or datetime column used for delta sync.",
      default: "INT",
    },
    TrimHeader: {
      type: "boolean",
      title: "Trim Header",
      description: "Remove trailing spaces from header/field names if true.",
    },
    ReplaceSpaces: {
      type: "boolean",
      title: "Replace Spaces",
      description:
        "Replace spaces in header/field names with underscores if true.",
    },
    SourceInfo: { type: "object", properties: {} },
    DestinationInfo: {
      type: "object",
      properties: {
        TableName: {
          type: "string",
          title: "Source Table Name",
          description: "Name of the source table in the database.",
        },
        TruncateSourceTable: {
          type: "boolean",
          title: "Truncate Source Table",
          description: "Truncate the source table before loading data.",
        },
      },
    },

    JsonConfiguration: {
      type: "object",
      properties: {
        JsonApiLinking: {
          type: "object",
          title: "JSON API Linking",
          properties: {
            JsonPathForNextUrl: {
              type: "string",
              title: "JSON Path for Next URL",
            },
          },
        },
        Engine: {
          type: "string",
          title: "Extraction Engine",
          description:
            "Engine used for extracting data from the json response. v1 is the original engine, v2 is the new one with improved performance and features.",
          enum: ["v1", "v2"],
          default: "v1",
        },
        JsonPathMappings: {
          type: "array",
          title: "JSON Path Mappings",
          items: {
            type: "object",
            properties: {
              SearchPropertyName: {
                type: "string",
                title: "Search Property Name",
              },
              JsonPath: { type: "string", title: "JSON Path" },
              OutputPropertyName: {
                type: "string",
                title: "Output Property Name",
              },
              ReQueryJsonPathOutput: {
                type: "array",
                title: "ReQuery JSON Path Output",
                items: {
                  type: "object",
                  properties: {
                    JsonPath: { type: "string", title: "JSON Path" },
                    OutputPropertyName: {
                      type: "string",
                      title: "Output Property Name",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const getSourceInfoSchema = (sourceType) => {
  switch (sourceType) {
    case "Json":
      return {
        type: "object",
        properties: {
          RequestTester: {
            type: "string",
            title: "Request Tester",
          },
          Url: {
            type: "string",
            title: "URL",
            description: "The URL of the data source.",
          },

          AuthenticationMethod: {
            type: "string",
            title: "Authentication Method",
            enum: ["Auth0", "Bearer Token"],
            default: "Auth0",
          },
          // Other base properties
          Pagination: {
            type: "object",
            properties: {
              UsePagination: { type: "boolean", title: "Use Pagination" },
              BatchSize: { type: "integer", title: "Batch Size" },
              PageOffset: { type: "integer", title: "Page Offset" },
            },
          },
          NextValue: {
            type: "object",
            properties: {
              UseNextValue: { type: "boolean", title: "Use Next Value" },
              Size: { type: "integer", title: "Size" },
            },
          },
          RequestMessage: {
            type: "object",
            properties: {
              RequestMethod: { type: "string", title: "Request Method" },
              ContentFromFile: { type: "string", title: "Content From File" },
              ContentType: { type: "string", title: "Content Type" },
            },
          },
          AdditionalHeadder: {
            type: "array",
            title: "Additional Header",
            items: {
              type: "object",
              properties: {
                key: { type: "string", title: "Key" },
                value: { type: "string", title: "Value" },
              },
            },
          },
        },
        allOf: [
          {
            if: {
              properties: { AuthenticationMethod: { const: "Auth0" } },
            },
            then: {
              properties: {
                Auth0: {
                  type: "object",
                  required: ["Uri", "AppId", "Password", "Audience"],
                  properties: {
                    Uri: { type: "string", title: "Auth0 URI" },
                    Audience: { type: "string", title: "Auth0 Audience" },
                    AppId: { type: "string", title: "Auth0 App ID" },
                    Password: { type: "string", title: "Auth0 Password" },
                  },
                },
              },
              required: ["Auth0"],
            },
          },
          {
            if: {
              properties: { AuthenticationMethod: { const: "Bearer Token" } },
            },
            then: {
              properties: {
                BearerToken: {
                  type: "object",
                  required: ["Token"],
                  properties: {
                    Token: { type: "string", title: "Bearer Token" },
                  },
                },
              },
              required: ["BearerToken"],
            },
          },
        ],
      };
    case "Csv":
    case "Excel":
      return {
        type: "object",
        required: ["Url"],
        properties: {
          Url: {
            type: "string",
            title: "URL",
            description: "The URL of the data source.",
          },
          ExcelSheetName: {
            type: "string",
            title: "Excel Sheet Name",
            description: "The name of the sheet in the Excel file.",
          },
          IsTransposed: {
            type: "boolean",
            title: "Is Transposed",
            description: "If true, the data is transposed.",
          },
          ExcelRange: {
            type: "object",
            properties: {
              StartColumn: {
                type: "string",
                title: "Start Column",
                description: "The starting column of the range.",
              },
              EndColumn: {
                type: "string",
                title: "End Column",
                description: "The ending column of the range.",
              },
              StartRow: {
                type: "string",
                title: "Start Row",
                description: "The starting row of the range.",
              },
              EndRow: {
                type: "string",
                title: "End Row",
                description: "The ending row of the range.",
              },
              HeaderRow: {
                type: "string",
                title: "Header Row",
                description: "The row number of the header.",
              },
            },
          },
        },
      };

    case "XML":
      return {
        type: "object",
        required: ["Url"],
        properties: {
          Url: {
            type: "string",
            title: "URL",
            description: "The URL of the data source.",
          },
          RootTag: {
            type: "string",
            title: "Root Tag",
            description: "The root tag you want to search within.",
          },
          RecordTag: {
            type: "string",
            title: "Record Tag",
            description: "The root tag that you want to collect from.",
          },
        },
      };

    case "Database":
      return {
        type: "object",
        required: ["DatabaseType"],
        properties: {
          DatabaseType: {
            type: "string",
            title: "Database Type",
            enum: ["SqlServer", "MySql", "Postgres"],
            description: "Type of the source database.",
          },
          ConnectionString: {
            type: "string",
            title: "Connection String",
            description: "The connection string to the database.",
          },
          TableName: {
            type: "string",
            title: "Table Name",
            description: "Table name in the source database.",
          },
          SqlQuery: {
            type: "string",
            title: "SQL Query",
            description: "SQL query used to retrieve the data.",
          },
        },
      };
    default:
      return { type: "object", properties: {} };
  }
};
