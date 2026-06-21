"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/storage/types";

export interface InitialView {
  position: Vec3;
  target: Vec3;
}

interface Props {
  /** Where to place the camera + look target on first load (e.g. inside the room). */
  initialView?: InitialView;
  /** Walk speed in meters/second. */
  speed?: number;
}

/**
 * WASD/arrow-key walking that moves the camera and the OrbitControls target
 * together, so you glide through the room while still being able to mouse-drag
 * to look around and click furniture. Space/C raise/lower; Shift sprints.
 */
export function WalkControls({ initialView, speed = 2.6 }: Props) {
  const camera = useThree((s) => s.camera);
  // OrbitControls registers itself as the default controls.
  const controls = useThree((s) => s.controls) as
    | (THREE.EventDispatcher & { target: THREE.Vector3; update: () => void })
    | null;

  const keys = useRef<Record<string, boolean>>({});
  const applied = useRef(false);

  // Place the camera inside the room once controls are ready.
  useEffect(() => {
    if (!initialView || !controls || applied.current) return;
    camera.position.set(...initialView.position);
    controls.target.set(...initialView.target);
    controls.update();
    applied.current = true;
  }, [initialView, controls, camera]);

  // Track held keys (ignore when typing in a form field).
  useEffect(() => {
    const isFormField = (t: EventTarget | null) => {
      const tag = (t as HTMLElement | null)?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const down = (e: KeyboardEvent) => {
      if (isFormField(e.target)) return;
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const k = keys.current;
    const f = forward.current;
    const r = right.current;
    const m = move.current.set(0, 0, 0);

    camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 1e-6) return;
    f.normalize();
    r.crossVectors(f, camera.up).normalize();

    if (k["KeyW"] || k["ArrowUp"]) m.add(f);
    if (k["KeyS"] || k["ArrowDown"]) m.sub(f);
    if (k["KeyD"] || k["ArrowRight"]) m.add(r);
    if (k["KeyA"] || k["ArrowLeft"]) m.sub(r);
    if (k["Space"]) m.y += 1;
    if (k["KeyC"]) m.y -= 1;
    if (m.lengthSq() === 0) return;

    const sprint = k["ShiftLeft"] || k["ShiftRight"] ? 2.2 : 1;
    m.normalize().multiplyScalar(speed * sprint * dt);
    camera.position.add(m);
    if (controls) {
      controls.target.add(m);
      controls.update();
    }
  });

  return null;
}
