/** Simple constant-velocity 2D Kalman filter for marker position smoothing. */
export class KalmanFilter2D {
  private x: number
  private y: number
  private vx = 0
  private vy = 0
  // Diagonal error covariance
  private px = 1; private py = 1
  private pvx = 1; private pvy = 1

  constructor(
    x: number, y: number,
    private readonly q = 0.1,  // process noise
    private readonly r = 2.0   // measurement noise
  ) {
    this.x = x; this.y = y
  }

  update(mx: number, my: number): { x: number; y: number } {
    // Predict
    const xp  = this.x + this.vx
    const yp  = this.y + this.vy
    const pxp = this.px + this.pvx + this.q
    const pyp = this.py + this.pvy + this.q

    // Kalman gain
    const kx = pxp / (pxp + this.r)
    const ky = pyp / (pyp + this.r)

    // Update state
    const ix = mx - xp
    const iy = my - yp
    this.x  = xp + kx * ix
    this.y  = yp + ky * iy
    this.vx = this.vx + kx * ix
    this.vy = this.vy + ky * iy
    this.px = (1 - kx) * pxp
    this.py = (1 - ky) * pyp
    this.pvx += this.q
    this.pvy += this.q

    return { x: this.x, y: this.y }
  }

  predict(): { x: number; y: number } {
    return { x: this.x + this.vx, y: this.y + this.vy }
  }
}
