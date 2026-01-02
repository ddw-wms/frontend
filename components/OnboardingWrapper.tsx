'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import OnboardingWizard from './OnboardingWizard';
import { isAuthenticated } from '@/lib/auth';

interface OnboardingWrapperProps {
    children: React.ReactNode;
}

export default function OnboardingWrapper({ children }: OnboardingWrapperProps) {
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        checkOnboardingStatus();
    }, [pathname]);

    const checkOnboardingStatus = () => {
        // CRITICAL: Don't show onboarding on login page or if not authenticated
        const isLoginPage = pathname === '/login' || pathname === '/';
        const userAuthenticated = isAuthenticated();

        if (isLoginPage || !userAuthenticated) {
            setShowOnboarding(false);
            setIsChecking(false);
            return;
        }

        // Check if user has completed onboarding
        const onboardingCompleted = localStorage.getItem('onboarding_completed');
        const selectedWarehouse = localStorage.getItem('selectedWarehouse');

        // Show onboarding only if:
        // 1. User IS authenticated
        // 2. User hasn't completed onboarding before
        // 3. AND no warehouse is selected
        const shouldShowOnboarding = !onboardingCompleted && !selectedWarehouse;

        setShowOnboarding(shouldShowOnboarding);
        setIsChecking(false);
    };

    const handleOnboardingComplete = () => {
        setShowOnboarding(false);
    };

    // Don't render anything while checking to avoid flash
    if (isChecking) {
        return null;
    }

    return (
        <>
            {children}
            <OnboardingWizard
                open={showOnboarding}
                onComplete={handleOnboardingComplete}
            />
        </>
    );
}
