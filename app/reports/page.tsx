'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Paper, Typography, Card, CardContent, Stack, LinearProgress,
    Alert, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    useTheme, useMediaQuery
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Speed as SpeedIcon,
    Inventory as InventoryIcon,
    LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs } from '@/components';
import toast from 'react-hot-toast';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import dayjs from 'dayjs';
import api from '@/lib/api';

const COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

export default function ReportsPage() {
    useRoleGuard(['admin', 'manager']);

    const { activeWarehouse } = useWarehouse();
    const [user, setUser] = useState<any>(null);
    const [selectedTab, setSelectedTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Analytics data state
    const [trendData, setTrendData] = useState<any[]>([]);
    const [qcAnalysis, setQcAnalysis] = useState<any[]>([]);
    const [userPerformance, setUserPerformance] = useState<any[]>([]);
    const [brandPerformance, setBrandPerformance] = useState<any[]>([]);
    const [exceptionReports, setExceptionReports] = useState<any>({
        stuckInbound: [],
        qcFailed: [],
        slowMoving: []
    });

    useEffect(() => {
        const storedUser = getStoredUser();
        if (!storedUser) {
            window.location.href = '/login';
            return;
        }
        setUser(storedUser);
    }, []);

    useEffect(() => {
        if (activeWarehouse?.id) {
            loadAnalyticsData();
        }
    }, [activeWarehouse?.id, selectedTab]);

    const loadAnalyticsData = useCallback(async () => {
        if (!activeWarehouse?.id) return;

        setLoading(true);
        try {
            if (selectedTab === 0) {
                // Analytics Dashboard
                const [trends, qc] = await Promise.all([
                    api.get(`/reports/trend-analysis?warehouse_id=${activeWarehouse.id}`),
                    api.get(`/reports/qc-analysis?warehouse_id=${activeWarehouse.id}`)
                ]);
                setTrendData(trends.data.trends || []);
                setQcAnalysis(qc.data.qcAnalysis || []);
            } else if (selectedTab === 1) {
                // Performance Reports
                const perf = await api.get(`/reports/performance-metrics?warehouse_id=${activeWarehouse.id}`);
                setUserPerformance(perf.data.userPerformance || []);
                setBrandPerformance(perf.data.brandPerformance || []);
            } else if (selectedTab === 2) {
                // Exception Reports
                const exceptions = await api.get(`/reports/exception-reports?warehouse_id=${activeWarehouse.id}`);
                setExceptionReports(exceptions.data);
            }
        } catch (error: any) {
            console.error('Error loading analytics:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Failed to load analytics data';
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, [activeWarehouse?.id, selectedTab]);

    // Calculate KPIs from trend data
    const kpis = useMemo(() => {
        if (!trendData.length) return null;

        const last7Days = trendData.slice(-7);
        const prev7Days = trendData.slice(-14, -7);

        const sumField = (arr: any[], field: string) =>
            arr.reduce((sum, item) => sum + (parseInt(item[field]) || 0), 0);

        const lastWeekInbound = sumField(last7Days, 'inbound');
        const prevWeekInbound = sumField(prev7Days, 'inbound');
        const inboundChange = prevWeekInbound ? ((lastWeekInbound - prevWeekInbound) / prevWeekInbound * 100) : 0;

        const lastWeekOutbound = sumField(last7Days, 'outbound');
        const prevWeekOutbound = sumField(prev7Days, 'outbound');
        const outboundChange = prevWeekOutbound ? ((lastWeekOutbound - prevWeekOutbound) / prevWeekOutbound * 100) : 0;

        const lastWeekQC = sumField(last7Days, 'qc');
        const prevWeekQC = sumField(prev7Days, 'qc');
        const qcChange = prevWeekQC ? ((lastWeekQC - prevWeekQC) / prevWeekQC * 100) : 0;

        return {
            inbound: { value: lastWeekInbound, change: inboundChange },
            outbound: { value: lastWeekOutbound, change: outboundChange },
            qc: { value: lastWeekQC, change: qcChange },
            picking: { value: sumField(last7Days, 'picking'), change: 0 }
        };
    }, [trendData]);

    // Render Analytics Dashboard
    const renderAnalyticsDashboard = () => (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            {/* KPI Cards */}
            {kpis && (
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                    gap: { xs: 1, md: 1.5 },
                    mb: { xs: 2, md: 2.5 }
                }}>
                    <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
                            <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', md: '0.75rem' }, display: 'block', mb: 0.5 }}>
                                Inbound (7 Days)
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, mb: 0.5 }}>
                                {kpis.inbound.value}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                {kpis.inbound.change >= 0 ?
                                    <TrendingUpIcon sx={{ fontSize: { xs: 12, md: 16 } }} /> :
                                    <TrendingDownIcon sx={{ fontSize: { xs: 12, md: 16 } }} />
                                }
                                <Typography variant="caption" sx={{ fontSize: { xs: '0.6rem', md: '0.7rem' } }}>
                                    {Math.abs(kpis.inbound.change).toFixed(1)}%
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>

                    <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                        <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
                            <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', md: '0.75rem' }, display: 'block', mb: 0.5 }}>
                                QC (7 Days)
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, mb: 0.5 }}>
                                {kpis.qc.value}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                {kpis.qc.change >= 0 ?
                                    <TrendingUpIcon sx={{ fontSize: { xs: 12, md: 16 } }} /> :
                                    <TrendingDownIcon sx={{ fontSize: { xs: 12, md: 16 } }} />
                                }
                                <Typography variant="caption" sx={{ fontSize: { xs: '0.6rem', md: '0.7rem' } }}>
                                    {Math.abs(kpis.qc.change).toFixed(1)}%
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>

                    <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                        <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
                            <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', md: '0.75rem' }, display: 'block', mb: 0.5 }}>
                                Picking (7 Days)
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, mb: 0.5 }}>
                                {kpis.picking.value}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <SpeedIcon sx={{ fontSize: { xs: 12, md: 16 } }} />
                                <Typography variant="caption" sx={{ fontSize: { xs: '0.6rem', md: '0.7rem' } }}>
                                    Active
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>

                    <Card sx={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
                        <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
                            <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', md: '0.75rem' }, display: 'block', mb: 0.5 }}>
                                Outbound (7 Days)
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, mb: 0.5 }}>
                                {kpis.outbound.value}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                {kpis.outbound.change >= 0 ?
                                    <TrendingUpIcon sx={{ fontSize: { xs: 12, md: 16 } }} /> :
                                    <TrendingDownIcon sx={{ fontSize: { xs: 12, md: 16 } }} />
                                }
                                <Typography variant="caption" sx={{ fontSize: { xs: '0.6rem', md: '0.7rem' } }}>
                                    {Math.abs(kpis.outbound.change).toFixed(1)}%
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* Trend Chart */}
            <Paper sx={{ p: { xs: 1, md: 2 }, mb: { xs: 2, md: 3 } }}>
                <Typography variant="h6" sx={{ mb: { xs: 1, md: 2 }, fontWeight: 600, fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                    📈 30-Day Operations Trend
                </Typography>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
                    <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) => dayjs(date).format(isMobile ? 'DD' : 'MMM DD')}
                            fontSize={isMobile ? 10 : 12}
                        />
                        <YAxis fontSize={isMobile ? 10 : 12} />
                        <Tooltip
                            labelFormatter={(date) => dayjs(date).format('MMM DD, YYYY')}
                        />
                        <Legend wrapperStyle={{ fontSize: isMobile ? '11px' : '14px' }} />
                        <Line type="monotone" dataKey="inbound" stroke="#667eea" strokeWidth={isMobile ? 1.5 : 2} name="Inbound" />
                        <Line type="monotone" dataKey="qc" stroke="#f093fb" strokeWidth={isMobile ? 1.5 : 2} name="QC" />
                        <Line type="monotone" dataKey="picking" stroke="#4facfe" strokeWidth={isMobile ? 1.5 : 2} name="Picking" />
                        <Line type="monotone" dataKey="outbound" stroke="#43e97b" strokeWidth={isMobile ? 1.5 : 2} name="Outbound" />
                    </LineChart>
                </ResponsiveContainer>
            </Paper>

            {/* QC Analysis */}
            <Paper sx={{ p: { xs: 1, md: 2 } }}>
                <Typography variant="h6" sx={{ mb: { xs: 1, md: 2 }, fontWeight: 600, fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                    ✅ QC Status Distribution
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 1, md: 2 } }}>
                    <ResponsiveContainer width="100%" height={isMobile ? 180 : 250}>
                        <PieChart>
                            <Pie
                                data={qcAnalysis}
                                dataKey="count"
                                nameKey="qc_status"
                                cx="50%"
                                cy="50%"
                                outerRadius={isMobile ? 60 : 80}
                                label
                            >
                                {qcAnalysis.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>

                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
                            QC Summary
                        </Typography>
                        {qcAnalysis.map((item, idx) => (
                            <Stack key={idx} direction="row" justifyContent="space-between" sx={{ mb: { xs: 0.5, md: 1 } }}>
                                <Chip
                                    label={`${item.qc_status} (${item.qc_grade || 'N/A'})`}
                                    size="small"
                                    sx={{
                                        bgcolor: COLORS[idx % COLORS.length],
                                        color: 'white',
                                        fontSize: { xs: '0.65rem', md: '0.8125rem' },
                                        height: { xs: 20, md: 24 }
                                    }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                                    {item.count} items
                                </Typography>
                            </Stack>
                        ))}
                    </Box>
                </Box>
            </Paper>
        </Box>
    );

    // Render Performance Reports
    const renderPerformanceReports = () => (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            {/* User Performance */}
            <Paper sx={{ p: { xs: 1, md: 2 }, mb: { xs: 2, md: 3 } }}>
                <Typography variant="h6" sx={{ mb: { xs: 1, md: 2 }, fontWeight: 600, fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                    👥 User Performance (Top 20)
                </Typography>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
                    <BarChart data={userPerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="user_name"
                            angle={-45}
                            textAnchor="end"
                            height={isMobile ? 80 : 100}
                            fontSize={isMobile ? 9 : 11}
                        />
                        <YAxis fontSize={isMobile ? 10 : 12} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }} />
                        <Bar dataKey="inbound" fill="#667eea" name="Inbound" />
                        <Bar dataKey="qc" fill="#f093fb" name="QC" />
                        <Bar dataKey="picking" fill="#4facfe" name="Picking" />
                    </BarChart>
                </ResponsiveContainer>

                <TableContainer sx={{ mt: { xs: 1, md: 2 }, maxHeight: isMobile ? 250 : 400 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    User
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    Inbound
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    QC
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    Picking
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    Total
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {userPerformance.map((row, idx) => (
                                <TableRow key={idx} hover>
                                    <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.user_name}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.inbound}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.qc}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.picking}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.total}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Brand Performance */}
            <Paper sx={{ p: { xs: 1, md: 2 } }}>
                <Typography variant="h6" sx={{ mb: { xs: 1, md: 2 }, fontWeight: 600, fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                    🏷️ Brand Performance (Top 20)
                </Typography>
                <TableContainer sx={{ maxHeight: isMobile ? 300 : 400 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    Brand
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    Total
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    Dispatched
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    Rate
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                    Avg Days
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {brandPerformance.map((row, idx) => (
                                <TableRow key={idx} hover>
                                    <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.brand}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.total_items}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.dispatched_items}
                                    </TableCell>
                                    <TableCell align="right" sx={{ p: { xs: 0.5, md: 2 } }}>
                                        <Chip
                                            label={`${row.dispatch_rate}%`}
                                            size="small"
                                            color={parseFloat(row.dispatch_rate) > 50 ? 'success' : 'warning'}
                                            sx={{ fontSize: { xs: '0.65rem', md: '0.8125rem' }, height: { xs: 18, md: 24 } }}
                                        />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        {row.avg_days}d
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );

    // Render Exception Reports
    const renderExceptionReports = () => (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            {/* Summary Cards */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                gap: { xs: 1, md: 2 },
                mb: { xs: 2, md: 3 }
            }}>
                <Card>
                    <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                        <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 2 }}>
                            <WarningIcon sx={{ fontSize: { xs: 32, md: 40 }, color: '#f59e0b' }} />
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                                    {exceptionReports.stuckInbound?.length || 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                                    Stuck in Inbound
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                        <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 2 }}>
                            <ErrorIcon sx={{ fontSize: { xs: 32, md: 40 }, color: '#ef4444' }} />
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                                    {exceptionReports.qcFailed?.length || 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                                    QC Failed
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                        <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 2 }}>
                            <InventoryIcon sx={{ fontSize: { xs: 32, md: 40 }, color: '#6366f1' }} />
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                                    {exceptionReports.slowMoving?.length || 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                                    Slow Moving
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>

            {/* Stuck in Inbound */}
            <Paper sx={{ p: { xs: 1, md: 2 }, mb: { xs: 2, md: 3 } }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: { xs: 1, md: 2 } }}>
                    <WarningIcon sx={{ color: '#f59e0b', fontSize: { xs: 18, md: 24 } }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                        Stuck in Inbound (&gt; 7 Days)
                    </Typography>
                </Stack>
                {exceptionReports.stuckInbound?.length > 0 ? (
                    <TableContainer sx={{ maxHeight: isMobile ? 200 : 300 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        WSN
                                    </TableCell>
                                    {!isMobile && (
                                        <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            Product
                                        </TableCell>
                                    )}
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Brand
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Date
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Days
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {exceptionReports.stuckInbound.map((row: any, idx: number) => (
                                    <TableRow key={idx} hover>
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {row.wsn}
                                        </TableCell>
                                        {!isMobile && (
                                            <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                                {row.product_title}
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {row.brand}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {dayjs(row.inbound_date).format(isMobile ? 'DD/MM' : 'DD-MMM-YY')}
                                        </TableCell>
                                        <TableCell align="right" sx={{ p: { xs: 0.5, md: 2 } }}>
                                            <Chip
                                                label={`${row.days_stuck}d`}
                                                size="small"
                                                color="warning"
                                                sx={{ fontSize: { xs: '0.65rem', md: '0.8125rem' }, height: { xs: 18, md: 24 } }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Alert severity="success" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                        No items stuck in inbound! 🎉
                    </Alert>
                )}
            </Paper>

            {/* QC Failed */}
            <Paper sx={{ p: { xs: 1, md: 2 }, mb: { xs: 2, md: 3 } }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: { xs: 1, md: 2 } }}>
                    <ErrorIcon sx={{ color: '#ef4444', fontSize: { xs: 18, md: 24 } }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                        QC Failed Items
                    </Typography>
                </Stack>
                {exceptionReports.qcFailed?.length > 0 ? (
                    <TableContainer sx={{ maxHeight: isMobile ? 200 : 300 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        WSN
                                    </TableCell>
                                    {!isMobile && (
                                        <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            Product
                                        </TableCell>
                                    )}
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Brand
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Date
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Grade
                                    </TableCell>
                                    {!isMobile && (
                                        <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            Remarks
                                        </TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {exceptionReports.qcFailed.map((row: any, idx: number) => (
                                    <TableRow key={idx} hover>
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {row.wsn}
                                        </TableCell>
                                        {!isMobile && (
                                            <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                                {row.product_title}
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {row.brand}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {dayjs(row.qc_date).format(isMobile ? 'DD/MM' : 'DD-MMM-YY')}
                                        </TableCell>
                                        <TableCell sx={{ p: { xs: 0.5, md: 2 } }}>
                                            <Chip
                                                label={row.qc_grade}
                                                size="small"
                                                color="error"
                                                sx={{ fontSize: { xs: '0.65rem', md: '0.8125rem' }, height: { xs: 18, md: 24 } }}
                                            />
                                        </TableCell>
                                        {!isMobile && (
                                            <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                                {row.qc_remarks}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Alert severity="success" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                        No QC failures! 🎉
                    </Alert>
                )}
            </Paper>

            {/* Slow Moving */}
            <Paper sx={{ p: { xs: 1, md: 2 } }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: { xs: 1, md: 2 } }}>
                    <InventoryIcon sx={{ color: '#6366f1', fontSize: { xs: 18, md: 24 } }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', md: '1.25rem' } }}>
                        Slow Moving Inventory (&gt; 30 Days)
                    </Typography>
                </Stack>
                {exceptionReports.slowMoving?.length > 0 ? (
                    <TableContainer sx={{ maxHeight: isMobile ? 200 : 300 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        WSN
                                    </TableCell>
                                    {!isMobile && (
                                        <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            Product
                                        </TableCell>
                                    )}
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Brand
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Date
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                        Days
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {exceptionReports.slowMoving.map((row: any, idx: number) => (
                                    <TableRow key={idx} hover>
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {row.wsn}
                                        </TableCell>
                                        {!isMobile && (
                                            <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                                {row.product_title}
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {row.brand}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: 0.5, md: 2 } }}>
                                            {dayjs(row.inbound_date).format(isMobile ? 'DD/MM' : 'DD-MMM-YY')}
                                        </TableCell>
                                        <TableCell align="right" sx={{ p: { xs: 0.5, md: 2 } }}>
                                            <Chip
                                                label={`${row.days_in_warehouse}d`}
                                                size="small"
                                                color={row.days_in_warehouse > 60 ? 'error' : 'warning'}
                                                sx={{ fontSize: { xs: '0.65rem', md: '0.8125rem' }, height: { xs: 18, md: 24 } }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Alert severity="success" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                        No slow moving inventory! 🎉
                    </Alert>
                )}
            </Paper>
        </Box>
    );

    const tabs = [
        '📊 Analytics Dashboard',
        '📈 Performance Reports',
        '⚠️ Exception Reports'
    ];

    return (
        <AppLayout>
            <Box sx={{
                p: { xs: 0.75, md: 1 },
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {loading && (
                    <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2000 }} />
                )}

                <StandardPageHeader
                    title="Reports & Analytics"
                    subtitle={`${activeWarehouse?.name || 'Select Warehouse'} - Business Intelligence`}
                    icon="📊"
                    warehouseName={activeWarehouse?.name}
                    userName={user?.full_name}
                />

                <StandardTabs
                    tabs={tabs}
                    value={selectedTab}
                    onChange={(_, newValue) => setSelectedTab(newValue)}
                />

                <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#f5f5f5', py: { xs: 2, sm: 3 } }}>
                    {!activeWarehouse ? (
                        <Box sx={{ p: 3 }}>
                            <Alert severity="warning">Please select a warehouse to view reports</Alert>
                        </Box>
                    ) : (
                        <>
                            {selectedTab === 0 && renderAnalyticsDashboard()}
                            {selectedTab === 1 && renderPerformanceReports()}
                            {selectedTab === 2 && renderExceptionReports()}
                        </>
                    )}
                </Box>
            </Box>
        </AppLayout>
    );
}
