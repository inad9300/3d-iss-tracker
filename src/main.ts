import { AmbientLight, AxesHelper, Box3, DirectionalLight, MathUtils, Object3D, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SettingsOverlay } from './SettingsOverlay'
import { EARTH_DIAMETER_EQUATOR_KM, getIssTle, ISS_AVG_ALTITUDE_KM, latLngToVector3, MS_IN_DAY, noop, ORIGIN, rotateAroundPoint, ROTATION_PER_MS_DEG, NULL_ISLAND, Y_AXIS, loadGltfModel, loadFbxModel } from './utils'
import { getLatLngObj } from 'tle.js'

const renderer = new WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)

const scene = new Scene()

const ambientLight = new AmbientLight(0xFFFFFF, 1.11)
scene.add(ambientLight)

const sunLight = new DirectionalLight(0xFFCC99, 10)
scene.add(sunLight)

const axesHelper = new AxesHelper(EARTH_DIAMETER_EQUATOR_KM)
axesHelper.visible = false
scene.add(axesHelper)

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, Number.MAX_SAFE_INTEGER)
camera.position.x = EARTH_DIAMETER_EQUATOR_KM
camera.position.y = EARTH_DIAMETER_EQUATOR_KM
camera.position.z = EARTH_DIAMETER_EQUATOR_KM
camera.lookAt(ORIGIN)

const orbitControls = new OrbitControls(camera, renderer.domElement)
orbitControls.minDistance = EARTH_DIAMETER_EQUATOR_KM / 1.5
orbitControls.maxDistance = EARTH_DIAMETER_EQUATOR_KM * 3

let frameTime = Date.now()
let timeShift = 0

function positionSunLight() {
   let lastNoon = new Date().setUTCHours(12, 0, 0, 0)
   if (lastNoon > frameTime) {
      lastNoon -= MS_IN_DAY
   }

   const msFromLastNoon = frameTime - lastNoon
   const rotationRad = msFromLastNoon * -ROTATION_PER_MS_DEG

   const { x, y, z } = NULL_ISLAND
   sunLight.position.set(x, y, z)
   rotateAroundPoint(sunLight, ORIGIN, Y_AXIS, MathUtils.degToRad(rotationRad - 90))
}

// TODO: Add loading indicator, or start by rendering simple shapes and swap them out.
// TODO: Verify Earth has the right inclination.
loadGltfModel('Earth_1_12756.glb').then(gltf => {
   const box = new Box3().setFromObject(gltf.scene)
   const center = box.getCenter(new Vector3)

   gltf.scene.position.x += gltf.scene.position.x - center.x
   gltf.scene.position.y += gltf.scene.position.y - center.y
   gltf.scene.position.z += gltf.scene.position.z - center.z
   gltf.scene.scale.setScalar(EARTH_DIAMETER_EQUATOR_KM / 1_000)
   rotateAroundPoint(gltf.scene, ORIGIN, Y_AXIS, MathUtils.degToRad(-90))

   scene.add(gltf.scene)
})

let issObject: Object3D | undefined
let issTle = `ISS (ZARYA)
1 25544U 98067A   22274.19759479  .00014979  00000+0  26577-3 0  9997
2 25544  51.6446 171.3620 0002537 314.8685 180.8010 15.50443271361628`

// TODO: Use better quality model.
loadFbxModel('ISSComplete1.fbx').then(obj => {
   obj.scale.set(200, 200, 200) // TODO: Adjust.
   scene.add(obj)
   issObject = obj
})

function positionIss() {
   if (!issObject) return

   const { lat, lng } = getLatLngObj(issTle,  Date.now() + timeShift)
   // TODO: Position at exact altitude.
   const radius = 6_371 + ISS_AVG_ALTITUDE_KM / 2
   issObject.position.copy(latLngToVector3(lat, lng, radius))
}

function refreshIssTle() {
   // FIXME: This actually misplaces the ISS :/
   // getIssTle().then(tle => issTle = tle)
}

refreshIssTle()
setInterval(refreshIssTle, MS_IN_DAY)

const settingsOverlay = SettingsOverlay({
   ambientLightIntensity: ambientLight.intensity,
   onAmbientLightIntensityChange: v => ambientLight.intensity = v,
   timeShift,
   onTimeShiftChange: v => timeShift = v,
   axesVisible: axesHelper.visible,
   onAxesVisibleChange: v => axesHelper.visible = v
})

document.body.style.margin = '0'
document.body.style.fontFamily = 'sans-serif'
document.body.style.backgroundColor = '#000'
document.body.style.accentColor = '#343d46'
document.body.append(settingsOverlay, renderer.domElement)

function render() {
   frameTime = Date.now() + timeShift
   positionSunLight()
   positionIss()
   renderer.render(scene, camera)
   requestAnimationFrame(render)
}

render()
