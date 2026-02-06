// useFullscreen.ts - Hook for maximizing Multi Entry grids to fill viewport
import { useState, useCallback, useEffect, RefObject } from 'react';

interface UseFullscreenReturn {
    isFullscreen: boolean;
    toggleFullscreen: () => void;
    enterFullscreen: () => void;
    exitFullscreen: () => void;
}

// Store original styles to restore later
interface OriginalStyles {
    position: string;
    top: string;
    left: string;
    right: string;
    bottom: string;
    width: string;
    height: string;
    zIndex: string;
    background: string;
    overflow: string;
}

/**
 * Hook to maximize an element to fill the viewport (CSS-based, keeps browser tabs visible)
 * 
 * @param elementRef - Reference to the element to maximize
 * @returns Object with fullscreen state and control functions
 */
export function useFullscreen(elementRef: RefObject<HTMLElement | null>): UseFullscreenReturn {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [originalStyles, setOriginalStyles] = useState<OriginalStyles | null>(null);

    // Handle Escape key to exit maximized mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                exitFullscreen();
            }
        };

        if (isFullscreen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    const enterFullscreen = useCallback(() => {
        const element = elementRef.current;
        if (!element || isFullscreen) return;

        // Save original styles
        const computed = window.getComputedStyle(element);
        setOriginalStyles({
            position: element.style.position || '',
            top: element.style.top || '',
            left: element.style.left || '',
            right: element.style.right || '',
            bottom: element.style.bottom || '',
            width: element.style.width || '',
            height: element.style.height || '',
            zIndex: element.style.zIndex || '',
            background: element.style.background || '',
            overflow: element.style.overflow || '',
        });

        // Apply maximized styles
        element.style.position = 'fixed';
        element.style.top = '0';
        element.style.left = '0';
        element.style.right = '0';
        element.style.bottom = '0';
        element.style.width = '100vw';
        element.style.height = '100vh';
        element.style.zIndex = '9999';
        element.style.background = computed.backgroundColor || '#f8fafc';
        element.style.overflow = 'auto';

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        setIsFullscreen(true);
    }, [elementRef, isFullscreen]);

    const exitFullscreen = useCallback(() => {
        const element = elementRef.current;
        if (!element || !isFullscreen) return;

        // Restore original styles
        if (originalStyles) {
            element.style.position = originalStyles.position;
            element.style.top = originalStyles.top;
            element.style.left = originalStyles.left;
            element.style.right = originalStyles.right;
            element.style.bottom = originalStyles.bottom;
            element.style.width = originalStyles.width;
            element.style.height = originalStyles.height;
            element.style.zIndex = originalStyles.zIndex;
            element.style.background = originalStyles.background;
            element.style.overflow = originalStyles.overflow;
        }

        // Restore body scroll
        document.body.style.overflow = '';

        setIsFullscreen(false);
        setOriginalStyles(null);
    }, [elementRef, isFullscreen, originalStyles]);

    const toggleFullscreen = useCallback(() => {
        if (isFullscreen) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    }, [isFullscreen, enterFullscreen, exitFullscreen]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isFullscreen) {
                document.body.style.overflow = '';
            }
        };
    }, [isFullscreen]);

    return {
        isFullscreen,
        toggleFullscreen,
        enterFullscreen,
        exitFullscreen,
    };
}

export default useFullscreen;
