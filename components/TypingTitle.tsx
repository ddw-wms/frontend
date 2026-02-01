// key additions: new prop pulseKey?: number and effect that triggers animation on pulseKey changes
import React, { useMemo, useEffect, useRef } from 'react';
import { Typography, SxProps, Theme } from '@mui/material';
import { motion, Variants, useReducedMotion, useAnimation } from 'framer-motion';

type TypingTitleProps = {
    text?: string;
    variant?: any;
    stagger?: number;
    className?: string;
    sx?: SxProps<Theme>;
    pulseKey?: number; // new
};

const containerVariants: Variants = {
    initial: {},
    animate: (stagger = 0.04) => ({ transition: { staggerChildren: stagger } }),
};

const charVariants: Variants = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
    visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

export default function TypingTitle({
    text = 'Divine WMS',
    variant = 'h4',
    stagger = 0.04,
    className,
    sx,
    pulseKey,
}: TypingTitleProps) {
    const reduced = useReducedMotion();
    const letters = useMemo(() => text.split(''), [text]);
    const effectiveStagger = reduced ? 0 : stagger;
    const controls = useAnimation();
    const didMountRef = useRef(false);
    const prevPulseRef = useRef<number | undefined>(pulseKey);

    // initial mount -> show final text without typing
    useEffect(() => {
        didMountRef.current = true;
        controls.set('visible');
    }, [controls]);

    // animate only when pulseKey changes AFTER mount
    useEffect(() => {
        if (!didMountRef.current) return;
        if (pulseKey === undefined) return;
        if (pulseKey === prevPulseRef.current) return;

        prevPulseRef.current = pulseKey;
        if (reduced) {
            controls.set('visible');
            return;
        }

        controls.set('initial');
        controls.start('animate');
    }, [pulseKey, controls, reduced]);

    return (
        <motion.div
            initial="initial"
            animate="animate"
            variants={containerVariants}
            custom={effectiveStagger}
            style={{ display: 'inline-block', lineHeight: 1 }}
            onDragStart={(e) => e.preventDefault()}
            role="heading"
            aria-label={text}
        >
            <Typography
                variant={variant}
                component="span"
                className={className}
                sx={{
                    display: 'inline-block',
                    whiteSpace: 'pre',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    cursor: 'default',
                    ...((sx as any) || {}),
                }}
            >
                {letters.map((ch, i) => (
                    <motion.span
                        key={i}
                        aria-hidden
                        variants={charVariants}
                        animate={controls}
                        style={{
                            display: 'inline-block',
                            color: 'inherit',
                            fontWeight: 'inherit',
                            fontSize: 'inherit',
                            lineHeight: 1,
                        }}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                    >
                        {ch === ' ' ? '\u00A0' : ch}
                    </motion.span>
                ))}
            </Typography>
        </motion.div>
    );
}