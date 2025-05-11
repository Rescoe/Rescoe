import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import HeroSection and Carousel
const HeroSection = dynamic(() => import('./HeroSection'), { ssr: false });
const DynamicCarousel = dynamic(() => import('./DynamicCarousel'), { ssr: false });

const Loading = ({ onFinish }: { onFinish?: () => void }) => {
    const [visible, setVisible] = useState(true);
    const [componentsLoaded, setComponentsLoaded] = useState(false);

    const insectCount = 30; // Increase the count for more fireflies
    const insectStyle = {
        position: 'absolute' as const,
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 200, 0.8)', // Color of the fireflies
        boxShadow: '0 0 20px rgba(255, 255, 200, 1)', // Glow effect
        pointerEvents: 'none' as const, // Ensure they don't block user interactions
    };

    const containerStyle = {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: visible ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black',
        overflow: 'hidden',
        zIndex: 9999,
    };

    useEffect(() => {
        const timeout = setTimeout(async () => {
            // Load components dynamically
            await Promise.all([HeroSection, DynamicCarousel]); // Wait for both components to load
            setComponentsLoaded(true); // Mark components as loaded

            setVisible(false); // Hide loading after components are loaded
            if (onFinish) onFinish();
        }, 4000); // Set a timeout for ~4 seconds

        // Create fireflies
        for (let i = 0; i < insectCount; i++) {
            createFirefly();
        }

        return () => clearTimeout(timeout); // Clean up timeout
    }, []); // Empty dependency array to run only once on mount

    const createFirefly = () => {
        const firefly = document.createElement('div');
        Object.assign(firefly.style, insectStyle);
        document.body.appendChild(firefly); // Add to body, not the container
        animateFirefly(firefly);
    };

    const animateFirefly = (firefly: HTMLDivElement) => {
        const move = () => {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            const size = Math.random() * 12 + 8; // Vary the size of the fireflies
            firefly.style.width = `${size}px`;
            firefly.style.height = `${size}px`;
            firefly.style.transition = `transform ${1 + Math.random()}s ease-in-out, opacity ${1 + Math.random()}s ease-in-out`;
            firefly.style.transform = `translate(${x}px, ${y}px)`; // Random movement
            firefly.style.opacity = Math.random() > 0.5 ? '0.5' : '1'; // Pulsating effect
        };

        move();
        const interval = setInterval(move, 1500 + Math.random() * 2000);

        setTimeout(() => {
            clearInterval(interval);
            firefly.remove(); // Remove firefly when done
        }, 4000); // Remove after some time
    };

    return (
        <div style={containerStyle}>
            <p style={{ position: 'absolute', bottom: '10%', fontSize: '1.2rem', color: '#FFF', textShadow: '1px 1px 5px rgba(0, 0, 0, 0.7)' }}>
                Les lucioles s'activent...
            </p>
        </div>
    );
};

export default Loading;
