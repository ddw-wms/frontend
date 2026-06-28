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
  Typography,
  Box,
  IconButton,
  Paper,
  Tooltip,
  Snackbar,
  Alert,
  Portal,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExpandLess,
  ExpandMore,
  Close as CloseIcon,
} from "@mui/icons-material";

import {
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckIcon,
  LocalShipping as ShippingIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
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
  Layers as NLIcon,
  Description as DescriptionIcon,
  Warning as WarningIcon,
  ReceiptLong as BillingIcon,
  Widgets as RvpLargeIcon,
  Home as HomeIcon,
} from "@mui/icons-material";
import { getStoredUser, logout } from "@/lib/auth";
import { usePermissions } from "@/app/context/PermissionContext";
import ConfirmDialog from "./ConfirmDialog";
import TypingTitle from "./TypingTitle";

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

  const { canSeeMenu, isLoading: permissionsLoading } = usePermissions();

  const [sidebarMode, setSidebarMode] = useState<
    "expanded" | "collapsed" | "hover"
  >(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("sidebar-mode");
      if (savedMode === "collapsed" || savedMode === "hover") return savedMode;
      const legacyCollapsed = localStorage.getItem("sidebar-collapsed");
      if (legacyCollapsed === "true") return "collapsed";
    }
    return "expanded";
  });

  const [sidebarControlOpen, setSidebarControlOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (sidebarMode !== "hover") return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(true);
    }, 50);
  }, [sidebarMode]);

  const handleMouseLeave = useCallback(() => {
    if (sidebarMode !== "hover") return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 140);
  }, [sidebarMode]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const collapsed =
    !isMobile &&
    (sidebarMode === "collapsed" || (sidebarMode === "hover" && !isHovering));

  const [titlePulse, setTitlePulse] = useState(0);
  const prevCollapsedRef = useRef(collapsed);
  const prevMobileOpenRef = useRef(mobileOpen);

  useEffect(() => {
    if (prevCollapsedRef.current !== collapsed) {
      if (!collapsed) setTitlePulse((p) => p + 1);
      prevCollapsedRef.current = collapsed;
    }
  }, [collapsed]);

  useEffect(() => {
    if (prevMobileOpenRef.current !== mobileOpen) {
      if (mobileOpen) setTitlePulse((p) => p + 1);
      prevMobileOpenRef.current = mobileOpen;
    }
  }, [mobileOpen]);

  const setCollapsed = (value: boolean) => {
    setSidebarMode(value ? "collapsed" : "expanded");
  };

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

  const checkMobile = useCallback(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth < 900);
    }
  }, []);

  useEffect(() => {
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const user = getStoredUser();
    if (user) {
      setUserRole(user.role || "");
      setUserName(user.fullName || user.username || "");
    }

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, [checkMobile]);

  const [rvpLargeOpen, setRvpLargeOpen] = useState(() =>
    [
      "/dashboard",
      "/inbound",
      "/qc",
      "/picking",
      "/outbound",
      "/reports",
      "/settings/rejections",
      "/settings/master-data",
    ].some((path) => pathname === path || pathname.startsWith(path + "/")),
  );

  const [settingsOpen, setSettingsOpen] = useState(() =>
    pathname.startsWith("/settings"),
  );
  const [nlOpen, setNlOpen] = useState(() => pathname.startsWith("/nl-"));
  const [fsnOpen, setFsnOpen] = useState(() =>
    pathname.startsWith("/fsn-scanning"),
  );

  const [flyoutVisible, setFlyoutVisible] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const [flyoutHovered, setFlyoutHovered] = useState(false);
  const [settingsFlyoutClicked, setSettingsFlyoutClicked] = useState(false);
  const settingsButtonRef = useRef<HTMLLIElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [flyoutTop, setFlyoutTop] = useState(70);

  const [nlFlyoutVisible, setNlFlyoutVisible] = useState(false);
  const [nlHovered, setNlHovered] = useState(false);
  const [nlFlyoutHovered, setNlFlyoutHovered] = useState(false);
  const [nlFlyoutClicked, setNlFlyoutClicked] = useState(false);
  const nlButtonRef = useRef<HTMLLIElement>(null);
  const nlFlyoutRef = useRef<HTMLDivElement>(null);
  const [nlFlyoutTop, setNlFlyoutTop] = useState(70);

  const [fsnFlyoutVisible, setFsnFlyoutVisible] = useState(false);
  const [fsnHovered, setFsnHovered] = useState(false);
  const [fsnFlyoutHovered, setFsnFlyoutHovered] = useState(false);
  const [fsnFlyoutClicked, setFsnFlyoutClicked] = useState(false);
  const fsnButtonRef = useRef<HTMLLIElement>(null);
  const fsnFlyoutRef = useRef<HTMLDivElement>(null);
  const [fsnFlyoutTop, setFsnFlyoutTop] = useState(70);

  const [rvpFlyoutVisible, setRvpFlyoutVisible] = useState(false);
  const [rvpHovered, setRvpHovered] = useState(false);
  const [rvpFlyoutHovered, setRvpFlyoutHovered] = useState(false);
  const [rvpFlyoutClicked, setRvpFlyoutClicked] = useState(false);
  const rvpButtonRef = useRef<HTMLLIElement>(null);
  const rvpFlyoutRef = useRef<HTMLDivElement>(null);
  const [rvpFlyoutTop, setRvpFlyoutTop] = useState(70);

  useEffect(() => {
    if (settingsButtonRef.current && collapsed && flyoutVisible) {
      const btnRect = settingsButtonRef.current.getBoundingClientRect();
      const flyoutHeight = flyoutRef.current?.offsetHeight || 500;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      let top = btnRect.top;
      if (top + flyoutHeight > viewportHeight - margin) {
        top = viewportHeight - flyoutHeight - margin;
      }
      if (top < margin) top = margin;
      setFlyoutTop(top);
    }
  }, [collapsed, flyoutVisible]);

  useEffect(() => {
    if (nlButtonRef.current && collapsed && nlFlyoutVisible) {
      const btnRect = nlButtonRef.current.getBoundingClientRect();
      const flyoutHeight = nlFlyoutRef.current?.offsetHeight || 400;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      let top = btnRect.top;
      if (top + flyoutHeight > viewportHeight - margin) {
        top = viewportHeight - flyoutHeight - margin;
      }
      if (top < margin) top = margin;
      setNlFlyoutTop(top);
    }
  }, [collapsed, nlFlyoutVisible]);

  useEffect(() => {
    if (fsnButtonRef.current && collapsed && fsnFlyoutVisible) {
      const btnRect = fsnButtonRef.current.getBoundingClientRect();
      const flyoutHeight = fsnFlyoutRef.current?.offsetHeight || 220;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      let top = btnRect.top;
      if (top + flyoutHeight > viewportHeight - margin) {
        top = viewportHeight - flyoutHeight - margin;
      }
      if (top < margin) top = margin;
      setFsnFlyoutTop(top);
    }
  }, [collapsed, fsnFlyoutVisible]);

  useEffect(() => {
    if (rvpButtonRef.current && collapsed && rvpFlyoutVisible) {
      const btnRect = rvpButtonRef.current.getBoundingClientRect();
      const flyoutHeight = rvpFlyoutRef.current?.offsetHeight || 420;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      let top = btnRect.top;
      if (top + flyoutHeight > viewportHeight - margin) {
        top = viewportHeight - flyoutHeight - margin;
      }
      if (top < margin) top = margin;
      setRvpFlyoutTop(top);
    }
  }, [collapsed, rvpFlyoutVisible]);

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

  useEffect(() => {
    if (collapsed) {
      setNlFlyoutVisible(nlHovered || nlFlyoutHovered || nlFlyoutClicked);
    } else {
      setNlFlyoutVisible(false);
      setNlFlyoutClicked(false);
    }
  }, [collapsed, nlHovered, nlFlyoutHovered, nlFlyoutClicked]);

  useEffect(() => {
    if (collapsed) {
      setFsnFlyoutVisible(fsnHovered || fsnFlyoutHovered || fsnFlyoutClicked);
    } else {
      setFsnFlyoutVisible(false);
      setFsnFlyoutClicked(false);
    }
  }, [collapsed, fsnHovered, fsnFlyoutHovered, fsnFlyoutClicked]);

  useEffect(() => {
    if (collapsed) {
      setRvpFlyoutVisible(rvpHovered || rvpFlyoutHovered || rvpFlyoutClicked);
    } else {
      setRvpFlyoutVisible(false);
      setRvpFlyoutClicked(false);
    }
  }, [collapsed, rvpHovered, rvpFlyoutHovered, rvpFlyoutClicked]);

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
    if (!rvpFlyoutClicked) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-rvp-flyout]") &&
        !target.closest("[data-rvp-button]")
      ) {
        setRvpFlyoutClicked(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rvpFlyoutClicked]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-mode", sidebarMode);
      localStorage.setItem("sidebar-collapsed", collapsed.toString());
    }
  }, [sidebarMode, collapsed]);

  const sidebarDrawerRef = useRef<HTMLDivElement | null>(null);
  const isInitialMount = useRef(true);

  useLayoutEffect(() => {
    const drawer = sidebarDrawerRef.current;
    if (!drawer) return;

    const applyScroll = (paper: HTMLDivElement) => {
      if (savedSidebarScrollTop > 0) {
        paper.scrollTop = savedSidebarScrollTop;
      }
      isInitialMount.current = false;
    };

    const paper = drawer.querySelector(".MuiDrawer-paper") as HTMLDivElement;
    if (paper) {
      applyScroll(paper);
    } else {
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
  }, []);

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

  const drawerWidth = collapsed ? 60 : 205;

  const rvpIconColors: Record<string, string> = {
    "/dashboard": "#60a5fa",
    "/inbound": "#34d399",
    "/qc": "#a78bfa",
    "/picking": "#fbbf24",
    "/outbound": "#f97316",
    "/reports": "#e879f9",
    "/settings/rejections": "#f87171",
    "/settings/master-data": "#60a5fa",
  };

  const standaloneIconColors: Record<string, string> = {
    "/customers": "#38bdf8",
    "/settings/warehouses": "#34d399",
  };

  const nlIconColors: Record<string, string> = {
    "/nl-fkt-os": "#38bdf8",
    "/nl-inbound": "#22d3ee",
    "/nl-stacking": "#a3e635",
    "/nl-qc": "#f472b6",
    "/nl-picking": "#3b82f6",
    "/nl-dispatch": "#fb923c",
    "/nl-summary": "#818cf8",
    "/nl-billing": "#14b8a6",
    "/nl-discrepancy": "#f87171",
  };

  const fsnIconColors: Record<string, string> = {
    "/fsn-scanning/master-data": "#f59e0b",
    "/fsn-scanning/entry": "#10b981",
    "/fsn-scanning/scanned-list": "#818cf8",
  };

  const settingsIconColors: Record<string, string> = {
    "/settings/racks": "#fbbf24",
    "/settings/users": "#38bdf8",
    "/settings/printers": "#a78bfa",
    "/settings/backups": "#f97316",
    "/settings/permissions": "#e879f9",
    "/settings/appearance": "#fb7185",
    "/settings/error-logs": "#f87171",
  };

  const allRvpLargeMenuItems = useMemo(
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
      {
        label: "Master Data",
        icon: StorageIcon,
        path: "/settings/master-data",
        code: "menu:settings:masterdata",
      },
    ],
    [],
  );

  const allStandaloneMenuItems = useMemo(
    () => [
      {
        label: "Customers",
        icon: GroupIcon,
        path: "/customers",
        code: "menu:customers",
      },
      {
        label: "Warehouses",
        icon: WarehouseIcon,
        path: "/settings/warehouses",
        code: "menu:settings:warehouses",
      },
    ],
    [],
  );

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

  const allSettingsMenuItems = useMemo(
    () => [
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

  const filterMenuByPermission = useCallback(
    <T extends { code: string }>(items: T[]) => {
      const user = getStoredUser();
      const isSuperAdmin = user?.role === "super_admin";
      if (isSuperAdmin) return items;
      if (permissionsLoading) return items;
      return items.filter((item) => canSeeMenu(item.code));
    },
    [canSeeMenu, permissionsLoading],
  );

  const rvpLargeMenu = useMemo(
    () => filterMenuByPermission(allRvpLargeMenuItems),
    [allRvpLargeMenuItems, filterMenuByPermission],
  );

  const standaloneMenu = useMemo(
    () => filterMenuByPermission(allStandaloneMenuItems),
    [allStandaloneMenuItems, filterMenuByPermission],
  );

  const settingsMenu = useMemo(
    () => filterMenuByPermission(allSettingsMenuItems),
    [allSettingsMenuItems, filterMenuByPermission],
  );

  const nlMenu = useMemo(
    () => filterMenuByPermission(allNLMenuItems),
    [allNLMenuItems, filterMenuByPermission],
  );

  const fsnMenu = useMemo(
    () => filterMenuByPermission(allFSNMenuItems),
    [allFSNMenuItems, filterMenuByPermission],
  );

  const navigate = (path: string) => {
    if (isMobile && setMobileOpen) setMobileOpen(false);
    if (pathname === path) return;

    const drawer = sidebarDrawerRef.current;
    if (drawer) {
      const paper = drawer.querySelector(".MuiDrawer-paper") as HTMLDivElement;
      if (paper) savedSidebarScrollTop = paper.scrollTop;
    }

    router.push(path);
  };

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    logout();
    router.push("/login");
  };

  const tooltipProps = {
    placement: "right" as const,
    arrow: true,
    slotProps: {
      tooltip: {
        sx: {
          bgcolor: "#111827",
          color: "white",
          fontSize: "0.78rem",
          fontWeight: 500,
          px: 1.25,
          py: 0.7,
          borderRadius: 1.25,
          boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.06)",
        },
      },
      arrow: {
        sx: {
          color: "#111827",
        },
      },
    },
  };

  const topLevelButtonSx = (isOpen = false) => ({
    mx: 0.45,
    minHeight: 34,
    py: 0.18,
    px: 0.95,
    borderRadius: 2,
    color: isOpen ? "#f8fafc" : "rgba(255,255,255,0.78)",
    bgcolor: isOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.015)",
    border: "1px solid rgba(255,255,255,0.045)",
    transition: "all 0.16s ease",
    "&:hover": {
      bgcolor: isOpen ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.065)",
    },
  });

  const getStandaloneButtonSx = (active: boolean) => ({
    mx: 0.45,
    minHeight: 33,
    py: 0.16,
    px: 0.95,
    borderRadius: 2,
    bgcolor: active ? "rgba(59,130,246,0.13)" : "rgba(255,255,255,0.015)",
    color: active ? "#ffffff" : "rgba(255,255,255,0.78)",
    border: active
      ? "1px solid rgba(96,165,250,0.18)"
      : "1px solid rgba(255,255,255,0.04)",
    transition: "all 0.16s ease",
    "&:hover": {
      bgcolor: active ? "rgba(59,130,246,0.16)" : "rgba(255,255,255,0.04)",
    },
  });

  const renderStandaloneItem = (
    item: {
      label: string;
      icon: React.ElementType;
      path: string;
    },
    colorMap: Record<string, string>,
  ) => {
    const Icon = item.icon;
    const active =
      pathname === item.path || pathname.startsWith(item.path + "/");

    const buttonContent = (
      <ListItem key={item.path} disablePadding sx={{ mb: 0.05 }}>
        <ListItemButton
          onClick={() => navigate(item.path)}
          sx={getStandaloneButtonSx(active)}
        >
          <ListItemIcon
            sx={{
              color: active
                ? "#ffffff"
                : colorMap[item.path] || "rgba(255,255,255,0.72)",
              minWidth: collapsed ? "auto" : 34,
              justifyContent: collapsed ? "center" : "flex-start",
              pointerEvents: "none",
              transition:
                "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
            }}
          >
            <Icon sx={{ fontSize: 19 }} />
          </ListItemIcon>

          {!collapsed && (
            <ListItemText
              primary={item.label}
              sx={{
                pointerEvents: "none",
                opacity: collapsed ? 0 : 1,
                transition: "opacity 0.2s ease",
                whiteSpace: "nowrap",
              }}
              primaryTypographyProps={{
                fontSize: "0.845rem",
                fontWeight: active ? 600 : 500,
              }}
            />
          )}
        </ListItemButton>
      </ListItem>
    );

    return collapsed && !isMobile ? (
      <Tooltip key={item.path} title={item.label} {...tooltipProps}>
        {buttonContent}
      </Tooltip>
    ) : (
      buttonContent
    );
  };

  const renderSubMenuItems = (
    items: Array<{ label: string; icon: React.ElementType; path: string }>,
    colorMap: Record<string, string>,
    activeBg = "rgba(59,130,246,0.12)",
    hoverBg = "rgba(255,255,255,0.05)",
    borderColor = "#60a5fa",
  ) => (
    <List
      sx={{
        pl: 1.55,
        pr: 0.7,
        py: 0.18,
        mx: 0.7,
        mt: 0.15,
        mb: 0.35,
        borderRadius: 2,
        bgcolor: "rgba(255,255,255,0.022)",
        border: "1px solid rgba(255,255,255,0.035)",
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.path || pathname.startsWith(item.path + "/");

        return (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.12 }}>
            <ListItemButton
              onClick={() => navigate(item.path)}
              sx={{
                minHeight: 30,
                py: 0.14,
                px: 0.82,
                borderRadius: 1.6,
                color: active ? "#fff" : "rgba(255,255,255,0.68)",
                bgcolor: active ? activeBg : "transparent",
                border: active
                  ? `1px solid ${borderColor}20`
                  : "1px solid transparent",
                boxShadow: "none",
                transition: "all 0.16s ease",
                touchAction: "manipulation",
                cursor: "pointer",
                userSelect: "none",
                WebkitTapHighlightColor: "transparent",
                "&:hover": {
                  bgcolor: active ? activeBg : hoverBg,
                },
                "&:active": {
                  bgcolor: active ? activeBg : "rgba(255,255,255,0.08)",
                  transform: "scale(0.99)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: active
                    ? "#fff"
                    : colorMap[item.path] || "rgba(255,255,255,0.7)",
                  minWidth: 28,
                  pointerEvents: "none",
                  transition: "color 0.15s ease",
                }}
              >
                <Icon sx={{ fontSize: 17 }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                sx={{ pointerEvents: "none" }}
                primaryTypographyProps={{
                  fontSize: "0.8rem",
                  fontWeight: active ? 600 : 450,
                }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );

  const renderFlyoutItems = (
    title: string,
    items: Array<{ label: string; icon: React.ElementType; path: string }>,
    colorMap: Record<string, string>,
    onClose: () => void,
    activeBg = "rgba(59,130,246,0.16)",
    hoverBg = "rgba(255,255,255,0.06)",
    borderColor = "#60a5fa",
  ) => (
    <>
      <Typography
        sx={{
          px: 1,
          pb: 0.8,
          pt: 0.25,
          fontSize: 11,
          fontWeight: 700,
          opacity: 0.52,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </Typography>

      <List sx={{ py: 0 }}>
        {items.map((item) => {
          const Icon = item.icon;
          const flyoutActive =
            pathname === item.path || pathname.startsWith(item.path + "/");

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.12 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
                sx={{
                  borderRadius: 1.8,
                  color: flyoutActive ? "#fff" : "rgba(255,255,255,0.82)",
                  bgcolor: flyoutActive ? activeBg : "transparent",
                  border: flyoutActive
                    ? `1px solid ${borderColor}22`
                    : "1px solid rgba(255,255,255,0.02)",
                  py: 0.56,
                  px: 1.2,
                  transition: "all 0.16s ease",
                  touchAction: "manipulation",
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: flyoutActive ? activeBg : hoverBg,
                  },
                  "&:active": { bgcolor: "rgba(255,255,255,0.12)" },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: flyoutActive
                      ? "#fff"
                      : colorMap[item.path] || "rgba(255,255,255,0.7)",
                    minWidth: 30,
                    pointerEvents: "none",
                    transition: "color 0.15s ease",
                  }}
                >
                  <Icon sx={{ fontSize: 17 }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  sx={{ pointerEvents: "none" }}
                  primaryTypographyProps={{
                    fontSize: "0.82rem",
                    fontWeight: flyoutActive ? 600 : 450,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </>
  );

  const drawerContent = (
    <>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          bgcolor: "rgba(15,23,42,0.9)",
          backdropFilter: "blur(10px)",
          pb: 0.55,
        }}
      >
        <Toolbar
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.05,
            minHeight: { xs: 54, sm: 58 },
            px: { xs: 1.2, sm: 1.35 },
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
              ml: -0.2,
              width: 34,
              height: 34,
              borderRadius: 2,
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.08)",
              },
            }}
          >
            <MenuIcon sx={{ fontSize: 20 }} />
          </IconButton>

          {!collapsed && (
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, ml: 0.15 }}
            >
              <TypingTitle
                text="Divine WMS"
                variant="h4"
                pulseKey={titlePulse}
                sx={{
                  fontWeight: 800,
                  fontSize: "1.02rem",
                  letterSpacing: "0.2px",
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
                  bgcolor: "rgba(255,255,255,0.08)",
                },
              }}
              onClick={() => setMobileOpen && setMobileOpen(false)}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Toolbar>
      </Box>

      <List sx={{ px: 0.25, py: 0.2 }}>
        {renderStandaloneItem(
          { label: "Home", icon: HomeIcon, path: "/home" },
          { "/home": "#c7d2fe" },
        )}

        {rvpLargeMenu.length > 0 && (
          <>
            <Tooltip
              title={collapsed && !isMobile ? "RVP Large" : ""}
              {...tooltipProps}
            >
              <ListItem
                disablePadding
                ref={rvpButtonRef}
                data-rvp-button
                onMouseEnter={() => setRvpHovered(true)}
                onMouseLeave={() => setRvpHovered(false)}
                sx={{ mb: 0.25 }}
              >
                <ListItemButton
                  onClick={() => {
                    if (collapsed) {
                      setRvpFlyoutClicked((prev) => !prev);
                    } else {
                      setRvpLargeOpen(!rvpLargeOpen);
                    }
                  }}
                  sx={topLevelButtonSx(rvpFlyoutVisible || rvpLargeOpen)}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        rvpFlyoutVisible || rvpLargeOpen
                          ? "#93c5fd"
                          : "#7dd3fc",
                      minWidth: collapsed ? "auto" : 34,
                      justifyContent: collapsed ? "center" : "flex-start",
                      pointerEvents: "none",
                      transition:
                        "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
                    }}
                  >
                    <RvpLargeIcon sx={{ fontSize: 19 }} />
                  </ListItemIcon>

                  {!collapsed && (
                    <>
                      <ListItemText
                        primary="RVP Large"
                        sx={{
                          pointerEvents: "none",
                          opacity: collapsed ? 0 : 1,
                          transition: "opacity 0.2s ease",
                          whiteSpace: "nowrap",
                        }}
                        primaryTypographyProps={{
                          fontSize: "0.84rem",
                          fontWeight: 600,
                        }}
                      />
                      {rvpLargeOpen ? (
                        <ExpandLess
                          sx={{ pointerEvents: "none", fontSize: 18 }}
                        />
                      ) : (
                        <ExpandMore
                          sx={{ pointerEvents: "none", fontSize: 18 }}
                        />
                      )}
                    </>
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>

            <AnimatePresence initial={false}>
              {rvpLargeOpen && (!collapsed || isMobile) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: isInitialMount.current ? 0 : 0.18 }}
                  style={{ overflow: "hidden" }}
                >
                  {renderSubMenuItems(rvpLargeMenu, rvpIconColors)}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {nlMenu.length > 0 && (
          <>
            <Box sx={{ height: 0 }} />
            <Tooltip
              title={collapsed && !isMobile ? "Non-Large" : ""}
              {...tooltipProps}
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
                  sx={topLevelButtonSx(nlFlyoutVisible || nlOpen)}
                >
                  <ListItemIcon
                    sx={{
                      color: nlFlyoutVisible || nlOpen ? "#67e8f9" : "#38bdf8",
                      minWidth: collapsed ? "auto" : 34,
                      justifyContent: collapsed ? "center" : "flex-start",
                      pointerEvents: "none",
                      transition:
                        "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
                    }}
                  >
                    <NLIcon sx={{ fontSize: 19 }} />
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
                          fontSize: "0.84rem",
                          fontWeight: 600,
                        }}
                      />
                      {nlOpen ? (
                        <ExpandLess
                          sx={{ pointerEvents: "none", fontSize: 18 }}
                        />
                      ) : (
                        <ExpandMore
                          sx={{ pointerEvents: "none", fontSize: 18 }}
                        />
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
                  transition={{ duration: isInitialMount.current ? 0 : 0.18 }}
                  style={{ overflow: "hidden" }}
                >
                  {renderSubMenuItems(
                    nlMenu,
                    nlIconColors,
                    "rgba(34,211,238,0.11)",
                    "rgba(255,255,255,0.05)",
                    "#22d3ee",
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {fsnMenu.length > 0 && (
          <>
            <Box sx={{ height: 0 }} />
            <Tooltip
              title={collapsed && !isMobile ? "FSN Scanning" : ""}
              {...tooltipProps}
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
                  sx={topLevelButtonSx(fsnFlyoutVisible || fsnOpen)}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        fsnFlyoutVisible || fsnOpen ? "#34d399" : "#f59e0b",
                      minWidth: collapsed ? "auto" : 34,
                      justifyContent: collapsed ? "center" : "flex-start",
                      pointerEvents: "none",
                      transition:
                        "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
                    }}
                  >
                    <AssignmentIcon sx={{ fontSize: 19 }} />
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
                          fontSize: "0.84rem",
                          fontWeight: 600,
                        }}
                      />
                      {fsnOpen ? (
                        <ExpandLess
                          sx={{ pointerEvents: "none", fontSize: 18 }}
                        />
                      ) : (
                        <ExpandMore
                          sx={{ pointerEvents: "none", fontSize: 18 }}
                        />
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
                  transition={{ duration: isInitialMount.current ? 0 : 0.18 }}
                  style={{ overflow: "hidden" }}
                >
                  {renderSubMenuItems(
                    fsnMenu,
                    fsnIconColors,
                    "rgba(16,185,129,0.11)",
                    "rgba(255,255,255,0.05)",
                    "#10b981",
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {standaloneMenu.length > 0 && (
          <>
            <Box sx={{ height: 0 }} />
            {standaloneMenu.map((item) =>
              renderStandaloneItem(item, standaloneIconColors),
            )}
          </>
        )}

        {settingsMenu.length > 0 && (
          <>
            <Box sx={{ height: 0 }} />
            <Tooltip
              title={collapsed && !isMobile ? "Settings" : ""}
              {...tooltipProps}
            >
              <ListItem
                disablePadding
                ref={settingsButtonRef}
                data-settings-button
                onMouseEnter={() => setSettingsHovered(true)}
                onMouseLeave={() => setSettingsHovered(false)}
                sx={{ mb: 0.25 }}
              >
                <ListItemButton
                  onClick={() => {
                    if (collapsed) {
                      setSettingsFlyoutClicked((prev) => !prev);
                    } else {
                      setSettingsOpen(!settingsOpen);
                    }
                  }}
                  sx={topLevelButtonSx(flyoutVisible || settingsOpen)}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        flyoutVisible || settingsOpen ? "#e9d5ff" : "#c4b5fd",
                      minWidth: collapsed ? "auto" : 34,
                      justifyContent: collapsed ? "center" : "flex-start",
                      pointerEvents: "none",
                      transition:
                        "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease",
                    }}
                  >
                    <SettingsIcon sx={{ fontSize: 19 }} />
                  </ListItemIcon>

                  {!collapsed && (
                    <>
                      <ListItemText
                        primary="Settings"
                        sx={{
                          pointerEvents: "none",
                          opacity: collapsed ? 0 : 1,
                          transition: "opacity 0.2s ease",
                          whiteSpace: "nowrap",
                        }}
                        primaryTypographyProps={{
                          fontSize: "0.84rem",
                          fontWeight: 600,
                        }}
                      />
                      {settingsOpen ? (
                        <ExpandLess
                          sx={{ pointerEvents: "none", fontSize: 18 }}
                        />
                      ) : (
                        <ExpandMore
                          sx={{ pointerEvents: "none", fontSize: 18 }}
                        />
                      )}
                    </>
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>

            <AnimatePresence initial={false}>
              {settingsOpen && (!collapsed || isMobile) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: isInitialMount.current ? 0 : 0.18 }}
                  style={{ overflow: "hidden" }}
                >
                  {renderSubMenuItems(
                    settingsMenu,
                    settingsIconColors,
                    "rgba(99,102,241,0.12)",
                    "rgba(255,255,255,0.05)",
                    "#818cf8",
                  )}

                  <List sx={{ px: 0.7, pb: 0.25, mt: -0.1 }}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={handleLogout}
                        sx={{
                          mx: 0,
                          minHeight: 34,
                          py: 0.28,
                          px: 1.05,
                          borderRadius: 1.8,
                          color: "#fca5a5",
                          bgcolor: "rgba(239,68,68,0.02)",
                          border: "1px solid rgba(248,113,113,0.08)",
                          transition: "all 0.16s ease",
                          touchAction: "manipulation",
                          cursor: "pointer",
                          userSelect: "none",
                          WebkitTapHighlightColor: "transparent",
                          "&:hover": {
                            bgcolor: "rgba(239,68,68,0.1)",
                            color: "#fecaca",
                          },
                          "&:active": {
                            bgcolor: "rgba(239,68,68,0.16)",
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: "#f87171",
                            minWidth: 28,
                            pointerEvents: "none",
                          }}
                        >
                          <LogoutIcon sx={{ fontSize: 17 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary="Logout"
                          sx={{ pointerEvents: "none" }}
                          primaryTypographyProps={{
                            fontSize: "0.8rem",
                            fontWeight: 500,
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {!isMobile &&
        (() => {
          const isExpandedMode = sidebarMode === "expanded";
          const isCollapsedMode = sidebarMode === "collapsed";
          const isHoverMode = sidebarMode === "hover";

          return (
            <Tooltip
              title={collapsed ? "Sidebar control" : ""}
              {...tooltipProps}
            >
              <Box sx={{ px: 0.95, mt: 3, pb: 0.7 }}>
                <Box
                  sx={{
                    borderRadius: 2.2,
                    bgcolor: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    p: 0.45,
                  }}
                >
                  <ListItemButton
                    onClick={() => setSidebarControlOpen(!sidebarControlOpen)}
                    sx={{
                      py: 0.55,
                      px: 1.05,
                      minHeight: 36,
                      borderRadius: 1.8,
                      color: "rgba(255,255,255,0.66)",
                      bgcolor: sidebarControlOpen
                        ? "rgba(255,255,255,0.05)"
                        : "transparent",
                      transition: "all 0.16s ease",
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.07)",
                        color: "rgba(255,255,255,0.9)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: "inherit",
                        minWidth: collapsed ? "auto" : 30,
                        transition:
                          "min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      <SidebarIcon sx={{ fontSize: 17 }} />
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
                            fontSize: "0.79rem",
                            fontWeight: 500,
                          }}
                        />
                        {sidebarControlOpen ? (
                          <ExpandLess sx={{ fontSize: 17 }} />
                        ) : (
                          <ExpandMore sx={{ fontSize: 17 }} />
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
                        <Box sx={{ pl: 0.4, pr: 0.2, py: 0.3 }}>
                          <ListItemButton
                            onClick={() => setSidebarMode("expanded")}
                            sx={{
                              py: 0.45,
                              px: 0.9,
                              minHeight: 32,
                              borderRadius: 1.4,
                              color: isExpandedMode
                                ? "#60a5fa"
                                : "rgba(255,255,255,0.7)",
                              bgcolor: isExpandedMode
                                ? "rgba(59,130,246,0.12)"
                                : "transparent",
                              "&:hover": {
                                bgcolor: isExpandedMode
                                  ? "rgba(59,130,246,0.16)"
                                  : "rgba(255,255,255,0.05)",
                              },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                gap: 1.1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: isExpandedMode
                                    ? "#60a5fa"
                                    : "transparent",
                                  border: isExpandedMode
                                    ? "none"
                                    : "1px solid rgba(255,255,255,0.28)",
                                }}
                              />
                              <ExpandIcon sx={{ fontSize: 15, opacity: 0.8 }} />
                              <Typography
                                sx={{
                                  fontSize: "0.79rem",
                                  fontWeight: isExpandedMode ? 600 : 400,
                                }}
                              >
                                Expanded
                              </Typography>
                            </Box>
                          </ListItemButton>

                          <ListItemButton
                            onClick={() => setSidebarMode("collapsed")}
                            sx={{
                              py: 0.45,
                              px: 0.9,
                              minHeight: 32,
                              borderRadius: 1.4,
                              color: isCollapsedMode
                                ? "#60a5fa"
                                : "rgba(255,255,255,0.7)",
                              bgcolor: isCollapsedMode
                                ? "rgba(59,130,246,0.12)"
                                : "transparent",
                              "&:hover": {
                                bgcolor: isCollapsedMode
                                  ? "rgba(59,130,246,0.16)"
                                  : "rgba(255,255,255,0.05)",
                              },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                gap: 1.1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: isCollapsedMode
                                    ? "#60a5fa"
                                    : "transparent",
                                  border: isCollapsedMode
                                    ? "none"
                                    : "1px solid rgba(255,255,255,0.28)",
                                }}
                              />
                              <CollapseIcon
                                sx={{ fontSize: 15, opacity: 0.8 }}
                              />
                              <Typography
                                sx={{
                                  fontSize: "0.79rem",
                                  fontWeight: isCollapsedMode ? 600 : 400,
                                }}
                              >
                                Collapsed
                              </Typography>
                            </Box>
                          </ListItemButton>

                          <ListItemButton
                            onClick={() => setSidebarMode("hover")}
                            sx={{
                              py: 0.45,
                              px: 0.9,
                              minHeight: 32,
                              borderRadius: 1.4,
                              color: isHoverMode
                                ? "#60a5fa"
                                : "rgba(255,255,255,0.7)",
                              bgcolor: isHoverMode
                                ? "rgba(59,130,246,0.12)"
                                : "transparent",
                              "&:hover": {
                                bgcolor: isHoverMode
                                  ? "rgba(59,130,246,0.16)"
                                  : "rgba(255,255,255,0.05)",
                              },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                gap: 1.1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: isHoverMode
                                    ? "#60a5fa"
                                    : "transparent",
                                  border: isHoverMode
                                    ? "none"
                                    : "1px solid rgba(255,255,255,0.28)",
                                }}
                              />
                              <HoverIcon sx={{ fontSize: 15, opacity: 0.8 }} />
                              <Typography
                                sx={{
                                  fontSize: "0.79rem",
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
              </Box>
            </Tooltip>
          );
        })()}

      {!collapsed && (
        <Box
          sx={{
            px: 1,
            pb: 1.05,
            pt: 0.4,
          }}
        >
          <Box
            sx={{
              mt: 0.55,
              mx: 0.15,
              px: 1,
              py: 0.9,
              borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255,255,255,0.45)",
                fontSize: "0.71rem",
                display: "block",
              }}
            >
              Logged in as
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "rgba(255,255,255,0.88)",
                fontWeight: 600,
                fontSize: "0.81rem",
                mt: 0.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userName}
            </Typography>
          </Box>
        </Box>
      )}
    </>
  );

  return (
    <>
      {isMobile ? (
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
              width: 258,
              background:
                "linear-gradient(180deg, #0f172a 0%, #111827 55%, #0f172a 100%)",
              color: "white",
              left: 0,
              position: "fixed",
              borderRight: "1px solid rgba(148,163,184,0.1)",
              boxShadow: "8px 0 28px rgba(2,6,23,0.3)",
              paddingBottom: "env(safe-area-inset-bottom)",
              overflowAnchor: "none",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.18) transparent",
              "&::-webkit-scrollbar": {
                width: "4px",
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: "10px",
              },
            },
            "& .MuiBackdrop-root": {
              backgroundColor: "rgba(0, 0, 0, 0.46)",
            },
          }}
          transitionDuration={{
            enter: 225,
            exit: 195,
          }}
        >
          {drawerContent}
        </Drawer>
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
                "linear-gradient(180deg, #0f172a 0%, #111827 58%, #0f172a 100%)",
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
              borderRight: "1px solid rgba(148,163,184,0.08)",
              boxShadow:
                sidebarMode === "hover" && isHovering
                  ? "8px 0 28px rgba(2,6,23,0.22)"
                  : "2px 0 14px rgba(2,6,23,0.08)",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.18) transparent",
              "&::-webkit-scrollbar": {
                width: "5px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: "10px",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.28)",
                },
              },
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {rvpFlyoutVisible && collapsed && !isMobile && (
        <Portal>
          <Paper
            ref={rvpFlyoutRef}
            data-rvp-flyout
            onMouseEnter={() => setRvpFlyoutHovered(true)}
            onMouseLeave={() => setRvpFlyoutHovered(false)}
            elevation={24}
            sx={{
              position: "fixed",
              top: rvpFlyoutTop,
              left: drawerWidth + 8,
              width: 228,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              background: "#111827",
              color: "white",
              py: 1.1,
              px: 0.8,
              borderRadius: 2.2,
              zIndex: 99999,
              boxShadow: "0 12px 32px rgba(0,0,0,0.38)",
              border: "1px solid rgba(255,255,255,0.08)",
              animation: "flyoutIn 0.14s ease-out",
              "@keyframes flyoutIn": {
                "0%": { opacity: 0, transform: "translateX(-8px) scale(0.97)" },
                "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
              },
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.18) transparent",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: "10px",
              },
            }}
          >
            {renderFlyoutItems("RVP Large", rvpLargeMenu, rvpIconColors, () =>
              setRvpFlyoutClicked(false),
            )}
          </Paper>
        </Portal>
      )}

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
              left: drawerWidth + 8,
              width: 228,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              background: "#111827",
              color: "white",
              py: 1.1,
              px: 0.8,
              borderRadius: 2.2,
              zIndex: 99999,
              boxShadow: "0 12px 32px rgba(0,0,0,0.38)",
              border: "1px solid rgba(255,255,255,0.08)",
              animation: "flyoutIn 0.14s ease-out",
              "@keyframes flyoutIn": {
                "0%": { opacity: 0, transform: "translateX(-8px) scale(0.97)" },
                "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
              },
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.18) transparent",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: "10px",
              },
            }}
          >
            {renderFlyoutItems("Non-Large", nlMenu, nlIconColors, () =>
              setNlFlyoutClicked(false),
            )}
          </Paper>
        </Portal>
      )}

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
              left: drawerWidth + 8,
              width: 228,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              background: "#111827",
              color: "white",
              py: 1.1,
              px: 0.8,
              borderRadius: 2.2,
              zIndex: 99999,
              boxShadow: "0 12px 32px rgba(0,0,0,0.38)",
              border: "1px solid rgba(255,255,255,0.08)",
              animation: "flyoutIn 0.14s ease-out",
              "@keyframes flyoutIn": {
                "0%": { opacity: 0, transform: "translateX(-8px) scale(0.97)" },
                "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
              },
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.18) transparent",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: "10px",
              },
            }}
          >
            {renderFlyoutItems(
              "Settings",
              settingsMenu,
              settingsIconColors,
              () => setSettingsFlyoutClicked(false),
              "rgba(99,102,241,0.16)",
              "rgba(255,255,255,0.06)",
              "#818cf8",
            )}

            <Box sx={{ height: 0 }} />

            <ListItem disablePadding sx={{ mt: 0.1 }}>
              <ListItemButton
                onClick={() => {
                  handleLogout();
                  setSettingsFlyoutClicked(false);
                }}
                sx={{
                  borderRadius: 1.8,
                  color: "#fca5a5",
                  py: 0.56,
                  px: 1.2,
                  border: "1px solid rgba(248,113,113,0.08)",
                  bgcolor: "rgba(239,68,68,0.02)",
                  transition: "all 0.16s ease",
                  touchAction: "manipulation",
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "rgba(239, 68, 68, 0.12)",
                  },
                  "&:active": {
                    bgcolor: "rgba(239, 68, 68, 0.18)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: "#f87171",
                    minWidth: 30,
                    pointerEvents: "none",
                  }}
                >
                  <LogoutIcon sx={{ fontSize: 17 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Logout"
                  sx={{ pointerEvents: "none" }}
                  primaryTypographyProps={{
                    fontSize: "0.82rem",
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          </Paper>
        </Portal>
      )}

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
              left: drawerWidth + 8,
              width: 228,
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              background: "#111827",
              color: "white",
              py: 1.1,
              px: 0.8,
              borderRadius: 2.2,
              zIndex: 99999,
              boxShadow: "0 12px 32px rgba(0,0,0,0.38)",
              border: "1px solid rgba(255,255,255,0.08)",
              animation: "flyoutIn 0.14s ease-out",
              "@keyframes flyoutIn": {
                "0%": { opacity: 0, transform: "translateX(-8px) scale(0.97)" },
                "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
              },
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.18) transparent",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: "10px",
              },
            }}
          >
            {renderFlyoutItems(
              "FSN Scanning",
              fsnMenu,
              fsnIconColors,
              () => setFsnFlyoutClicked(false),
              "rgba(16,185,129,0.16)",
              "rgba(255,255,255,0.06)",
              "#10b981",
            )}
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
