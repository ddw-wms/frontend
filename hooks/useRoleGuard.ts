// File Path = warehouse-frontend/hooks/useRoleGuard.ts
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from '@/lib/auth';
import toast from 'react-hot-toast';

export const useRoleGuard = (allowedRoles: string[], redirectTo: string = '/dashboard') => {
    const router = useRouter();

    useEffect(() => {
        const user = getStoredUser();

        if (!user) {
            toast.error('Please login to access this page');
            router.push('/login');
            return;
        }

        if (!allowedRoles.includes(user.role)) {
            toast.error(`Access denied: ${allowedRoles.join(' or ')} role required`);
            router.push(redirectTo);
            return;
        }
    }, [allowedRoles, redirectTo, router]);
};

export const checkRole = (allowedRoles: string[]): boolean => {
    const user = getStoredUser();
    return user ? allowedRoles.includes(user.role) : false;
};
