/**
 * Decides whether this frame needs to be drawn. If nothing moved, skipping the draw
 * saves the GPU for the hand tracker.
 */
export class RenderGate {
  private dirty = true;
  private wasMoving = false;

  /** Something changed that the animation doesn't know about (resize, context restored...). */
  invalidate(): void {
    this.dirty = true;
  }

  /** `moving` is true while the needle or the orbit controls are still changing. */
  shouldRender(moving: boolean): boolean {
    // one more draw after movement stops, so the last frame shows the resting position
    const go = this.dirty || moving || this.wasMoving;
    this.dirty = false;
    this.wasMoving = moving;
    return go;
  }
}
