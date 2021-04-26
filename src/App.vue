<template>
  <div id="app" class="web-camera-container" style="width: 100%; height: 100%">
    {{ this.videoHeight }}x{{ this.videoWidth }}
    <div v-show="isCameraOpen && isLoading" class="camera-loading">
      <ul class="loader-circle">
        <li></li>
        <li></li>
        <li></li>
      </ul>
    </div>

    <div v-if="isCameraOpen" v-show="!isLoading" class="camera-box">
      <canvas ref="outputCanvas" id="outputCanvas"></canvas>
      <video style="display: None" ref="cameraInput" autoplay></video>
      <vue-slider v-model="volume" style="width: 75%;" v-bind="sliderOptions"/>
    </div>
  </div>
</template>
<script>
import * as mediapipeFacemesh from '@mediapipe/face_mesh/face_mesh';
import * as mediapipeCamera from '@mediapipe/camera_utils/camera_utils';
import * as mediapipeDrawing from '@mediapipe/drawing_utils/drawing_utils';
import VueSlider from 'vue-slider-component';
import 'vue-slider-component/theme/default.css'

export default {
  name: 'app',
  components: {
    VueSlider
  },
  data() {
    return {
      isCameraOpen: true,
      isLoading: false,
      faceMesh: undefined,
      camera: undefined,
      link: '#',
      videoHeight: 0,
      videoWidth: 0,
      volume: 100,
      sliderOptions: {
        dotSize: 50,
        width: 'auto',
        height: 50,
        contained: false,
        direction: 'ltr',
        data: null,
        dataLabel: 'label',
        dataValue: 'value',
        min: 0,
        max: 100,
        interval: 1,
        disabled: false,
        clickable: true,
        duration: 0.5,
        adsorb: false,
        lazy: false,
        tooltip: 'active',
        tooltipPlacement: 'top',
        tooltipFormatter: void 0,
        useKeyboard: false,
        keydownHook: null,
        dragOnClick: true,
        enableCross: true,
        fixed: false,
        minRange: void 0,
        maxRange: void 0,
        order: true,
        marks: false,
        dotOptions: {tooltip: 'always'},
        dotAttrs: void 0,
        process: true,
        dotStyle: void 0,
        railStyle: void 0,
        processStyle: void 0,
        tooltipStyle: void 0,
        stepStyle: void 0,
        stepActiveStyle: void 0,
        labelStyle: void 0,
        labelActiveStyle: void 0,
      },
      canvasContext: undefined,
      sourceMat: undefined,
      destinMat: undefined,
      mapYGlobal: undefined,
      mapXGlobal: undefined,
      multiFaceLandmarks: undefined,
      videoCapture: undefined
    }
  },
  created() {
    this.createCameraElement();
  },
  methods: {
    liquify() {
      if (!this.multiFaceLandmarks) {
        return this.sourceMat;
      }
      const right_eye = [this.multiFaceLandmarks[0][94].x * this.videoWidth, this.multiFaceLandmarks[0][94].y * this.videoHeight]
      const radius = 30 * this.volume / 100
      const power = 2

      let mapY = this.mapYGlobal.clone()
      let mapX = this.mapXGlobal.clone()

      for (let i = (-1) * radius; i < radius; i++) {
        for (let j = (-1) * radius; j < radius; j++) {
          if ((i * i + j * j) > (radius * radius)) {
            continue
          }
          if (i > 0) {
            mapY.floatPtr(right_eye[1] + i, right_eye[0] + j)[0] = right_eye[1] + Math.pow(i / radius, power) * radius
          }
          if (i < 0) {
            mapY.floatPtr(right_eye[1] + i, right_eye[0] + j)[0] = right_eye[1] - Math.pow(-i / radius, power) * radius
          }
          if (j > 0) {
            mapX.floatPtr(right_eye[1] + i, right_eye[0] + j)[0] = right_eye[0] + Math.pow(j / radius, power) * radius
          }
          if (j < 0) {
            mapX.floatPtr(right_eye[1] + i, right_eye[0] + j)[0] = right_eye[0] - Math.pow(-j / radius, power) * radius
          }
        }
      }
      this.$cv.remap(this.sourceMat, this.destinMat, mapX, mapY, this.$cv.INTER_LINEAR)
      mapY.delete();
      mapX.delete();
      return this.destinMat;
    },
    resize() {
      const foo = 30 * this.volume / 100;
      const fooResize = 2 * foo;
      if (!this.multiFaceLandmarks) {
        return this.sourceMat;
      }
      const x = this.multiFaceLandmarks[0][94].x * this.videoWidth
      const y = this.multiFaceLandmarks[0][94].y * this.videoHeight

      if (x > fooResize && x < this.sourceMat.cols - fooResize && y > fooResize && y < this.sourceMat.rows - fooResize) {
        this.destinMat = this.sourceMat.clone();
        const imgROI = this.destinMat.roi(new this.$cv.Rect(x - foo, y - foo, 2 * foo, 2 * foo));
        const tranPart = this.destinMat.roi(new this.$cv.Rect(x - 2 * foo, y - 2 * foo, 4 * foo, 4 * foo));
        const roiResize = new this.$cv.Mat();
        this.$cv.resize(imgROI, roiResize, new this.$cv.Size(2 * imgROI.cols, 2 * imgROI.rows));

        roiResize.copyTo(tranPart);
        roiResize.delete();
        imgROI.delete();
        tranPart.delete();

        return this.destinMat;
      }
      return this.sourceMat;
    },
    cropContour() {
      if (!this.multiFaceLandmarks) {
        return this.sourceMat;
      }
      let heightIncrease = 10 * this.volume / 100;
      this.destinMat = this.sourceMat.clone();
      const contour = [
        // https://raw.githubusercontent.com/tensorflow/tfjs-models/master/facemesh/mesh_map.jpg
        this.multiFaceLandmarks[0][0].x * this.videoWidth, this.multiFaceLandmarks[0][0].y * this.videoHeight,
        this.multiFaceLandmarks[0][267].x * this.videoWidth, this.multiFaceLandmarks[0][267].y * this.videoHeight,
        this.multiFaceLandmarks[0][269].x * this.videoWidth, this.multiFaceLandmarks[0][269].y * this.videoHeight,
        this.multiFaceLandmarks[0][270].x * this.videoWidth, this.multiFaceLandmarks[0][270].y * this.videoHeight,
        this.multiFaceLandmarks[0][409].x * this.videoWidth, this.multiFaceLandmarks[0][409].y * this.videoHeight,
        this.multiFaceLandmarks[0][287].x * this.videoWidth, this.multiFaceLandmarks[0][287].y * this.videoHeight,
        this.multiFaceLandmarks[0][375].x * this.videoWidth, this.multiFaceLandmarks[0][375].y * this.videoHeight,
        this.multiFaceLandmarks[0][321].x * this.videoWidth, this.multiFaceLandmarks[0][321].y * this.videoHeight,
        this.multiFaceLandmarks[0][405].x * this.videoWidth, this.multiFaceLandmarks[0][405].y * this.videoHeight,
        this.multiFaceLandmarks[0][314].x * this.videoWidth, this.multiFaceLandmarks[0][314].y * this.videoHeight,
        this.multiFaceLandmarks[0][17].x * this.videoWidth, this.multiFaceLandmarks[0][17].y * this.videoHeight,
        this.multiFaceLandmarks[0][84].x * this.videoWidth, this.multiFaceLandmarks[0][84].y * this.videoHeight,
        this.multiFaceLandmarks[0][181].x * this.videoWidth, this.multiFaceLandmarks[0][181].y * this.videoHeight,
        this.multiFaceLandmarks[0][91].x * this.videoWidth, this.multiFaceLandmarks[0][91].y * this.videoHeight,
        this.multiFaceLandmarks[0][146].x * this.videoWidth, this.multiFaceLandmarks[0][146].y * this.videoHeight,
        this.multiFaceLandmarks[0][57].x * this.videoWidth, this.multiFaceLandmarks[0][57].y * this.videoHeight,
        this.multiFaceLandmarks[0][185].x * this.videoWidth, this.multiFaceLandmarks[0][185].y * this.videoHeight,
        this.multiFaceLandmarks[0][40].x * this.videoWidth, this.multiFaceLandmarks[0][40].y * this.videoHeight,
        this.multiFaceLandmarks[0][39].x * this.videoWidth, this.multiFaceLandmarks[0][39].y * this.videoHeight,
        this.multiFaceLandmarks[0][37].x * this.videoWidth, this.multiFaceLandmarks[0][37].y * this.videoHeight
      ];
      let minX = 99999;
      let minY = 99999;
      let maxX = 0;
      let maxY = 0;
      for (let i = 0; i < contour.length; i++) {
        if (i % 2 === 0) {
          if (contour[i] < minX) {
            minX = contour[i];
          }
          if (contour[i] > maxX) {
            maxX = contour[i];
          }
        } else {
          if (contour[i] < minY) {
            minY = contour[i];
          }
          if (contour[i] > maxY) {
            maxY = contour[i];
          }
        }
      }
      let color = new this.$cv.Scalar(Math.round(Math.random() * 255), Math.round(Math.random() * 255),
          Math.round(Math.random() * 255));

      // this.$cv.rectangle(this.destinMat, new this.$cv.Point(minX, minY), new this.$cv.Point(maxX, maxY), color, 1)

      let contours = new this.$cv.MatVector();
      let contourMat = new this.$cv.Mat.zeros(20, 2, this.$cv.CV_32S);
      for (let i = 0; i < 40; i++) {
        contourMat.intPtr(0, i)[0] = contour[i];
      }

      let dest = new this.$cv.Mat(maxY - minY, maxX - minX, this.$cv.CV_8UC4);
      let increased = new this.$cv.Mat(maxY - minY + heightIncrease, maxX - minX, this.$cv.CV_8UC4);
      let rect = new this.$cv.Rect(minX, minY, maxX - minX, maxY - minY);
      dest = this.sourceMat.roi(rect);

      let dsize = new this.$cv.Size(maxX - minX, maxY - minY + heightIncrease);
      this.$cv.resize(dest, increased, dsize, 0, 0, this.$cv.INTER_AREA)

      for (let i = minX; i < maxX-1; i++) {
        for (let j = minY-heightIncrease; j < maxY-1; j++) {
          let dist = this.$cv.pointPolygonTest(contourMat, new this.$cv.Point(i, j), true)
          if (dist < 0) {
            continue;
          }
          this.destinMat.ucharPtr(j, i)[0] = increased.ucharPtr(j-minY+heightIncrease, i-minX)[0];
          this.destinMat.ucharPtr(j, i)[1] = increased.ucharPtr(j-minY+heightIncrease, i-minX)[1];
          this.destinMat.ucharPtr(j, i)[2] = increased.ucharPtr(j-minY+heightIncrease, i-minX)[2];
          this.destinMat.ucharPtr(j, i)[3] = increased.ucharPtr(j-minY+heightIncrease, i-minX)[3];
        }
      }

      this.$cv.drawContours(this.destinMat, contours, 0, color, 1);
      contours.delete();
      contourMat.delete();
      return this.destinMat;
    },
    cropContourOld() {
      if (!this.multiFaceLandmarks) {
        return this.sourceMat;
      }
      this.destinMat = this.sourceMat.clone();
      const contour = [
        // https://raw.githubusercontent.com/tensorflow/tfjs-models/master/facemesh/mesh_map.jpg
        this.multiFaceLandmarks[0][0].x * this.videoWidth, this.multiFaceLandmarks[0][0].y * this.videoHeight,
        this.multiFaceLandmarks[0][267].x * this.videoWidth, this.multiFaceLandmarks[0][267].y * this.videoHeight,
        this.multiFaceLandmarks[0][269].x * this.videoWidth, this.multiFaceLandmarks[0][269].y * this.videoHeight,
        this.multiFaceLandmarks[0][270].x * this.videoWidth, this.multiFaceLandmarks[0][270].y * this.videoHeight,
        this.multiFaceLandmarks[0][409].x * this.videoWidth, this.multiFaceLandmarks[0][409].y * this.videoHeight,
        this.multiFaceLandmarks[0][287].x * this.videoWidth, this.multiFaceLandmarks[0][287].y * this.videoHeight,
        this.multiFaceLandmarks[0][375].x * this.videoWidth, this.multiFaceLandmarks[0][375].y * this.videoHeight,
        this.multiFaceLandmarks[0][321].x * this.videoWidth, this.multiFaceLandmarks[0][321].y * this.videoHeight,
        this.multiFaceLandmarks[0][405].x * this.videoWidth, this.multiFaceLandmarks[0][405].y * this.videoHeight,
        this.multiFaceLandmarks[0][314].x * this.videoWidth, this.multiFaceLandmarks[0][314].y * this.videoHeight,
        this.multiFaceLandmarks[0][17].x * this.videoWidth, this.multiFaceLandmarks[0][17].y * this.videoHeight,
        this.multiFaceLandmarks[0][84].x * this.videoWidth, this.multiFaceLandmarks[0][84].y * this.videoHeight,
        this.multiFaceLandmarks[0][181].x * this.videoWidth, this.multiFaceLandmarks[0][181].y * this.videoHeight,
        this.multiFaceLandmarks[0][91].x * this.videoWidth, this.multiFaceLandmarks[0][91].y * this.videoHeight,
        this.multiFaceLandmarks[0][146].x * this.videoWidth, this.multiFaceLandmarks[0][146].y * this.videoHeight,
        this.multiFaceLandmarks[0][57].x * this.videoWidth, this.multiFaceLandmarks[0][57].y * this.videoHeight,
        this.multiFaceLandmarks[0][185].x * this.videoWidth, this.multiFaceLandmarks[0][185].y * this.videoHeight,
        this.multiFaceLandmarks[0][40].x * this.videoWidth, this.multiFaceLandmarks[0][40].y * this.videoHeight,
        this.multiFaceLandmarks[0][39].x * this.videoWidth, this.multiFaceLandmarks[0][39].y * this.videoHeight,
        this.multiFaceLandmarks[0][37].x * this.videoWidth, this.multiFaceLandmarks[0][37].y * this.videoHeight
      ];
      let contours = new this.$cv.MatVector();
      let contourMat = new this.$cv.Mat.zeros(20, 2, this.$cv.CV_32S);
      for (let i = 0; i < 40; i++) {
        contourMat.intPtr(0, i)[0] = contour[i];
      }
      contours.push_back(contourMat);
      let color = new this.$cv.Scalar(Math.round(Math.random() * 255), Math.round(Math.random() * 255),
          Math.round(Math.random() * 255));
      this.$cv.drawContours(this.destinMat, contours, 0, color, 1);
      contours.delete();
      contourMat.delete();
      return this.destinMat;
    },
    processVideo() {
      this.videoCapture.read(this.sourceMat);
      const result = this.cropContour();
      let imgData = new ImageData(new Uint8ClampedArray(result.data), result.cols, result.rows);
      this.canvasContext.clearRect(0, 0, this.videoWidth, this.videoHeight);
      this.$refs.outputCanvas.width = imgData.width;
      this.$refs.outputCanvas.height = imgData.height;
      this.canvasContext.putImageData(imgData, 0, 0);
      // this.$cv.imshow("outputCanvas", result);
      // var vRatio = (c.height / v.videoHeight) * v.videoWidth;
      // ctx.drawImage(v, 0,0, vRatio, c.height);
      requestAnimationFrame(this.processVideo);
    },
    onLandmarksDetected(results) {
      // this.canvasContext.save();
      // this.canvasContext.clearRect(0, 0, this.$refs.outputCanvas.width, this.$refs.outputCanvas.height);
      // this.canvasContext.drawImage(results.image, 0, 0, this.$refs.outputCanvas.width, this.$refs.outputCanvas.height);
      // this.canvasContext.restore();

      this.multiFaceLandmarks = results.multiFaceLandmarks;
    },
    createCameraElement() {
      this.isLoading = true;
      this.videoHeight = window.screen.height;
      this.videoWidth = window.screen.width;
      const constraints = (window.constraints = {
        audio: false,
        video: {height: {max: 500, ideal: this.videoWidth}, width: {max: 500, ideal: this.videoWidth}},
      });

      window.navigator.mediaDevices
          .getUserMedia(constraints)
          .then(stream => {
            this.isLoading = false;
            this.$refs.cameraInput.srcObject = stream;
            this.canvasContext = this.$refs.outputCanvas.getContext('2d');
            this.videoHeight = stream.getVideoTracks()[0].getSettings().height;
            this.videoWidth = stream.getVideoTracks()[0].getSettings().width;
            this.faceMesh = new mediapipeFacemesh.FaceMesh({
              locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
              }
            });
            this.faceMesh.onResults(this.onLandmarksDetected);
            this.camera = new mediapipeCamera.Camera(this.$refs.cameraInput, {
              onFrame: async () => {
                await this.faceMesh.send({image: this.$refs.cameraInput});
              },
              width: this.videoWidth,
              height: this.videoHeight
            });
            this.camera.start();
            this.$refs.cameraInput.setAttribute("width", this.videoWidth);
            this.$refs.cameraInput.setAttribute("height", this.videoHeight);
            console.log(this.videoWidth, this.videoHeight)
            this.videoCapture = new this.$cv.VideoCapture(this.$refs.cameraInput);
            this.sourceMat = new this.$cv.Mat(this.videoHeight, this.videoWidth, this.$cv.CV_8UC4);
            this.destinMat = new this.$cv.Mat(this.videoHeight, this.videoWidth, this.$cv.CV_8UC4);
            this.mapYGlobal = new this.$cv.Mat.zeros(this.videoHeight, this.videoWidth, this.$cv.CV_32F);
            this.mapXGlobal = new this.$cv.Mat.zeros(this.videoHeight, this.videoWidth, this.$cv.CV_32F);

            for (let i = 0; i < this.videoHeight; i++) {
              for (let j = 0; j < this.videoWidth; j++) {
                this.mapYGlobal.floatPtr(i, j)[0] = i
                this.mapXGlobal.floatPtr(i, j)[0] = j
              }
            }

            requestAnimationFrame(this.processVideo);
          })
          .catch(error => {
            console.log(error)
            this.isLoading = false;
            alert(error);
          });
    },
  }
}
</script>

<style lang="scss">
body {
  display: flex;
  justify-content: center;
}

html, body {
  height: 99%;
}

.web-camera-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid #ccc;
  border-radius: 4px;

  .camera-box {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .camera-loading {
    overflow: hidden;
    height: 100%;
    position: absolute;
    width: 100%;
    min-height: 150px;
    margin: 3rem 0 0 -1.2rem;

    ul {
      height: 100%;
      position: absolute;
      width: 100%;
      z-index: 999999;
      margin: 0;
    }

    .loader-circle {
      display: block;
      height: 14px;
      margin: 0 auto;
      top: 50%;
      left: 100%;
      transform: translateY(-50%);
      transform: translateX(-50%);
      position: absolute;
      width: 100%;
      padding: 0;

      li {
        display: block;
        float: left;
        width: 10px;
        height: 10px;
        line-height: 10px;
        padding: 0;
        position: relative;
        margin: 0 0 0 4px;
        background: #999;
        animation: preload 1s infinite;
        top: -50%;
        border-radius: 100%;

        &:nth-child(2) {
          animation-delay: .2s;
        }

        &:nth-child(3) {
          animation-delay: .4s;
        }
      }
    }
  }

  @keyframes preload {
    0% {
      opacity: 1
    }
    50% {
      opacity: .4
    }
    100% {
      opacity: 1
    }
  }
}
</style>
