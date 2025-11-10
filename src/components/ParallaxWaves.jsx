import React, { useState, useEffect } from 'react';

export default function ParallaxWaves() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize mouse position to -1 to 1 range
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Calculate transforms for each wave layer
  const getTransform = (intensity) => {
    const moveX = mousePos.x * intensity;
    const moveY = mousePos.y * intensity;
    return `translate(${moveX}px, ${moveY}px)`;
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ 
      zIndex: -1,
      background: 'linear-gradient(135deg, #0a0a12 0%, #14101e 25%, #1a0f28 50%, #14101e 75%, #0a0a12 100%)'
    }}>
      {/* Wave Layer 1 - Slowest, deepest purple */}
      <div
        className="absolute inset-0 opacity-25 transition-transform duration-300 ease-out"
        style={{ transform: getTransform(15) }}
      >
        <svg
          className="absolute bottom-0 w-full h-full"
          viewBox="0 0 1440 800"
          preserveAspectRatio="none"
        >
          <path
            d="M0,400 C360,300 720,500 1440,400 L1440,800 L0,800 Z"
            fill="rgba(88, 28, 135, 0.4)"
          />
        </svg>
      </div>

      {/* Wave Layer 2 - Mid purple */}
      <div
        className="absolute inset-0 opacity-30 transition-transform duration-500 ease-out"
        style={{ transform: getTransform(25) }}
      >
        <svg
          className="absolute bottom-0 w-full h-full"
          viewBox="0 0 1440 800"
          preserveAspectRatio="none"
        >
          <path
            d="M0,500 C360,400 720,600 1440,500 L1440,800 L0,800 Z"
            fill="rgba(109, 40, 217, 0.35)"
          />
        </svg>
      </div>

      {/* Wave Layer 3 - Brighter purple */}
      <div
        className="absolute inset-0 opacity-35 transition-transform duration-700 ease-out"
        style={{ transform: getTransform(35) }}
      >
        <svg
          className="absolute bottom-0 w-full h-full"
          viewBox="0 0 1440 800"
          preserveAspectRatio="none"
        >
          <path
            d="M0,600 C360,500 720,700 1440,600 L1440,800 L0,800 Z"
            fill="rgba(139, 92, 246, 0.3)"
          />
        </svg>
      </div>

      {/* Wave Layer 4 - Accent purple/pink */}
      <div
        className="absolute inset-0 opacity-25 transition-transform duration-1000 ease-out"
        style={{ transform: getTransform(50) }}
      >
        <svg
          className="absolute bottom-0 w-full h-full"
          viewBox="0 0 1440 800"
          preserveAspectRatio="none"
        >
          <path
            d="M0,650 C360,550 720,750 1440,650 L1440,800 L0,800 Z"
            fill="rgba(168, 85, 247, 0.25)"
          />
        </svg>
      </div>

      {/* Ambient light effect following cursor - subtle purple glow */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-15 transition-all duration-1000 ease-out pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.6) 0%, rgba(168, 85, 247, 0.3) 40%, transparent 70%)',
          left: `${(mousePos.x + 1) * 50}%`,
          top: `${(mousePos.y + 1) * 50}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}