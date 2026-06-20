/**
 * Minimal ambient types for @mkkellogg/gaussian-splats-3d, which ships no
 * declarations. We only use DropInViewer (a THREE.Object3D subclass).
 */
declare module "@mkkellogg/gaussian-splats-3d" {
  import type { Object3D, WebGLRenderer } from "three";

  export interface DropInViewerOptions {
    gpuAcceleratedSort?: boolean;
    sharedMemoryForWorkers?: boolean;
    renderer?: WebGLRenderer;
    [key: string]: unknown;
  }

  export interface AddSplatSceneOptions {
    showLoadingUI?: boolean;
    splatAlphaRemovalThreshold?: number;
    progressiveLoad?: boolean;
    [key: string]: unknown;
  }

  export class DropInViewer extends Object3D {
    constructor(options?: DropInViewerOptions);
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>;
    dispose(): Promise<void> | void;
  }

  export class Viewer {
    constructor(options?: Record<string, unknown>);
  }
}
