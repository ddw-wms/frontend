// File Path = warehouse-frontend\hooks\useAuthGuard.ts
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const useAuthGuard = () => {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      if (!token) router.replace("/login");
    };

    checkAuth();

    // re-check on tab visibility change (tab switch)
    document.addEventListener("visibilitychange", checkAuth);

    return () => {
      document.removeEventListener("visibilitychange", checkAuth);
    };
  }, [router]);
};
