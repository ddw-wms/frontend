// File: components/StandardTable.tsx
// Standardized table component for consistency across all pages
import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TablePagination,
    Skeleton,
    Box,
    Typography,
    useTheme,
    useMediaQuery,
} from '@mui/material';

interface Column {
    id: string;
    label: string;
    minWidth?: number;
    align?: 'left' | 'right' | 'center';
    format?: (value: any) => string | React.ReactNode;
}

interface StandardTableProps {
    columns: Column[];
    data: any[];
    loading?: boolean;
    page?: number;
    rowsPerPage?: number;
    totalCount?: number;
    onPageChange?: (newPage: number) => void;
    onRowsPerPageChange?: (rowsPerPage: number) => void;
    onRowClick?: (row: any) => void;
    minHeight?: string | number;
    maxHeight?: string | number;
    stickyHeader?: boolean;
    emptyMessage?: string;
    dense?: boolean;
}

export const StandardTable: React.FC<StandardTableProps> = ({
    columns,
    data,
    loading = false,
    page = 0,
    rowsPerPage = 10,
    totalCount,
    onPageChange,
    onRowsPerPageChange,
    onRowClick,
    minHeight = '400px',
    maxHeight = 'calc(100vh - 300px)',
    stickyHeader = true,
    emptyMessage = 'No data available',
    dense = false,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleChangePage = (event: unknown, newPage: number) => {
        onPageChange?.(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        onRowsPerPageChange?.(parseInt(event.target.value, 10));
        onPageChange?.(0);
    };

    return (
        <Paper
            elevation={2}
            sx={{
                width: '100%',
                overflow: 'hidden',
                borderRadius: 2,
            }}
        >
            <TableContainer
                sx={{
                    minHeight,
                    maxHeight,
                    '&::-webkit-scrollbar': {
                        width: '8px',
                        height: '8px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderRadius: '4px',
                    },
                }}
            >
                <Table stickyHeader={stickyHeader} size={dense || isMobile ? 'small' : 'medium'}>
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    align={column.align || 'left'}
                                    style={{
                                        minWidth: column.minWidth,
                                        fontWeight: 700,
                                    }}
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                                        py: isMobile ? 1 : 1.5,
                                    }}
                                >
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            // Loading skeleton
                            Array.from({ length: rowsPerPage }).map((_, index) => (
                                <TableRow key={index}>
                                    {columns.map((column) => (
                                        <TableCell key={column.id}>
                                            <Skeleton animation="wave" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : data.length === 0 ? (
                            // Empty state
                            <TableRow>
                                <TableCell colSpan={columns.length} align="center">
                                    <Box sx={{ py: 4 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {emptyMessage}
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            // Data rows
                            data.map((row, index) => (
                                <TableRow
                                    hover
                                    key={index}
                                    onClick={() => onRowClick?.(row)}
                                    sx={{
                                        cursor: onRowClick ? 'pointer' : 'default',
                                        '&:nth-of-type(odd)': {
                                            bgcolor: 'action.hover',
                                        },
                                        transition: 'background-color 0.2s ease',
                                    }}
                                >
                                    {columns.map((column) => {
                                        const value = row[column.id];
                                        return (
                                            <TableCell
                                                key={column.id}
                                                align={column.align || 'left'}
                                                sx={{
                                                    fontSize: isMobile ? '0.75rem' : '0.8125rem',
                                                    py: isMobile ? 0.75 : 1.25,
                                                }}
                                            >
                                                {column.format ? column.format(value) : value || '-'}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {onPageChange && (
                <TablePagination
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    component="div"
                    count={totalCount || data.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                            fontSize: isMobile ? '0.75rem' : '0.875rem',
                        },
                    }}
                />
            )}
        </Paper>
    );
};

export default StandardTable;
