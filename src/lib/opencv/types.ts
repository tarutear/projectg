export interface CvMat {
  rows: number
  cols: number
  data: Uint8Array
  data32F: Float32Array
  type(): number
  ucharAt(row: number, col: number): number
  delete(): void
}

export interface CvMatVector {
  size(): number
  get(index: number): CvMat
  push_back(mat: CvMat): void
  delete(): void
}

export interface CvSize {
  width: number
  height: number
}

export interface CvPoint {
  x: number
  y: number
}

export interface CvScalar {
  0: number
  1: number
  2: number
  3: number
}

export interface CvMoments {
  m00: number
  m10: number
  m01: number
}

export interface OpenCV {
  Mat: new (rows?: number, cols?: number, type?: number, scalar?: CvScalar) => CvMat
  MatVector: new () => CvMatVector
  Scalar: new (v0: number, v1?: number, v2?: number, v3?: number) => CvScalar
  Size: new (width: number, height: number) => CvSize
  Point: new (x: number, y: number) => CvPoint

  CV_8UC1: number
  CV_8UC3: number
  CV_8UC4: number

  COLOR_RGBA2BGR: number
  COLOR_BGR2HSV: number
  COLOR_BGR2GRAY: number
  RETR_EXTERNAL: number
  CHAIN_APPROX_SIMPLE: number
  MORPH_OPEN: number
  MORPH_CLOSE: number
  MORPH_ELLIPSE: number
  THRESH_BINARY_INV: number

  matFromArray(rows: number, cols: number, type: number, array: number[]): CvMat
  countNonZero(src: CvMat): number
  cvtColor(src: CvMat, dst: CvMat, code: number): void
  inRange(src: CvMat, lowerb: CvMat | CvScalar, upperb: CvMat | CvScalar, dst: CvMat): void
  findContours(
    image: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number
  ): void
  contourArea(contour: CvMat): number
  arcLength(curve: CvMat, closed: boolean): number
  moments(array: CvMat, binaryImage?: boolean): CvMoments
  morphologyEx(src: CvMat, dst: CvMat, op: number, kernel: CvMat): void
  GaussianBlur(src: CvMat, dst: CvMat, ksize: CvSize, sigmaX: number): void
  threshold(src: CvMat, dst: CvMat, thresh: number, maxval: number, type: number): number
  getStructuringElement(shape: number, ksize: CvSize): CvMat
  matFromImageData(imageData: ImageData): CvMat

  onRuntimeInitialized?: () => void
}
