'use client';

import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Checkbox, Button, AppBar, Toolbar, Grid,
  Card, CardContent, Stack
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';

const PERMISSIONS = [
  'view_dashboard',
  'view_inbound',
  'create_inbound',
  'edit_inbound',
  'delete_inbound',
  'view_qc',
  'create_qc',
  'approve_qc',
  'view_outbound',
  'create_outbound',
  'view_picking',
  'create_picking',
  'view_reports',
  'export_reports',
  'view_master_data',
  'edit_master_data',
  'manage_users',
  'manage_warehouses',
  'manage_printers',
  'manage_permissions'
];

const ROLES = ['admin', 'manager', 'operator', 'qc', 'picker'];

export default function RolePermissionsPage() {
  const [permissions, setPermissions] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize permissions matrix
    const initial: any = {};
    ROLES.forEach(role => {
      initial[role] = {};
      PERMISSIONS.forEach(perm => {
        // Default permissions based on role
        if (role === 'admin') {
          initial[role][perm] = true;
        } else if (role === 'manager') {
          initial[role][perm] = !perm.includes('manage_');
        } else {
          initial[role][perm] = perm.includes(role) || perm === 'view_dashboard';
        }
      });
    });
    setPermissions(initial);
  }, []);

  const handleToggle = (role: string, permission: string) => {
    setPermissions((prev: { [x: string]: { [x: string]: any; }; }) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: !prev[role][permission]
      }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save to backend (mock for now)
      toast.success('✓ Permissions saved successfully');
      // In production: await api.call to save permissions
    } catch (e) {
      toast.error('Failed to save permissions');
    } finally {
      setLoading(false);
    }
  };

  const getPermissionLabel = (perm: string) => {
    return perm
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <AppLayout>
      <Toaster position="top-center" />
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
            🔐 Role Permissions Management
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<SaveIcon />} 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Permissions'}
          </Button>
        </Toolbar>
      </AppBar>

      <Paper sx={{ m: 3, p: 3 }}>
                {/* Permission Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 3 }}>
          {ROLES.map(role => {
            const enabled = Object.values(permissions[role] || {}).filter(Boolean).length;
            return (
              <Card key={role}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="text.secondary" gutterBottom sx={{ textTransform: 'capitalize' }}>
                    {role}
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary.main">
                    {enabled}/{PERMISSIONS.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    permissions enabled
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        {/* Permissions Matrix */}
        <Box sx={{ overflowX: 'auto' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx= {{fontWeight:"bold", minWidth: 200 }}>Permission</TableCell>
                  {ROLES.map(role => (
                    <TableCell key={role} sx= {{fontWeight:"bold" ,align:"center" , textTransform: 'capitalize' }}>
                      {role}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {PERMISSIONS.map((perm, idx) => (
                  <TableRow key={perm} sx={{ bgcolor: idx % 2 === 0 ? 'transparent' : '#f9f9f9' }}>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {getPermissionLabel(perm)}
                    </TableCell>
                    {ROLES.map(role => (
                      <TableCell key={`${role}-${perm}`} align="center">
                        <Checkbox
                          size="small"
                          checked={permissions[role]?.[perm] || false}
                          onChange={() => handleToggle(role, perm)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>
    </AppLayout>
  );
}
