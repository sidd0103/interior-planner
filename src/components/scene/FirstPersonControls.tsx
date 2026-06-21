"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEditor } from "@/lib/scene/editorStore";
import type { Vec3 } from "@/lib/storage/types";

export interface InitialView {
  position: Vec3;
  target: Vec3;
}

interface Props {
  /** Where to place the camera + initial look direction (e.g. inside the room). */
  initialView?: InitialView;
  /** Walk speed in meters/second. */
  speed?: number;
  /** Mouse look sensitivity (radians per pixel). */
  sensitivity?: number;
}

const HALF_PI = Math.PI / 2;

/**
 * First-person camera: drag to look around in place, scroll to move
 * forward/back along the view, and WASD/arrows to walk (Space/C up-down,
 * Shift sprint). Coexists with furniture editing — dragging the transform
 * gizmo doesn't rotate the view (gated on the editor's `dragging` flag), and a
 * click (no drag) still selects/deselects.
 */
export function FirstPersonControls({ initialView, speed = 2.6, sensitivity = 0.0024 }: Props) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const keys = useRef<Record<string, boolean>>({});
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const applied = useRef(false);

  // Place the camera and set its initial look direction once.
  useEffect(() => {
    if (!initialView || applied.current) return;
    camera.position.set(...initialView.position);
    camera.lookAt(new THREE.Vector3(...initialView.target));
    euler.current.setFromQuaternion(camera.quaternion);
    applied.current = true;
  }, [initialView, camera]);

  // Drag to look + scroll to dolly.
  useEffect(() => {
    const el = gl.domElement;
    const drag = { active: false, x: 0, y: 0 };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag.active = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      // Re-sync from the camera in case something else moved it.
      euler.current.setFromQuaternion(camera.quaternion);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.active) return;
      // Don't rotate the view while dragging the furniture gizmo.
      if (useEditor.getState().dragging) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      euler.current.y -= dx * sensitivity;
      euler.current.x -= dy * sensitivity;
      euler.current.x = Math.max(-HALF_PI + 0.02, Math.min(HALF_PI - 0.02, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };
    const onUp = () => {
      drag.active = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      camera.position.addScaledVector(forward, -e.deltaY * 0.0016);
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [camera, gl, sensitivity]);

  // Held-key walking (ignore when typing in a form field).
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

  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const k = keys.current;
    const f = fwd.current;
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
    m.normalize().multiplyScalar(speed * sprint * Math.min(dt, 0.05));
    camera.position.add(m);
  });

  return null;
}
