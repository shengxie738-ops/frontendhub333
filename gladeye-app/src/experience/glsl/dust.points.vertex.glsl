// Extracted verbatim from evidence\source-assets\js\app\page-4c279de0997d388f.js module 7936 (2047 chars)
// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)
precision highp float;

uniform float uTime;
uniform float uDustSize;
uniform vec3 uContainerPos;
uniform float uCamNear;
uniform float uCamFar;
uniform float uDispersalProgress;

varying vec2 vUv;
varying vec3 vPosition;

attribute float aRotation;
varying float vRotation;

attribute vec3 aMovementRange;
varying vec3 vMovementRange;

varying float vFogAmount;

float easeOutCubic(float edge0, float edge1, float x){
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
		return 1. - pow(1. - t, 3.);
}

void main() {

    // vUv = uv;
    vec3 pos = position.xyz;
    float size = uDustSize;
    float pSize = size / abs(pos.z-uContainerPos.z);

    vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.0);
    vec4 finalPos = projectionMatrix * modelViewPosition;

    float fogDistance = length(finalPos);
    float fogAmount = smoothstep(uCamNear, uCamFar, fogDistance);
	float closeAmount = 1. - easeOutCubic(0., 1., 1. - smoothstep(uCamNear, uCamNear * 0.1, fogDistance));
	fogAmount = 1. - ((1. - fogAmount) * (1. - closeAmount));


    float rotationRadius = aRotation;

    finalPos.x += cos(uTime ) * aMovementRange.x;
    finalPos.y += sin(uTime ) * aMovementRange.y;
    // finalPos.z +=cos(uTime *rotationRadius) * rotationRadius * 0.2;

    vRotation=aRotation;
    vPosition=finalPos.xyz;
    vFogAmount = fogAmount;

	// Dispersed position
	vec4 dispersedPos = finalPos;
	dispersedPos.x += 80. * (finalPos.x - 0.5);
	dispersedPos.y += (position.y + 1.) * 100.;
	float inverseFogAmount = 1. - fogAmount;
	// Dispersed progress for particle
	float delay = inverseFogAmount * clamp( 0.15 * (4. - (position.y + 2.)), 0., 1.); // proportional to uDispersalProgress
	float thisDispersalProgress = clamp(uDispersalProgress - delay, 0., 1.);
	thisDispersalProgress = pow(thisDispersalProgress, 2.);

	// Update position between finalPos and dispersedPos
	finalPos = mix(finalPos, dispersedPos, thisDispersalProgress);


    gl_PointSize = pSize;
    gl_Position = fogAmount >= 1.0  ? vec4(2.0, 2.0, 2.0, 1.0) :  finalPos;


}
