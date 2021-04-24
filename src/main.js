import Vue from 'vue'
import App from './App.vue'
import * as cv from 'opencv.js'

Vue.config.productionTip = false
Vue.prototype.$cv = cv;

let cnt = 0
let tim = setInterval(() => {
  cnt++;
  try {
    clearInterval(tim)
    //console.log(cnt, 'INFO\n', info)

    // Now start Vue
    new Vue({
      render: h => h(App),
    }).$mount('#app')
  }
  catch(err) {
    //console.log('try again', cnt)
    if (cnt > 100) clearInterval(tim)
  }
}, 25)