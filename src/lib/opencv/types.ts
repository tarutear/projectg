export interface CvMat {
  rows: number
  cols: number
  data: Uint8Array
  data32F: Float32Array
  type(): number
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
  RETR_EXTERNAL: number
  CHAIN_APPROX_SIMPLE: number
  MORPH_OPEN: number
  MORPH_CLOSE: number
  MORPH_ELLIPSE: number

  matFromArray(rows: number, cols: number, type: number, array: number[]): CvMat
  cvtColor(src: CvMat, dst: CvMat, code: number): void
  inRange(src: CvMat, lowerb: CvMat, upperb: CvMat, dst: CvMat): void
  findContours(
    image: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number
  ): void
  contourArea(contour: CvMat): number
  moments(array: CvMat, binaryImage?: boolean): CvMoments
  morphologyEx(src: CvMat, dst: CvMat, op: number, kernel: CvMat): void
  getStructuringElement(shape: number, ksize: CvSize): CvMat
  matFromImageData(imageData: ImageData): CvMat

  onRuntimeInitialized?: () => void
}
