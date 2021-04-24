<template>
  <div id="app" class="web-camera-container">
    <div v-show="isCameraOpen && isLoading" class="camera-loading">
      <ul class="loader-circle">
        <li></li>
        <li></li>
        <li></li>
      </ul>
    </div>

    <div v-if="isCameraOpen" v-show="!isLoading" class="camera-box" :width="videoWidth" :height="videoHeight">
      <canvas ref="outputCanvas" id="outputCanvas" :width="videoWidth" :height="videoHeight"></canvas>
      <video style="display: None" ref="cameraInput" autoplay></video>
    </div>
  </div>
</template>
<script>
import * as mediapipeFacemesh from '@mediapipe/face_mesh/face_mesh';
import * as mediapipeCamera from '@mediapipe/camera_utils/camera_utils';
import * as mediapipeDrawing from '@mediapipe/drawing_utils/drawing_utils';

export default {
  name: 'app',
  components: {},
  data() {
    return {
      isCameraOpen: true,
      isLoading: false,
      faceMesh: undefined,
      camera: undefined,
      link: '#',
      videoHeight: 0,
      videoWidth: 0,
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
      const right_eye = [this.multiFaceLandmarks[0][144].x * this.videoWidth, this.multiFaceLandmarks[0][144].y * this.videoHeight]
      const radius = 30
      const power = 2

      let mapY = this.mapYGlobal.clone()
      let mapX = this.mapXGlobal.clone()

      for (let i = (-1) * radius; i < radius; i++) {
        for (let j = (-1) * radius; j < radius; j++) {
          if ((i * i + j * j) > (radius * radius)) {
            continue
          }
          if (i > 0) {
            mapY.floatPtr(right_eye[1] + i, right_eye[0] + j)[0] = right_eye[1] + Math.pow(i/radius, power) * radius
          }
          if (i < 0) {
            mapY.floatPtr(right_eye[1] + i, right_eye[0] + j)[0] = right_eye[1] - Math.pow(-i/radius, power) * radius
          }
          if (j > 0) {
            mapX.floatPtr(right_eye[1] + i, right_eye[0] + j)[0] = right_eye[0] + Math.pow(j/radius, power) * radius
          }
          if (j < 0) {
            mapX.floatPtr(right_eye[1] + i, right_eye[0] + j)[0] = right_eye[0] - Math.pow(-j/radius, power) * radius
          }
        }
      }
      this.$cv.remap(this.sourceMat,this.destinMat,mapX,mapY,this.$cv.INTER_LINEAR)
      mapY.delete();
      mapX.delete();
      return this.destinMat;
    },
    processVideo() {
      this.videoCapture.read(this.sourceMat);
      const result = this.liquify();
      this.$cv.imshow("outputCanvas", result);
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
      const constraints = (window.constraints = {
        audio: false,
        video: {height: {max: this.videoHeight}, aspectRatio: 1.77777778},

      });

      window.navigator.mediaDevices
          .getUserMedia(constraints)
          .then(stream => {
            this.isLoading = false;
            this.$refs.cameraInput.srcObject = stream;
            this.canvasContext = this.$refs.outputCanvas.getContext('2d');
            this.videoHeight = stream.getVideoTracks()[0].getSettings().height;
            this.videoWidth = stream.getVideoTracks()[0].getSettings().width;
            this.faceMesh = new mediapipeFacemesh.FaceMesh({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
              }});
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

.web-camera-container {
  margin-top: 10px;
  margin-bottom: 10px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid #ccc;
  border-radius: 4px;

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
