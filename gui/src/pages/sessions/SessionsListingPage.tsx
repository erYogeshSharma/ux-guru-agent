import { useGetSessionsListQuery } from "@/app/services/session.service";
import { useState } from "react";
import { DataGrid, GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { Box, Typography, Chip, useTheme } from "@mui/material";
import { Session } from "@/@types/session";
import moment from "moment";
import {
  renderBrowserIcon,
  getBrowserFromUserAgent,
  renderOSIcon,
} from "@/utils/BrowserIcon";
import { useNavigate } from "react-router-dom";

const SessionsListingPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const { data, isLoading, isError, error } = useGetSessionsListQuery({
    page: paginationModel.page + 1,
    limit: paginationModel.pageSize,
  });

  const columns: GridColDef[] = [
    {
      field: "url",
      headerName: "URL",
      flex: 0.5,
      headerAlign: "left",
      align: "left",
      valueGetter: (_, row: Session) => row.metadata.url,
      renderCell: (params) => (
        <Typography
          variant="body2"
          noWrap
          title={params.value}
          sx={{ maxWidth: "100%" }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "isActive",
      headerName: "Status",
      width: 100,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "default"}
          size="small"
        />
      ),
    },
    {
      field: "eventCount",
      headerName: "Events",
      width: 80,
      type: "number",
      headerAlign: "center",
      align: "center",
    },
    {
      field: "errorCount",
      headerName: "Errors",
      width: 80,
      type: "number",
      headerAlign: "center",
      align: "center",
    },
    {
      field: "userAgent",
      headerName: "Browser",
      flex: 0.2,
      headerAlign: "center",
      align: "center",
      valueGetter: (_, row: Session) => {
        const ua = row.metadata.userAgent || "";
        return getBrowserFromUserAgent(ua);
      },
      renderCell: (params) => (
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 1,
            justifyContent: "center",
          }}
        >
          {renderOSIcon(params.row.metadata.userAgent)}
          {renderBrowserIcon(params.row.metadata.userAgent)}
          <Typography variant="body2" title={params.row.metadata.userAgent}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "viewport",
      headerName: "Viewport",
      width: 120,
      headerAlign: "center",
      align: "center",
      valueGetter: (_, row: Session) =>
        `${row.metadata.viewport.width}×${row.metadata.viewport.height}`,
    },
    {
      field: "createdAt",
      headerName: "Created",
      width: 180,
      headerAlign: "center",
      align: "center",
      valueGetter: (value) =>
        value ? moment(value).format("YYYY-MM-DD HH:mm") : "",
    },
    {
      field: "endedAt",
      headerName: "Ended",
      width: 180,
      headerAlign: "center",
      align: "center",
      valueGetter: (value) =>
        value ? moment(value).format("YYYY-MM-DD HH:mm") : "",
    },
  ];

  const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === "object" && "message" in error) {
      return String((error as any).message);
    }
    if (error && typeof error === "object" && "data" in error) {
      return String((error as any).data);
    }
    if (error && typeof error === "object" && "status" in error) {
      return `Error ${(error as any).status}`;
    }
    return "Unknown error";
  };

  if (isError) {
    return (
      <Box p={2}>
        <Typography color="error">
          Error loading sessions: {getErrorMessage(error)}
        </Typography>
      </Box>
    );
  }

  const rows = data?.data || [];
  const rowCount = data?.total || 0;

  return (
    <Box
      sx={{
        width: "100%",
      }}
    >
      <Typography variant="h5" component="h1" gutterBottom>
        Sessions Listing
      </Typography>

      <DataGrid
        rows={rows}
        columns={columns}
        loading={isLoading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        paginationMode="server"
        rowCount={rowCount}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        pagination
        density="compact"
        onRowClick={(params) => {
          navigate(`/session/${params.row.id}`);
        }}
        sx={{
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          "& .MuiDataGrid-cell": {
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
          "& .MuiDataGrid-row:hover": {
            backgroundColor: theme.palette.action.hover,
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.background.default,
            fontWeight: "600",
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: `1px solid ${theme.palette.divider}`,
          },
        }}
      />
    </Box>
  );
};

export default SessionsListingPage;
