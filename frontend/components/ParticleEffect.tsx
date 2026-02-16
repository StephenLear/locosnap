// ============================================================
// LocoSnap — Particle / Confetti Effect
// Animated particles that burst from the center on Rare+ reveals
// Tier-specific: Rare = blue sparkles, Epic = purple burst,
// Legendary = golden confetti shower
// ============================================================

import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
} from "react-native";
import { RarityTier } from "../types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Tier-specific config ──────────────────────────────────

interface ParticleConfig {
  count: number;
  colors: string[];
  size: [number, number]; // min, max
  duration: [number, number]; // min, max ms
  spread: number; // radial spread multiplier
  gravity: number; // downward pull
  shapes: ("circle" | "square" | "diamond")[];
}

const PARTICLE_CONFIGS: Partial<Record<RarityTier, ParticleConfig>> = {
  rare: {
    count: 20,
    colors: ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"],
    size: [4, 8],
    duration: [1200, 2000],
    spread: 1,
    gravity: 0.3,
    shapes: ["circle", "diamond"],
  },
  epic: {
    count: 35,
    colors: ["#a855f7", "#c084fc", "#d8b4fe", "#e879f9", "#f0abfc"],
    size: [5, 10],
    duration: [1400, 2400],
    spread: 1.3,
    gravity: 0.25,
    shapes: ["circle", "square", "diamond"],
  },
  legendary: {
    count: 50,
    colors: ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fff", "#00D4AA"],
    size: [5, 12],
    duration: [1600, 3000],
    spread: 1.6,
    gravity: 0.2,
    shapes: ["circle", "square", "diamond"],
  },
};

// ── Single particle ───────────────────────────────────────

interface ParticleData {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  rotation: Animated.Value;
  color: string;
  size: number;
  shape: "circle" | "square" | "diamond";
  targetX: number;
  targetY: number;
  duration: number;
}

function createParticle(config: ParticleConfig, index: number): ParticleData {
  const angle = (Math.PI * 2 * index) / config.count + (Math.random() - 0.5) * 0.8;
  const distance =
    (100 + Math.random() * 200) * config.spread;
  const targetX = Math.cos(angle) * distance;
  const targetY =
    Math.sin(angle) * distance + Math.random() * 100 * config.gravity;

  const [minSize, maxSize] = config.size;
  const [minDur, maxDur] = config.duration;

  return {
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
    rotation: new Animated.Value(0),
    color: config.colors[Math.floor(Math.random() * config.colors.length)],
    size: minSize + Math.random() * (maxSize - minSize),
    shape: config.shapes[Math.floor(Math.random() * config.shapes.length)],
    targetX,
    targetY,
    duration: minDur + Math.random() * (maxDur - minDur),
  };
}

function ParticleView({ particle }: { particle: ParticleData }) {
  const borderRadius =
    particle.shape === "circle"
      ? particle.size / 2
      : particle.shape === "diamond"
        ? 2
        : 1;
  const rotateAngle =
    particle.shape === "diamond" ? "45deg" : "0deg";

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: particle.size,
          height: particle.size,
          borderRadius,
          backgroundColor: particle.color,
          transform: [
            { translateX: particle.x },
            { translateY: particle.y },
            { scale: particle.scale },
            {
              rotate: particle.rotation.interpolate({
                inputRange: [0, 1],
                outputRange: [rotateAngle, `${360 + (particle.shape === "diamond" ? 45 : 0)}deg`],
              }),
            },
          ],
          opacity: particle.opacity,
        },
      ]}
    />
  );
}

// ── Main component ────────────────────────────────────────

export default function ParticleEffect({
  tier,
  trigger,
}: {
  tier: RarityTier;
  trigger: boolean; // set to true to fire
}) {
  const config = PARTICLE_CONFIGS[tier];
  if (!config) return null; // common/uncommon = no particles

  const particles = useMemo(
    () => Array.from({ length: config.count }, (_, i) => createParticle(config, i)),
    [tier]
  );

  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!trigger || hasAnimated.current) return;
    hasAnimated.current = true;

    // Stagger particle animations
    const animations = particles.map((p, i) => {
      const delay = i * 20 + Math.random() * 100;

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          // Burst outward
          Animated.timing(p.x, {
            toValue: p.targetX,
            duration: p.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: p.targetY,
            duration: p.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Scale up then shrink
          Animated.sequence([
            Animated.timing(p.scale, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(p.scale, {
              toValue: 0.3,
              duration: p.duration - 200,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          // Fade in then out
          Animated.sequence([
            Animated.timing(p.opacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.delay(p.duration * 0.5),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: p.duration * 0.4,
              useNativeDriver: true,
            }),
          ]),
          // Spin
          Animated.timing(p.rotation, {
            toValue: 1,
            duration: p.duration,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.stagger(15, animations).start();
  }, [trigger]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <ParticleView key={i} particle={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  particle: {
    position: "absolute",
  },
});
