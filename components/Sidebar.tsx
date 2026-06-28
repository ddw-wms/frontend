// File Path = warehouse-frontend\components\Sidebar.tsx
"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Typography,
  Box,
  IconButton,
  Paper,
  Tooltip,
  iconButtonClasses,
  CircularProgress,
  Snackbar,
  Alert,
  Portal,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExpandLess,
  ExpandMore,
  Close as CloseIcon,
  Label,
} from "@mui/icons-material";

import {
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckIcon,
  LocalShipping as ShippingIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Warehouse as WarehouseIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  LocalPrintshop as PrinterIcon,
  Menu as MenuIcon,
  Assessment as ReportsIcon,
  AdminPanelSettings as PermissionsIcon,
  Group as GroupIcon,
  Logout as LogoutIcon,
  BugReport as ErrorLogsIcon,
  Palette as AppearanceIcon,
  ViewSidebar as SidebarIcon,
  UnfoldMore as ExpandIcon,
  Block as RejectionsIcon,
  UnfoldLess as CollapseIcon,
  TouchApp as HoverIcon,
  Check as CheckMarkIcon,
  Layers as NLIcon,
  Description as DescriptionIcon,
  Warning as WarningIcon,
  ReceiptLong as BillingIcon,
} from "@mui/icons-material";
import { getStoredUser, logout } from "@/lib/auth";
import { usePermissions } from "@/app/context/PermissionContext";
import ConfirmDialog from "./ConfirmDialog";
import TypingTitle from "./TypingTitle";

// Module-level variable to persist sidebar scroll position across component remounts
// (Sidebar remounts on every page navigation because AppLayout is inside each page)
let savedSidebarScrollTop = 0;

interface SidebarProps {
  username?: string;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({
  mobileOpen = false,
  setMobileOpen,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Use Permission context
  const {
    canSeeMenu,
    isAdmin,
    isLoading: permissionsLoading,
  } = usePermissions();

  // Sidebar mode: 'expanded' | 'collapsed' | 'hover'
  const [sidebarMode, setSidebarMode] = useState<
    "expanded" | "collapsed" | "hover"
  >(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("sidebar-mode");
      if (savedMode === "collapsed" || savedMode === "hover") return savedMode;
      // Check legacy storage - if was collapsed, keep it collapsed
      const legacyCollapsed = localStorage.getItem("sidebar-collapsed");
      if (legacyCollapsed === "true") return "collapsed";
    }
    // Default to EXPANDED on first visit (desktop)
    return "expanded";
  });

  const [sidebarControlOpen, setSidebarControlOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Mobile detection state - declared early as it's used in collapsed computation
  const [isMobile, setIsMobile] = useState(false);

  // Debounce timer ref for hover state
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced hover handlers to prevent flickering
  const handleMouseEnter = useCallback(() => {
    if (sidebarMode !== "hover") return;
    // Clear any pending leave timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // Small delay before expanding to prevent accidental triggers
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(true);
    }, 50);
  }, [sidebarMode]);

  const handleMouseLeave = useCallback(() => {
    if (sidebarMode !== "hover") return;
    // Clear any pending enter timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // Longer delay before collapsing to prevent flicker during cursor movement
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 150);
  }, [sidebarMode]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Compute collapsed state from mode
  // IMPORTANT: On mobile, never use hover mode collapsed state - mobile sidebar should always be fully expanded when open
  const collapsed =
    !isMobile &&
    (sidebarMode === "collapsed" || (sidebarMode === "hover" && !isHovering));

  const [titlePulse, setTitlePulse] = useState(0);
  const prevCollapsedRef = useRef(collapsed);
  const prevMobileOpenRef = useRef(mobileOpen);

  useEffect(() => {
    if (prevCollapsedRef.current !== collapsed) {
      // animate only when expanded (collapsed === false)
      if (!collapsed) setTitlePulse((p) => p + 1);
      prevCollapsedRef.current = collapsed;
    }
  }, [collapsed]);

  useEffect(() => {
    if (prevMobileOpenRef.current !== mobileOpen) {
      // animate only when mobile drawer opens
      if (mobileOpen) setTitlePulse((p) => p + 1);
      prevMobileOpenRef.current = mobileOpen;
    }
  }, [mobileOpen]);

  // Legacy setter for compatibility
  const setCollapsed = (value: boolean) => {
    setSidebarMode(value ? "collapsed" : "expanded");
  };

  // Listen for appearance settings changes
  useEffect(() => {
    const handleAppearanceChange = (e: CustomEvent) => {
      const settings = e.detail;
      if (settings?.sidebarCompact !== undefined) {
        setCollapsed(settings.sidebarCompact);
      }
    };
    window.addEventListener(
      "appearanceSettingsChanged",
      handleAppearanceChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        "appearanceSettingsChanged",
        handleAppearanceChange as EventListener,
      );
    };
  }, []);

  // --------------------------------------
  // MOBILE DETECTION (SCREEN WIDTH)
  // --------------------------------------

  const checkMobile = useCallback(() => {
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      setIsMobile(width < 900);
    }
  }, []);

  useEffect(() => {
    checkMobile();
    window.addEventListener("resize", checkMobile);
    // Get user role
    const user = getStoredUser();
    if (user) {
      setUserRole(user.role || "");
      setUserName(user.fullName || user.username || "");
    }

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, [checkMobile]);

  const [settingsOpen, setSettingsOpen] = useState(() =>
    pathname.startsWith("/settings"),
  );

  const [nlOpen, setNlOpen] = useState(() => pathname.startsWith("/nl-"));

  const [flyoutVisible, setFlyoutVisible] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const [flyoutHovered, setFlyoutHovered] = useState(false);
  const [settingsFlyoutClicked, setSettingsFlyoutClicked] = useState(false);
  const settingsButtonRef = useRef<HTMLLIElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [flyoutTop, setFlyoutTop] = useState(70);

  // NL flyout state (collapsed mode)
  const [nlFlyoutVisible, setNlFlyoutVisible] = useState(false);
  const [nlHovered, setNlHovered] = useState(false);
  const [nlFlyoutHovered, setNlFlyoutHovered] = useState(false);
  const [nlFlyoutClicked, setNlFlyoutClicked] = useState(false);
  const nlButtonRef = useRef<HTMLLIElement>(null);
  const nlFlyoutRef = useRef<HTMLDivElement>(null);
  const [nlFlyoutTop, setNlFlyoutTop] = useState(70);

  // FSN Level Scanning — collapsible group state
  const [fsnOpen, setFsnOpen] = useState(() =>
    pathname.startsWith("/fsn-scanning"),
  );
  const [fsnFlyoutVisible, setFsnFlyoutVisible] = useState(false);
  const [fsnHovered, setFsnHovered] = useState(false);
  const [fsnFlyoutHovered, setFsnFlyoutHovered] = useState(false);
  const [fsnFlyoutClicked, setFsnFlyoutClicked] = useState(false);
  const fsnButtonRef = useRef<HTMLLIElement>(null);
  const fsnFlyoutRef = useRef<HTMLDivElement>(null);
  const [fsnFlyoutTop, setFsnFlyoutTop] = useState(70);

  // Calculate flyout position dynamically - ensure it's fully visible
  useEffect(() => {
    if (settingsButtonRef.current && collapsed && flyoutVisible) {
      const btnRect = settingsButtonRef.current.getBoundingClientRect();
      const flyoutHeight = flyoutRef.current?.offsetHeight || 500;
      const viewportHeight = window.innerHeight;
      const margin = 12; // margin from edges

      // Try to align top of flyout with settings button
      let top = btnRect.top;

      // If flyout would overflow bottom, push it up
      if (top + flyoutHeight > viewportHeight - margin) {
        top = viewportHeight - flyoutHeight - margin;
      }

      // Never go above the top margin
      if (top < margin) {
        top = margin;
      }

      setFlyoutTop(top);
    }
  }, [collapsed, flyoutVisible]);

  useEffect(() => {
    if (collapsed) {
      setFlyoutVisible(
        settingsHovered || flyoutHovered || settingsFlyoutClicked,
      );
    } else {
      setFlyoutVisible(false);
      setSettingsFlyoutClicked(false);
    }
  }, [collapsed, settingsHovered, flyoutHovered, settingsFlyoutClicked]);

  // Close flyout on outside click
  useEffect(() => {
    if (!settingsFlyoutClicked) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-settings-flyout]") &&
        !target.closest("[data-settings-button]")
      ) {
        setSettingsFlyoutClicked(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsFlyoutClicked]);

  // NL flyout position + visibility (mirrors Settings flyout)
  useEffect(() => {
    if (nlButtonRef.current && collapsed && nlFlyoutVisible) {
      const btnRect = nlButtonRef.current.getBoundingClientRect();
      const flyoutHeight = nlFlyoutRef.current?.offsetHeight || 400;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      let top = btnRect.top;
      if (top + flyoutHeight > viewportHeight - margin)
        top = viewportHeight - flyoutHeight - margin;
      if (top < margin) top = margin;
      setNlFlyoutTop(top);
    }
  }, [collapsed, nlFlyoutVisible]);

  useEffect(() => {
    if (collapsed) {
      setNlFlyoutVisible(nlHovered || nlFlyoutHovered || nlFlyoutClicked);
    } else {
      setNlFlyoutVisible(false);
      setNlFlyoutClicked(false);
    }
  }, [collapsed, nlHovered, nlFlyoutHovered, nlFlyoutClicked]);

  useEffect(() => {
    if (!nlFlyoutClicked) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-nl-flyout]") &&
        !target.closest("[data-nl-button]")
      ) {
        setNlFlyoutClicked(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [nlFlyoutClicked]);

  // FSN flyout position + visibility
  useEffect(() => {
    if (fsnButtonRef.current && collapsed && fsnFlyoutVisible) {
      const btnRect = fsnButtonRef.current.getBoundingClientRect();
      const flyoutHeight = fsnFlyoutRef.current?.offsetHeight || 200;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      let top = btnRect.top;
      if (top + flyoutHeight > viewportHeight - margin)
        top = viewportHeight - flyoutHeight - margin;
      if (top < margin) top = margin;
      setFsnFlyoutTop(top);
    }
  }, [collapsed, fsnFlyoutVisible]);

  useEffect(() => {
    if (collapsed) {
      setFsnFlyoutVisible(fsnHovered || fsnFlyoutHovered || fsnFlyoutClicked);
    } else {
      setFsnFlyoutVisible(false);
      setFsnFlyoutClicked(false);
    }
  }, [collapsed, fsnHovered, fsnFlyoutHovered, fsnFlyoutClicked]);

  useEffect(() => {
    if (!fsnFlyoutClicked) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-fsn-flyout]") &&
        !target.closest("[data-fsn-button]")
      ) {
        setFsnFlyoutClicked(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [fsnFlyoutClicked]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-mode", sidebarMode);
      // Also save legacy for backwards compatibility
      localStorage.setItem("sidebar-collapsed", collapsed.toString());
    }
  }, [sidebarMode, collapsed]);

  const sidebarDrawerRef = useRef<HTMLDivElement | null>(null);
  // Track whether this is the initial mount to skip dropdown open animation
  const isInitialMount = useRef(true);

  // Restore sidebar scroll position synchronously before paint (prevents flicker)
  useLayoutEffect(() => {
    const drawer = sidebarDrawerRef.current;
    if (!drawer) return;
    const applyScroll = (paper: HTMLDivElement) => {
      if (savedSidebarScrollTop > 0) {
        paper.scrollTop = savedSidebarScrollTop;
      }
      isInitialMount.current = false;
    };
    // Paper may already exist (permanent drawer) or appear later (temporary)
    const paper = drawer.querySelector(".MuiDrawer-paper") as HTMLDivElement;
    if (paper) {
      applyScroll(paper);
    } else {
      // MUI Drawer may mount paper asynchronously — watch for it
      const obs = new MutationObserver(() => {
        const p = drawer.querySelector(".MuiDrawer-paper") as HTMLDivElement;
        if (p) {
          applyScroll(p);
          obs.disconnect();
        }
      });
      obs.observe(drawer, { childList: true, subtree: true });
      return () => obs.disconnect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Continuously track scroll position and save to module-level variable
  useEffect(() => {
    const drawer = sidebarDrawerRef.current;
    if (!drawer) return;
    const paper = drawer.querySelector(".MuiDrawer-paper") as HTMLDivElement;
    if (!paper) return;
    const handleScroll = () => {
      savedSidebarScrollTop = paper.scrollTop;
    };
    paper.addEventListener("scroll", handleScroll, { passive: true });
    return () => paper.removeEventListener("scroll", handleScroll);
  }, [isMobile, collapsed]);

  useEffect(() => {
    setMobileOpen?.(false);
  }, [pathname, setMobileOpen]);

  const drawerWidth = collapsed ? 70 : 230;

  // Icon color map for colorful menu icons
  const iconColors: Record<string, string> = {
    "/dashboard": "#60a5fa", // Blue
    "/inbound": "#34d399", // Emerald
    "/qc": "#a78bfa", // Purple
    "/picking": "#fbbf24", // Amber
    "/outbound": "#f97316", // Orange
    "/customers": "#38bdf8", // Sky
    "/reports": "#e879f9", // Fuchsia
    "/settings/rejections": "#f87171", // Red
  };

  const nlIconColors: Record<string, string> = {
    "/nl-fkt-os": "#38bdf8", // Sky
    "/nl-inbound": "#22d3ee", // Cyan
    "/nl-stacking": "#a3e635", // Lime
    "/nl-qc": "#f472b6", // Pink
    "/nl-picking": "#3b82f6", // Blue
    "/nl-dispatch": "#fb923c", // Orange
    "/nl-summary": "#818cf8", // Indigo
    "/nl-billing": "#14b8a6", // Teal
    "/nl-discrepancy": "#f87171", // Red
  };

  const fsnIconColors: Record<string, string> = {
    "/fsn-scanning/master-data": "#f59e0b", // Amber
    "/fsn-scanning/entry": "#10b981", // Emerald
    "/fsn-scanning/scanned-list": "#818cf8", // Indigo
  };

  const settingsIconColors: Record<string, string> = {
    "/settings/master-data": "#60a5fa", // Blue
    "/settings/warehouses": "#34d399", // Emerald
    "/settings/racks": "#fbbf24", // Amber
    "/settings/users": "#38bdf8", // Sky
    "/settings/printers": "#a78bfa", // Purple
    "/settings/backups": "#f97316", // Orange
    "/settings/permissions": "#e879f9", // Fuchsia
    "/settings/appearance": "#fb7185", // Rose
    "/settings/error-logs": "#f87171", // Red
  };

  // Main menu items with UI access codes
  const allMainMenuItems = useMemo(
    () => [
      {
        label: "Dashboard",
        icon: DashboardIcon,
        path: "/dashboard",
        code: "menu:dashboard",
      },
      {
        label: "Inbound",
        icon: InventoryIcon,
        path: "/inbound",
        code: "menu:inbound",
      },
      { label: "Processing", icon: CheckIcon, path: "/qc", code: "menu:qc" },
      {
        label: "Picking",
        icon: AssignmentIcon,
        path: "/picking",
        code: "menu:picking",
      },
      {
        label: "Outbound",
        icon: ShippingIcon,
        path: "/outbound",
        code: "menu:outbound",
      },
      {
        label: "Customers",
        icon: GroupIcon,
        path: "/customers",
        code: "menu:customers",
      },
      {
        label: "Analytics",
        icon: ReportsIcon,
        path: "/reports",
        code: "menu:reports",
      },
      {
        label: "Rejections",
        icon: RejectionsIcon,
        path: "/settings/rejections",
        code: "menu:settings:rejections",
      },
    ],
    [],
  );

  // FSN Level Scanning menu items
  const allFSNMenuItems = useMemo(
    () => [
      {
        label: "Master Data",
        icon: StorageIcon,
        path: "/fsn-scanning/master-data",
        code: "menu:fsn_scanning:master_data",
      },
      {
        label: "Entry",
        icon: AssignmentIcon,
        path: "/fsn-scanning/entry",
        code: "menu:fsn_scanning:entry",
      },
      {
        label: "Scanned List",
        icon: DescriptionIcon,
        path: "/fsn-scanning/scanned-list",
        code: "menu:fsn_scanning:scanned_list",
      },
    ],
    [],
  );

  // NL (Non-Large) menu items with permission codes
  const allNLMenuItems = useMemo(
    () => [
      {
        label: "NL Summary",
        icon: ReportsIcon,
        path: "/nl-summary",
        code: "menu:nl_summary",
      },
      {
        label: "NL OS Data",
        icon: DescriptionIcon,
        path: "/nl-fkt-os",
        code: "menu:nl_fkt_os",
      },
      {
        label: "NL Inbound",
        icon: InventoryIcon,
        path: "/nl-inbound",
        code: "menu:nl_inbound",
      },
      {
        label: "NL Stacking",
        icon: CategoryIcon,
        path: "/nl-stacking",
        code: "menu:nl_stacking",
      },
      { label: "NL QC", icon: CheckIcon, path: "/nl-qc", code: "menu:nl_qc" },
      {
        label: "NL Picking",
        icon: AssignmentIcon,
        path: "/nl-picking",
        code: "menu:nl_picking",
      },
      {
        label: "NL Dispatch",
        icon: ShippingIcon,
        path: "/nl-dispatch",
        code: "menu:nl_dispatch",
      },

      {
        label: "NL Billing",
        icon: BillingIcon,
        path: "/nl-billing",
        code: "menu:nl_billing",
      },
      {
        label: "NL Discrepancy",
        icon: WarningIcon,
        path: "/nl-discrepancy",
        code: "menu:nl_discrepancy",
      },
    ],
    [],
  );

  // Settings menu items with permission codes
  const allSettingsMenuItems = useMemo(
    () => [
      {
        label: "Master Data",
        icon: StorageIcon,
        path: "/settings/master-data",
        code: "menu:settings:masterdata",
      },
      {
        label: "Warehouses",
        icon: WarehouseIcon,
        path: "/settings/warehouses",
        code: "menu:settings:warehouses",
      },
      {
        label: "Racks",
        icon: CategoryIcon,
        path: "/settings/racks",
        code: "menu:settings:racks",
      },
      {
        label: "Users",
        icon: PersonIcon,
        path: "/settings/users",
        code: "menu:settings:users",
      },
      {
        label: "Printers",
        icon: PrinterIcon,
        path: "/settings/printers",
        code: "menu:settings:printers",
      },
      {
        label: "Backups",
        icon: StorageIcon,
        path: "/settings/backups",
        code: "menu:settings:backups",
      },
      {
        label: "Permissions",
        icon: PermissionsIcon,
        path: "/settings/permissions",
        code: "menu:settings:permissions",
      },
      {
        label: "Appearance",
        icon: AppearanceIcon,
        path: "/settings/appearance",
        code: "menu:settings:appearance",
      },
      {
        label: "Error Logs",
        icon: ErrorLogsIcon,
        path: "/settings/error-logs",
        code: "menu:settings:errorlogs",
      },
    ],
    [],
  );

  // Filter menu items based on permissions
  const mainMenu = useMemo(() => {
    // Get user from storage for immediate admin check
    const user = getStoredUser();
    // Only super_admin gets automatic all menu access (not admin)
    const isSuperAdmin = user?.role === "super_admin";

    // Only super_admin gets all menu items immediately
    // Admin should respect their permission settings
    if (isSuperAdmin) {
      return allMainMenuItems;
    }

    // Show all menu items while loading to prevent blank menu (permission check happens on route)
    // This prevents app from feeling unresponsive on slow networks
    if (permissionsLoading) return allMainMenuItems;
    return allMainMenuItems.filter((item) => canSeeMenu(item.code));
  }, [allMainMenuItems, canSeeMenu, permissionsLoading]);

  const settingsMenu = useMemo(() => {
    // Get user from storage for immediate admin check
    const user = getStoredUser();
    // Only super_admin gets automatic all settings access (not admin)
    const isSuperAdmin = user?.role === "super_admin";

    // Only super_admin gets all menu items immediately
    // Admin should respect their permission settings
    if (isSuperAdmin) {
      return allSettingsMenuItems;
    }

    // Show all settings items while loading to prevent blank menu
    // This prevents app from feeling unresponsive on slow networks
    if (permissionsLoading) return allSettingsMenuItems;
    return allSettingsMenuItems.filter((item) => canSeeMenu(item.code));
  }, [allSettingsMenuItems, canSeeMenu, permissionsLoading]);

  const nlMenu = useMemo(() => {
    const user = getStoredUser();
    const isSuperAdmin = user?.role === "super_admin";
    if (isSuperAdmin) return allNLMenuItems;
    if (permissionsLoading) return allNLMenuItems;
    return allNLMenuItems.filter((item) => canSeeMenu(item.code));
  }, [allNLMenuItems, canSeeMenu, permissionsLoading]);

  const fsnMenu = useMemo(() => {
    const user = getStoredUser();
    const isSuperAdmin = user?.role === "super_admin";
    if (isSuperAdmin) return allFSNMenuItems;
    if (permissionsLoading) return allFSNMenuItems;
    return allFSNMenuItems.filter((item) => canSeeMenu(item.code));
  }, [allFSNMenuItems, canSeeMenu, permissionsLoading]);

  const navigate = (path: string) => {
    // Close mobile drawer IMMEDIATELY for instant feedback (don't wait for navigation)
    if (isMobile && setMobileOpen) setMobileOpen(false);

    if (pathname === path) {
      // already on target path — drawer already closed above
      return;
    }

    // Save scroll position before navigation (component will remount)
    const drawer = sidebarDrawerRef.current;
    if (drawer) {
      const paper = drawer.querySelector(".MuiDrawer-paper") as HTMLDivElement;
      if (paper) savedSidebarScrollTop = paper.scrollTop;
    }

    // Use startTransition for non-blocking navigation (React 18+)
    router.push(path);
  };

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    logout();
    router.push("/login");
  };

  const drawerContent = (
    <>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          bgcolor: "transparent",
          backdropFilter: "blur(6px)",
        }}
      >
        <Toolbar
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 1.5, sm: 2 },
          }}
        >
          <IconButton
            onClick={() =>
              isMobile
                ? setMobileOpen && setMobileOpen(false)
                : setCollapsed(!collapsed)
            }
            sx={{
              color: "white",
              ml: -0.5,
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.1)",
              },
            }}
          >
            <MenuIcon />
          </IconButton>

          {!collapsed && (
            <Box sx={{ display: "flex", alignItems: "center", ml: 0.5 }}>
              <TypingTitle
                text="Divine WMS"
                variant="h4"
                pulseKey={titlePulse}
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "20px", sm: "28px", md: "36px" },
                  letterSpacing: "0.6px",
                  lineHeight: 1,
                  display: "inline-block",
                  pointerEvents: "none",
                  color: "#ffffff",
                }}
              />
            </Box>
          )}

          {isMobile && (
            <IconButton
              sx={{
                marginLeft: "auto",
                color: "white",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.1)",
                },
              }}
              onClick={() => setMobileOpen && setMobileOpen(false)}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Toolbar>

        <Divider sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
      </Box>

      <List sx={{ px: 0.5, py: 1 }}>
        {mainMenu.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.path || pathname.startsWith(item.path + "/");

          const buttonContent = (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                onClick={() => navigate(item.path)}
                // Disable ripple delay for instant feedback
                disableRipple={false}
                sx={{
                  mx: 0.75,
                  py: { xs: 1.25, sm: 1 },
                  borderRadius: 2,
                  bgcolor: active
                    ? "linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(99,102,241,0.25) 100%)"
                    : "transparent",
                  background: active
                    ? "linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(99,102,241,0.25) 100%)"
                    : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.75)",
                  // Glow effect for active state
                  boxShadow: active
                    ? "0 0 20px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                    : "none",
                  // Remove transition delay for instant visual feedback
                  transition: "all 0.15s ease",
                  WebkitTapHighlightColor: "transparent",
                  // Ensure touch events work properly
                  touchAction: "manipulation",
                  cursor: "pointer",
                  userSelect: "none",
                  "&:hover": {
                    bgcolor: active
                      ? "linear-gradient(135deg, rgba(59,130,246,0.45) 0%, rgba(99,102,241,0.35) 100%)"
                      : "rgba(255,255,255,0.08)",
                    background: active
                      ? "linear-gradient(135deg, rgba(59,130,246,0.45) 0%, rgba(99,102,241,0.35) 100%)"
                      : "rgba(255,255,255,0.08)",
                    transform: "translateX(2px)",
                  },
                  "&:active": {
                    bgcolor: "rgba(59,130,246,0.4)",
                    transform: "scale(0.98)",
                  },
                  // Active indicator left border with glow
                  ...(active && {
                    borderLeft: "3px solid #60a5fa",
                    pl: 1.5,
                  }),
                }}
              >
                <ListItemIcon
                  sx={{
                    color: active
                      ? "#fff"
                      : iconColors[item.path] || "rgba(255,255,255,0.75)",
                    minWidth: collapsed ? "auto" : 40,
                    justifyContent: collapsed ? "center" : "flex-start",
                    pointerEvents: "none", // Don't let icon intercept clicks
                    transition:
                      "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
                  }}
                >
                  <Icon
                    sx={{
                      fontSize: { xs: 22, sm: 24 },
                      filter: active
                        ? "drop-shadow(0 0 6px rgba(255,255,255,0.4))"
                        : "none",
                    }}
                  />
                </ListItemIcon>

                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    sx={{
                      pointerEvents: "none", // Don't let text intercept clicks
                      opacity: collapsed ? 0 : 1,
                      transition: "opacity 0.2s ease",
                      whiteSpace: "nowrap",
                    }}
                    primaryTypographyProps={{
                      fontSize: { xs: "0.875rem", sm: "0.9rem" },
                      fontWeight: active ? 600 : 500,
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );

          // Wrap with Tooltip when collapsed (desktop only)
          return collapsed && !isMobile ? (
            <Tooltip
              key={item.path}
              title={item.label}
              placement="right"
              arrow
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: "#1e293b",
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  },
                },
                arrow: {
                  sx: {
                    color: "#1e293b",
                  },
                },
              }}
            >
              {buttonContent}
            </Tooltip>
          ) : (
            buttonContent
          );
        })}

        {/* NL (Non-Large) Collapsible Section */}

        {/* ======================================== below is non-large menu ============================================ */}

        {nlMenu.length > 0 && (
          <>
            <Divider sx={{ my: 1.5, bgcolor: "rgba(255,255,255,0.08)" }} />
            <Tooltip
              title={collapsed && !isMobile ? "Non-Large" : ""}
              placement="right"
              arrow
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: "#1e293b",
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  },
                },
                arrow: { sx: { color: "#1e293b" } },
              }}
            >
              <ListItem
                disablePadding
                ref={nlButtonRef}
                data-nl-button
                onMouseEnter={() => setNlHovered(true)}
                onMouseLeave={() => setNlHovered(false)}
                sx={{ mb: 0.25 }}
              >
                <ListItemButton
                  onClick={() => {
                    if (collapsed) {
                      setNlFlyoutClicked((prev) => !prev);
                    } else {
                      setNlOpen(!nlOpen);
                    }
                  }}
                  sx={{
                    mx: 0.75,
                    py: { xs: 1.25, sm: 1 },
                    borderRadius: 2,
                    color: "rgba(255,255,255,0.75)",
                    transition: "none",
                    touchAction: "manipulation",
                    cursor: "pointer",
                    userSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
                    "&:active": { bgcolor: "rgba(255,255,255,0.12)" },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: nlFlyoutVisible || nlOpen ? "#22d3ee" : "#38bdf8",
                      minWidth: collapsed ? "auto" : 40,
                      justifyContent: collapsed ? "center" : "flex-start",
                      pointerEvents: "none",
                      transition:
                        "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
                    }}
                  >
                    <NLIcon sx={{ fontSize: { xs: 22, sm: 24 } }} />
                  </ListItemIcon>
                  {!collapsed && (
                    <>
                      <ListItemText
                        primary="Non-Large"
                        sx={{
                          pointerEvents: "none",
                          opacity: collapsed ? 0 : 1,
                          transition: "opacity 0.2s ease",
                          whiteSpace: "nowrap",
                        }}
                        primaryTypographyProps={{
                          fontSize: { xs: "0.875rem", sm: "0.9rem" },
                          fontWeight: 500,
                        }}
                      />
                      {nlOpen ? (
                        <ExpandLess sx={{ pointerEvents: "none" }} />
                      ) : (
                        <ExpandMore sx={{ pointerEvents: "none" }} />
                      )}
                    </>
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>

            <AnimatePresence initial={false}>
              {nlOpen && (!collapsed || isMobile) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: isInitialMount.current ? 0 : 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  <List sx={{ pl: { xs: 2.5, sm: 3 }, pr: 0.5, py: 0.5 }}>
                    {nlMenu.map((item) => {
                      const Icon = item.icon;
                      const active =
                        pathname === item.path ||
                        pathname.startsWith(item.path + "/");
                      return (
                        <ListItem
                          key={item.path}
                          disablePadding
                          sx={{ mb: 0.25 }}
                        >
                          <ListItemButton
                            onClick={() => navigate(item.path)}
                            sx={{
                              py: { xs: 1, sm: 0.75 },
                              borderRadius: 1.5,
                              color: active ? "#fff" : "rgba(255,255,255,0.7)",
                              bgcolor: active
                                ? "linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(99,102,241,0.2) 100%)"
                                : "transparent",
                              background: active
                                ? "linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(99,102,241,0.2) 100%)"
                                : "transparent",
                              boxShadow: active
                                ? "0 0 15px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.08)"
                                : "none",
                              transition: "all 0.15s ease",
                              touchAction: "manipulation",
                              cursor: "pointer",
                              userSelect: "none",
                              WebkitTapHighlightColor: "transparent",
                              "&:hover": {
                                bgcolor: active
                                  ? "linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(99,102,241,0.3) 100%)"
                                  : "rgba(255,255,255,0.06)",
                                background: active
                                  ? "linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(99,102,241,0.3) 100%)"
                                  : "rgba(255,255,255,0.06)",
                                transform: "translateX(2px)",
                              },
                              "&:active": {
                                bgcolor: "rgba(59,130,246,0.4)",
                                transform: "scale(0.98)",
                              },
                              ...(active && {
                                borderLeft: "3px solid #60a5fa",
                                pl: 1,
                              }),
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                color: active
                                  ? "#fff"
                                  : nlIconColors[item.path] ||
                                    "rgba(255,255,255,0.7)",
                                minWidth: 32,
                                pointerEvents: "none",
                                transition: "color 0.15s ease",
                              }}
                            >
                              <Icon sx={{ fontSize: 18 }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={item.label}
                              sx={{ pointerEvents: "none" }}
                              primaryTypographyProps={{
                                fontSize: { xs: "0.8125rem", sm: "0.85rem" },
                                fontWeight: active ? 600 : 400,
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {/* ============================= Above is Non-Large Menu ============================================= */}

        {/* ======================================== FSN Level Scanning Menu ============================================ */}
        {fsnMenu.length > 0 && (
          <>
            <Divider sx={{ my: 1.5, bgcolor: "rgba(255,255,255,0.08)" }} />
            <Tooltip
              title={collapsed && !isMobile ? "FSN Scanning" : ""}
              placement="right"
              arrow
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: "#1e293b",
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  },
                },
                arrow: { sx: { color: "#1e293b" } },
              }}
            >
              <ListItem
                disablePadding
                ref={fsnButtonRef}
                data-fsn-button
                onMouseEnter={() => setFsnHovered(true)}
                onMouseLeave={() => setFsnHovered(false)}
                sx={{ mb: 0.25 }}
              >
                <ListItemButton
                  onClick={() => {
                    if (collapsed) {
                      setFsnFlyoutClicked((prev) => !prev);
                    } else {
                      setFsnOpen(!fsnOpen);
                    }
                  }}
                  sx={{
                    mx: 0.75,
                    py: { xs: 1.25, sm: 1 },
                    borderRadius: 2,
                    color: "rgba(255,255,255,0.75)",
                    transition: "none",
                    touchAction: "manipulation",
                    cursor: "pointer",
                    userSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
                    "&:active": { bgcolor: "rgba(255,255,255,0.12)" },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        fsnFlyoutVisible || fsnOpen ? "#10b981" : "#f59e0b",
                      minWidth: collapsed ? "auto" : 40,
                      justifyContent: collapsed ? "center" : "flex-start",
                      pointerEvents: "none",
                      transition:
                        "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
                    }}
                  >
                    <AssignmentIcon sx={{ fontSize: { xs: 22, sm: 24 } }} />
                  </ListItemIcon>
                  {!collapsed && (
                    <>
                      <ListItemText
                        primary="FSN Scanning"
                        sx={{
                          pointerEvents: "none",
                          opacity: collapsed ? 0 : 1,
                          transition: "opacity 0.2s ease",
                          whiteSpace: "nowrap",
                        }}
                        primaryTypographyProps={{
                          fontSize: { xs: "0.875rem", sm: "0.9rem" },
                          fontWeight: 500,
                        }}
                      />
                      {fsnOpen ? (
                        <ExpandLess sx={{ pointerEvents: "none" }} />
                      ) : (
                        <ExpandMore sx={{ pointerEvents: "none" }} />
                      )}
                    </>
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>

            <AnimatePresence initial={false}>
              {fsnOpen && (!collapsed || isMobile) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: isInitialMount.current ? 0 : 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  <List sx={{ pl: { xs: 2.5, sm: 3 }, pr: 0.5, py: 0.5 }}>
                    {fsnMenu.map((item) => {
                      const Icon = item.icon;
                      const active =
                        pathname === item.path ||
                        pathname.startsWith(item.path + "/");
                      return (
                        <ListItem
                          key={item.path}
                          disablePadding
                          sx={{ mb: 0.25 }}
                        >
                          <ListItemButton
                            onClick={() => navigate(item.path)}
                            sx={{
                              py: { xs: 1, sm: 0.75 },
                              borderRadius: 1.5,
                              color: active ? "#fff" : "rgba(255,255,255,0.7)",
                              bgcolor: active
                                ? "linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(5,150,105,0.2) 100%)"
                                : "transparent",
                              background: active
                                ? "linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(5,150,105,0.2) 100%)"
                                : "transparent",
                              boxShadow: active
                                ? "0 0 15px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.08)"
                                : "none",
                              transition: "all 0.15s ease",
                              touchAction: "manipulation",
                              cursor: "pointer",
                              userSelect: "none",
                              WebkitTapHighlightColor: "transparent",
                              "&:hover": {
                                bgcolor: active
                                  ? "linear-gradient(135deg, rgba(16,185,129,0.4) 0%, rgba(5,150,105,0.3) 100%)"
                                  : "rgba(255,255,255,0.06)",
                                background: active
                                  ? "linear-gradient(135deg, rgba(16,185,129,0.4) 0%, rgba(5,150,105,0.3) 100%)"
                                  : "rgba(255,255,255,0.06)",
                                transform: "translateX(2px)",
                              },
                              "&:active": {
                                bgcolor: "rgba(16,185,129,0.4)",
                                transform: "scale(0.98)",
                              },
                              ...(active && {
                                borderLeft: "3px solid #10b981",
                                pl: 1,
                              }),
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                color: active
                                  ? "#fff"
                                  : fsnIconColors[item.path] ||
                                    "rgba(255,255,255,0.7)",
                                minWidth: 32,
                                pointerEvents: "none",
                                transition: "color 0.15s ease",
                              }}
                            >
                              <Icon sx={{ fontSize: 18 }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={item.label}
                              sx={{ pointerEvents: "none" }}
                              primaryTypographyProps={{
                                fontSize: { xs: "0.8125rem", sm: "0.85rem" },
                                fontWeight: active ? 600 : 400,
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {/* ============================= Above is FSN Scanning Menu ============================================= */}

        <Divider sx={{ my: 1.5, bgcolor: "rgba(255,255,255,0.08)" }} />

        {/* Only show Settings if user has settings menu items */}
        {settingsMenu.length > 0 && (
          <Tooltip
            title={collapsed && !isMobile ? "Settings" : ""}
            placement="right"
            arrow
            slotProps={{
              tooltip: {
                sx: {
                  bgcolor: "#1e293b",
                  color: "white",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                },
              },
              arrow: {
                sx: {
                  color: "#1e293b",
                },
              },
            }}
          >
            <ListItem
              disablePadding
              ref={settingsButtonRef}
              data-settings-button
              onMouseEnter={() => setSettingsHovered(true)}
              onMouseLeave={() => setSettingsHovered(false)}
              sx={{ mb: 0.25, mt: -1.5 }}
            >
              <ListItemButton
                onClick={() => {
                  if (collapsed) {
                    // When collapsed, toggle click-based flyout
                    setSettingsFlyoutClicked((prev) => !prev);
                  } else {
                    setSettingsOpen(!settingsOpen);
                  }
                }}
                sx={{
                  mx: 0.75,
                  py: { xs: 1.25, sm: 1 },
                  borderRadius: 2,
                  color: "rgba(255,255,255,0.75)",
                  // Remove transition for instant feedback
                  transition: "none",
                  // Proper touch handling
                  touchAction: "manipulation",
                  cursor: "pointer",
                  userSelect: "none",
                  WebkitTapHighlightColor: "transparent",
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.08)",
                  },
                  "&:active": {
                    bgcolor: "rgba(255,255,255,0.12)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color:
                      flyoutVisible || settingsOpen ? "#e879f9" : "#a78bfa",
                    minWidth: collapsed ? "auto" : 40,
                    justifyContent: collapsed ? "center" : "flex-start",
                    pointerEvents: "none", // Don't let icon intercept clicks
                    transition:
                      "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
                  }}
                >
                  <SettingsIcon
                    sx={{
                      fontSize: { xs: 22, sm: 24 },
                      animation:
                        flyoutVisible || settingsOpen
                          ? "spin 2s linear infinite"
                          : "none",
                      "@keyframes spin": {
                        "0%": { transform: "rotate(0deg)" },
                        "100%": { transform: "rotate(360deg)" },
                      },
                    }}
                  />
                </ListItemIcon>

                {!collapsed && (
                  <>
                    <ListItemText
                      primary="Settings"
                      sx={{
                        pointerEvents: "none", // Don't let text intercept clicks
                        opacity: collapsed ? 0 : 1,
                        transition: "opacity 0.2s ease",
                        whiteSpace: "nowrap",
                      }}
                      primaryTypographyProps={{
                        fontSize: { xs: "0.875rem", sm: "0.9rem" },
                        fontWeight: 500,
                      }}
                    />
                    {settingsOpen ? (
                      <ExpandLess sx={{ pointerEvents: "none" }} />
                    ) : (
                      <ExpandMore sx={{ pointerEvents: "none" }} />
                    )}
                  </>
                )}
              </ListItemButton>
            </ListItem>
          </Tooltip>
        )}

        <AnimatePresence initial={false}>
          {settingsOpen && (!collapsed || isMobile) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: isInitialMount.current ? 0 : 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <List sx={{ pl: { xs: 2.5, sm: 3 }, pr: 0.5, py: 0.5 }}>
                {settingsMenu.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.path ||
                    pathname.startsWith(item.path + "/");

                  return (
                    <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
                      <ListItemButton
                        onClick={() => navigate(item.path)}
                        sx={{
                          py: { xs: 1, sm: 0.75 },
                          borderRadius: 1.5,
                          color: active ? "#fff" : "rgba(255,255,255,0.7)",
                          bgcolor: active
                            ? "linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(99,102,241,0.2) 100%)"
                            : "transparent",
                          background: active
                            ? "linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(99,102,241,0.2) 100%)"
                            : "transparent",
                          boxShadow: active
                            ? "0 0 15px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.08)"
                            : "none",
                          // Smooth transition
                          transition: "all 0.15s ease",
                          // Proper touch handling
                          touchAction: "manipulation",
                          cursor: "pointer",
                          userSelect: "none",
                          WebkitTapHighlightColor: "transparent",
                          "&:hover": {
                            bgcolor: active
                              ? "linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(99,102,241,0.3) 100%)"
                              : "rgba(255,255,255,0.06)",
                            background: active
                              ? "linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(99,102,241,0.3) 100%)"
                              : "rgba(255,255,255,0.06)",
                            transform: "translateX(2px)",
                          },
                          "&:active": {
                            bgcolor: "rgba(59,130,246,0.4)",
                            transform: "scale(0.98)",
                          },
                          // Active indicator left border with glow
                          ...(active && {
                            borderLeft: "3px solid #60a5fa",
                            pl: 1,
                          }),
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: active
                              ? "#fff"
                              : settingsIconColors[item.path] ||
                                "rgba(255,255,255,0.7)",
                            minWidth: 32,
                            pointerEvents: "none",
                            transition: "color 0.15s ease",
                          }}
                        >
                          <Icon sx={{ fontSize: 18 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          sx={{ pointerEvents: "none" }}
                          primaryTypographyProps={{
                            fontSize: { xs: "0.8125rem", sm: "0.85rem" },
                            fontWeight: active ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}

                {/* Logout Button */}
                <ListItem disablePadding sx={{ mt: 0.5 }}>
                  <ListItemButton
                    onClick={handleLogout}
                    sx={{
                      py: { xs: 1, sm: 0.75 },
                      borderRadius: 1.5,
                      color: "#fca5a5",
                      bgcolor: "transparent",
                      transition: "none",
                      touchAction: "manipulation",
                      cursor: "pointer",
                      userSelect: "none",
                      WebkitTapHighlightColor: "transparent",
                      "&:hover": {
                        bgcolor: "rgba(239, 68, 68, 0.15)",
                        color: "#fecaca",
                      },
                      "&:active": {
                        bgcolor: "rgba(239, 68, 68, 0.25)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: "#f87171",
                        minWidth: 32,
                        pointerEvents: "none",
                      }}
                    >
                      <LogoutIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Logout"
                      sx={{ pointerEvents: "none" }}
                      primaryTypographyProps={{
                        fontSize: { xs: "0.8125rem", sm: "0.85rem" },
                        fontWeight: 500,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              </List>
            </motion.div>
          )}
        </AnimatePresence>
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {/* Sidebar Control Menu - Like Supabase */}
      {!isMobile &&
        (() => {
          // Compute mode checks outside conditional to avoid TypeScript narrowing issues
          const isExpandedMode = sidebarMode === "expanded";
          const isCollapsedMode = sidebarMode === "collapsed";
          const isHoverMode = sidebarMode === "hover";

          return (
            <Tooltip
              title={collapsed ? "Sidebar control" : ""}
              placement="right"
              arrow
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: "#1e293b",
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  },
                },
                arrow: {
                  sx: {
                    color: "#1e293b",
                  },
                },
              }}
            >
              <Box sx={{ px: 1, mt: 10, pb: 1 }}>
                <ListItemButton
                  onClick={() => setSidebarControlOpen(!sidebarControlOpen)}
                  sx={{
                    py: 0.75,
                    px: 1.5,
                    borderRadius: 1.5,
                    color: "rgba(255,255,255,0.6)",
                    bgcolor: sidebarControlOpen
                      ? "rgba(255,255,255,0.08)"
                      : "transparent",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.9)",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: "inherit",
                      minWidth: collapsed ? "auto" : 32,
                      transition:
                        "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <SidebarIcon sx={{ fontSize: 18 }} />
                  </ListItemIcon>
                  {!collapsed && (
                    <>
                      <ListItemText
                        primary="Sidebar control"
                        sx={{
                          opacity: collapsed ? 0 : 1,
                          transition: "opacity 0.2s ease",
                          whiteSpace: "nowrap",
                        }}
                        primaryTypographyProps={{
                          fontSize: "0.8rem",
                          fontWeight: 500,
                        }}
                      />
                      {sidebarControlOpen ? (
                        <ExpandLess sx={{ fontSize: 18 }} />
                      ) : (
                        <ExpandMore sx={{ fontSize: 18 }} />
                      )}
                    </>
                  )}
                </ListItemButton>

                <AnimatePresence>
                  {sidebarControlOpen && !collapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ overflow: "hidden" }}
                    >
                      <Box sx={{ pl: 1, pr: 0.5, py: 0.5 }}>
                        {/* Expanded Option */}
                        <ListItemButton
                          onClick={() => setSidebarMode("expanded")}
                          sx={{
                            py: 0.5,
                            px: 1,
                            borderRadius: 1,
                            color: isExpandedMode
                              ? "#60a5fa"
                              : "rgba(255,255,255,0.7)",
                            bgcolor: isExpandedMode
                              ? "rgba(59,130,246,0.15)"
                              : "transparent",
                            "&:hover": {
                              bgcolor: isExpandedMode
                                ? "rgba(59,130,246,0.2)"
                                : "rgba(255,255,255,0.06)",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              width: "100%",
                              gap: 1.5,
                            }}
                          >
                            {isExpandedMode ? (
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: "#60a5fa",
                                  boxShadow: "0 0 8px rgba(96,165,250,0.6)",
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: "transparent",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                }}
                              />
                            )}
                            <ExpandIcon sx={{ fontSize: 16, opacity: 0.8 }} />
                            <Typography
                              sx={{
                                fontSize: "0.8rem",
                                fontWeight: isExpandedMode ? 600 : 400,
                              }}
                            >
                              Expanded
                            </Typography>
                          </Box>
                        </ListItemButton>

                        {/* Collapsed Option */}
                        <ListItemButton
                          onClick={() => setSidebarMode("collapsed")}
                          sx={{
                            py: 0.5,
                            px: 1,
                            borderRadius: 1,
                            color: isCollapsedMode
                              ? "#60a5fa"
                              : "rgba(255,255,255,0.7)",
                            bgcolor: isCollapsedMode
                              ? "rgba(59,130,246,0.15)"
                              : "transparent",
                            "&:hover": {
                              bgcolor: isCollapsedMode
                                ? "rgba(59,130,246,0.2)"
                                : "rgba(255,255,255,0.06)",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              width: "100%",
                              gap: 1.5,
                            }}
                          >
                            {isCollapsedMode ? (
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: "#60a5fa",
                                  boxShadow: "0 0 8px rgba(96,165,250,0.6)",
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: "transparent",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                }}
                              />
                            )}
                            <CollapseIcon sx={{ fontSize: 16, opacity: 0.8 }} />
                            <Typography
                              sx={{
                                fontSize: "0.8rem",
                                fontWeight: isCollapsedMode ? 600 : 400,
                              }}
                            >
                              Collapsed
                            </Typography>
                          </Box>
                        </ListItemButton>

                        {/* Expand on Hover Option */}
                        <ListItemButton
                          onClick={() => setSidebarMode("hover")}
                          sx={{
                            py: 0.5,
                            px: 1,
                            borderRadius: 1,
                            color: isHoverMode
                              ? "#60a5fa"
                              : "rgba(255,255,255,0.7)",
                            bgcolor: isHoverMode
                              ? "rgba(59,130,246,0.15)"
                              : "transparent",
                            "&:hover": {
                              bgcolor: isHoverMode
                                ? "rgba(59,130,246,0.2)"
                                : "rgba(255,255,255,0.06)",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              width: "100%",
                              gap: 1.5,
                            }}
                          >
                            {isHoverMode ? (
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: "#60a5fa",
                                  boxShadow: "0 0 8px rgba(96,165,250,0.6)",
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: "transparent",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                }}
                              />
                            )}
                            <HoverIcon sx={{ fontSize: 16, opacity: 0.8 }} />
                            <Typography
                              sx={{
                                fontSize: "0.8rem",
                                fontWeight: isHoverMode ? 600 : 400,
                              }}
                            >
                              Expand on hover
                            </Typography>
                          </Box>
                        </ListItemButton>
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            </Tooltip>
          );
        })()}

      {!collapsed && (
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            pb: { xs: "calc(16px + env(safe-area-inset-bottom))", sm: 2 },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "0.75rem",
              display: "block",
            }}
          >
            Logged in as
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "rgba(255,255,255,0.8)",
              fontWeight: 600,
              fontSize: "0.8125rem",
            }}
          >
            {userName}
          </Typography>
        </Box>
      )}
    </>
  );

  ////////////////////////// UI RENDER ///////////////////////////
  return (
    <>
      {isMobile ? (
        <>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen && setMobileOpen(false)}
            ref={sidebarDrawerRef}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              zIndex: 1200,
              "& .MuiDrawer-paper": {
                width: 260,
                background:
                  "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
                color: "white",
                left: 0,
                position: "fixed",
                borderRight: "none",
                boxShadow: "4px 0 30px rgba(0,0,0,0.3)",
                paddingBottom: "env(safe-area-inset-bottom)",
                overflowAnchor: "none",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(255,255,255,0.2) transparent",
                "&::-webkit-scrollbar": {
                  width: "4px",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: "10px",
                },
              },
              "& .MuiBackdrop-root": {
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              },
            }}
            transitionDuration={{
              enter: 225,
              exit: 195,
            }}
          >
            {drawerContent}
          </Drawer>
        </>
      ) : (
        <Drawer
          variant="permanent"
          ref={sidebarDrawerRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            height: "100vh",
            zIndex: 1200,
            transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              background:
                "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
              color: "white",
              transition:
                "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease",
              overflowX: "hidden",
              overflowY: "auto",
              overflowAnchor: "none",
              position: "relative",
              zIndex: 1200,
              height: "100%",
              maxHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              borderRight: "none",
              boxShadow:
                sidebarMode === "hover" && isHovering
                  ? "4px 0 30px rgba(0,0,0,0.3)"
                  : "2px 0 20px rgba(0,0,0,0.1)",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.2) transparent",
              "&::-webkit-scrollbar": {
                width: "5px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "10px",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.3)",
                },
              },
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* NL Flyout disabled on mobile */}
      {nlFlyoutVisible && collapsed && !isMobile && (
        <Portal>
          <Paper
            ref={nlFlyoutRef}
            data-nl-flyout
            onMouseEnter={() => setNlFlyoutHovered(true)}
            onMouseLeave={() => setNlFlyoutHovered(false)}
            elevation={24}
            sx={{
              position: "fixed",
              top: nlFlyoutTop,
              left: drawerWidth + 4,
              width: 230,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
              color: "white",
              py: 1.5,
              px: 1,
              borderRadius: 2,
              zIndex: 99999,
              boxShadow:
                "0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              animation: "flyoutIn 0.15s ease-out",
              "@keyframes flyoutIn": {
                "0%": { opacity: 0, transform: "translateX(-8px) scale(0.96)" },
                "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
              },
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.2) transparent",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "10px",
              },
            }}
          >
            <Typography
              sx={{
                px: 1,
                pb: 1,
                pt: 0.5,
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.5,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              Non-Large
            </Typography>

            <List sx={{ py: 0 }}>
              {nlMenu.map((item) => {
                const Icon = item.icon;
                const flyoutActive =
                  pathname === item.path ||
                  pathname.startsWith(item.path + "/");
                return (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.15 }}>
                    <ListItemButton
                      onClick={() => {
                        navigate(item.path);
                        setNlFlyoutClicked(false);
                      }}
                      sx={{
                        borderRadius: 1.5,
                        color: flyoutActive ? "#fff" : "rgba(255,255,255,0.8)",
                        bgcolor: flyoutActive
                          ? "rgba(59,130,246,0.25)"
                          : "transparent",
                        py: 0.625,
                        px: 1.5,
                        transition: "all 0.15s ease",
                        touchAction: "manipulation",
                        cursor: "pointer",
                        "&:hover": {
                          bgcolor: flyoutActive
                            ? "rgba(59,130,246,0.35)"
                            : "rgba(255,255,255,0.08)",
                          transform: "translateX(2px)",
                        },
                        "&:active": { bgcolor: "rgba(255,255,255,0.15)" },
                        ...(flyoutActive && {
                          borderLeft: "2px solid #60a5fa",
                        }),
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color: flyoutActive
                            ? "#fff"
                            : nlIconColors[item.path] ||
                              "rgba(255,255,255,0.7)",
                          minWidth: 32,
                          pointerEvents: "none",
                          transition: "color 0.15s ease",
                        }}
                      >
                        <Icon sx={{ fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        sx={{ pointerEvents: "none" }}
                        primaryTypographyProps={{
                          fontSize: "0.85rem",
                          fontWeight: flyoutActive ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Portal>
      )}

      {/* Flyout disabled on mobile */}
      {flyoutVisible && collapsed && !isMobile && (
        <Portal>
          <Paper
            ref={flyoutRef}
            data-settings-flyout
            onMouseEnter={() => setFlyoutHovered(true)}
            onMouseLeave={() => setFlyoutHovered(false)}
            elevation={24}
            sx={{
              position: "fixed",
              top: flyoutTop,
              left: drawerWidth + 4,
              width: 230,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
              color: "white",
              py: 1.5,
              px: 1,
              borderRadius: 2,
              zIndex: 99999,
              boxShadow:
                "0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              animation: "flyoutIn 0.15s ease-out",
              "@keyframes flyoutIn": {
                "0%": { opacity: 0, transform: "translateX(-8px) scale(0.96)" },
                "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
              },
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.2) transparent",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "10px",
              },
            }}
          >
            <Typography
              sx={{
                px: 1,
                pb: 1,
                pt: 0.5,
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.5,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              Settings
            </Typography>

            <List sx={{ py: 0 }}>
              {settingsMenu.map((item) => {
                const Icon = item.icon;
                const flyoutActive =
                  pathname === item.path ||
                  pathname.startsWith(item.path + "/");
                return (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.15 }}>
                    <ListItemButton
                      onClick={() => {
                        navigate(item.path);
                        setSettingsFlyoutClicked(false);
                      }}
                      sx={{
                        borderRadius: 1.5,
                        color: flyoutActive ? "#fff" : "rgba(255,255,255,0.8)",
                        bgcolor: flyoutActive
                          ? "rgba(59,130,246,0.25)"
                          : "transparent",
                        py: 0.625,
                        px: 1.5,
                        transition: "all 0.15s ease",
                        touchAction: "manipulation",
                        cursor: "pointer",
                        "&:hover": {
                          bgcolor: flyoutActive
                            ? "rgba(59,130,246,0.35)"
                            : "rgba(255,255,255,0.08)",
                          transform: "translateX(2px)",
                        },
                        "&:active": {
                          bgcolor: "rgba(255,255,255,0.15)",
                        },
                        ...(flyoutActive && {
                          borderLeft: "2px solid #60a5fa",
                        }),
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color: flyoutActive
                            ? "#fff"
                            : settingsIconColors[item.path] ||
                              "rgba(255,255,255,0.7)",
                          minWidth: 32,
                          pointerEvents: "none",
                          transition: "color 0.15s ease",
                        }}
                      >
                        <Icon sx={{ fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        sx={{ pointerEvents: "none" }}
                        primaryTypographyProps={{
                          fontSize: "0.85rem",
                          fontWeight: flyoutActive ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}

              <Divider sx={{ my: 0.75, bgcolor: "rgba(255,255,255,0.08)" }} />

              {/* Logout Button */}
              <ListItem disablePadding sx={{ mt: 0.25 }}>
                <ListItemButton
                  onClick={() => {
                    handleLogout();
                    setSettingsFlyoutClicked(false);
                  }}
                  sx={{
                    borderRadius: 1.5,
                    color: "#fca5a5",
                    py: 0.625,
                    px: 1.5,
                    transition: "all 0.15s ease",
                    touchAction: "manipulation",
                    cursor: "pointer",
                    "&:hover": {
                      bgcolor: "rgba(239, 68, 68, 0.15)",
                    },
                    "&:active": {
                      bgcolor: "rgba(239, 68, 68, 0.25)",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: "#f87171",
                      minWidth: 32,
                      pointerEvents: "none",
                    }}
                  >
                    <LogoutIcon sx={{ fontSize: 18 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Logout"
                    sx={{ pointerEvents: "none" }}
                    primaryTypographyProps={{ fontSize: "0.85rem" }}
                  />
                </ListItemButton>
              </ListItem>
            </List>
          </Paper>
        </Portal>
      )}

      {/* FSN Scanning Flyout (collapsed sidebar only, desktop only) */}
      {fsnFlyoutVisible && collapsed && !isMobile && (
        <Portal>
          <Paper
            ref={fsnFlyoutRef}
            data-fsn-flyout
            onMouseEnter={() => setFsnFlyoutHovered(true)}
            onMouseLeave={() => setFsnFlyoutHovered(false)}
            elevation={24}
            sx={{
              position: "fixed",
              top: fsnFlyoutTop,
              left: drawerWidth + 4,
              width: 230,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
              color: "white",
              py: 1.5,
              px: 1,
              borderRadius: 2,
              zIndex: 99999,
              boxShadow:
                "0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              animation: "flyoutIn 0.15s ease-out",
              "@keyframes flyoutIn": {
                "0%": { opacity: 0, transform: "translateX(-8px) scale(0.96)" },
                "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
              },
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.2) transparent",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "10px",
              },
            }}
          >
            <Typography
              sx={{
                px: 1,
                pb: 1,
                pt: 0.5,
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.5,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              FSN Scanning
            </Typography>
            <List sx={{ py: 0 }}>
              {fsnMenu.map((item) => {
                const Icon = item.icon;
                const flyoutActive =
                  pathname === item.path ||
                  pathname.startsWith(item.path + "/");
                return (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.15 }}>
                    <ListItemButton
                      onClick={() => {
                        navigate(item.path);
                        setFsnFlyoutClicked(false);
                      }}
                      sx={{
                        borderRadius: 1.5,
                        color: flyoutActive ? "#fff" : "rgba(255,255,255,0.8)",
                        bgcolor: flyoutActive
                          ? "rgba(16,185,129,0.25)"
                          : "transparent",
                        py: 0.625,
                        px: 1.5,
                        transition: "all 0.15s ease",
                        touchAction: "manipulation",
                        cursor: "pointer",
                        "&:hover": {
                          bgcolor: flyoutActive
                            ? "rgba(16,185,129,0.35)"
                            : "rgba(255,255,255,0.08)",
                          transform: "translateX(2px)",
                        },
                        "&:active": { bgcolor: "rgba(255,255,255,0.15)" },
                        ...(flyoutActive && {
                          borderLeft: "2px solid #10b981",
                        }),
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color: flyoutActive
                            ? "#fff"
                            : fsnIconColors[item.path] ||
                              "rgba(255,255,255,0.7)",
                          minWidth: 32,
                          pointerEvents: "none",
                          transition: "color 0.15s ease",
                        }}
                      >
                        <Icon sx={{ fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        sx={{ pointerEvents: "none" }}
                        primaryTypographyProps={{
                          fontSize: "0.85rem",
                          fontWeight: flyoutActive ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Portal>
      )}

      <Snackbar
        open={showNotification}
        autoHideDuration={3000}
        onClose={() => setShowNotification(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setShowNotification(false)}
          severity="info"
          sx={{ width: "100%" }}
        >
          {notificationMessage}
        </Alert>
      </Snackbar>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={logoutDialogOpen}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        confirmColor="primary"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutDialogOpen(false)}
      />
    </>
  );
}
