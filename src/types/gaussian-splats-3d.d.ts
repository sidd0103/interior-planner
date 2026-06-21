/**
 * Minimal ambient types for @mkkellogg/gaussian-splats-3d, which ships no
 * declarations. We only use DropInViewer (a THREE.Object3D subclass).
 */
declare module "@mkkellogg/gaussian-splats-3d" {
  import type { Object3D, WebGLRenderer } from "three";

  export interface DropInViewerOptions {
    gpuAcceleratedSort?: boolean;
    sharedMemoryForWorkers?: boolean;
    sceneRevealMode?: SceneRevealMode;
    renderer?: WebGLRenderer;
    [key: string]: unknown;
  }

  export enum SceneFormat {
    Splat = 0,
    KSplat = 1,
    Ply = 2,
    Spz = 3,
  }

  export enum SceneRevealMode {
    Default = 0,
    Gradual = 1,
    Instant = 2,
  }

  export interface AddSplatSceneOptions {
    showLoadingUI?: boolean;
    splatAlphaRemovalThreshold?: number;
    progressiveLoad?: boolean;
    format?: SceneFormat;
    [key: string]: unknown;
  }

  export class DropInViewer extends Object3D {
    constructor(options?: DropInViewerOptions);
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>;
    dispose(): Promise<void> | void;
  }

  export class Viewer {
    constructor(options?: Record<string, unknown>);
    splatMesh: Object3D;
    camera: unknown;
    renderer: unknown;
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>;
    getSplatMesh(): Object3D;
    update(renderer?: unknown, camera?: unknown): void;
    render(): void;
    dispose(): Promise<void> | void;
  }
}
