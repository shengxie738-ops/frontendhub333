// Extracted verbatim from evidence\source-assets\js\app\page-4c279de0997d388f.js module 4025 (6803 chars)
// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)
precision highp float;
varying vec2 vColorCoordinate;
varying vec3 vPosition;
varying vec3 vPositionWorldSpace;
varying float vNoiseValue;
varying float vIsLeaf;
varying float vIsFloor;
varying float vPoolId;
varying float vSpriteIndex;
varying float vRandomSeed;
varying float vGrowth;
varying float vIsFloorPool;
varying float vMouseInfo;
varying float vDebug;
varying float vFogAmount;
varying float vHoverValue;

uniform float uTime;
uniform sampler2D uLuminosity;
uniform sampler2D uSpriteSheetPool;
uniform sampler2D uSpriteSheetPool2;
uniform float uSpriteSheetMix;
uniform float uSigmoidSteepness;
uniform float uBrightness;

uniform vec2 uPoolSheetSize;
uniform vec2 uAmountOfSprites;

uniform vec2 uStartEndIndexPool_0;
uniform vec2 uStartEndIndexPool_1;
uniform vec2 uStartEndIndexPool_2;
uniform vec2 uStartEndIndexLeaves;
uniform vec2 uStartEndIndexFloor;
uniform float uCamNear;
uniform float uCamFar;
uniform float uBrightnessOnTouch;

#ifndef PI
#define PI 3.141592653589793
#endif

vec2 rotateUVatPoint(vec2 uv, float rotation, vec2 pivot) {
	float s = sin(rotation);
	float c = cos(rotation);
	mat2 m = mat2(c, -s, s, c);
	uv -= pivot;
	uv = m * uv;
	uv += pivot;
	return uv;
}

// Sigmoid function for smooth transition
float sigmoidEase(float x) {
    // return 1.0 / (1.0 + exp(-x));
	return smoothstep(0., 8., x + 4.); // more performant without exp()
}

float makeGraphWithMaxAt(float x, float max) {
	return abs(x - max) * -1. + 1.;
}
float makeNegativeNumbersZero(float x) {
	return (x + abs(x)) * 0.5;
}
float areNumbersEqual(float x, float y) { // compare numbers function without if statement
	return makeNegativeNumbersZero(makeGraphWithMaxAt(x, y));
}



void main() {
    //r g b
    // uniform, Three.Color

    // vec3 colourPool0 = vec3(216.0,176.0,88.0) / vec3(255.0);
    // vec3 colourPool1 = vec3(210.0,190.0,201.0) / vec3(255.0);
    // vec3 colourPool2 = vec3(152.0,190.0,190.0) / vec3(255.0);

    // vec4 poolLookUpColor = texture2D(uLuminosity, vColorCoordinate);

    // vec4 poolLookUpColor = texture2D(uLuminosity, vColorCoordinate);
    // bool isPool0 = poolLookUpColor.rgb == colourPool0.rgb;
    // bool isPool1 = poolLookUpColor.rgb == colourPool1.rgb;
    // bool isPool2 = poolLookUpColor.rgb == colourPool2.rgb;

	float vIsLeaf = round(vIsLeaf); // Fix issue where sometimes vIsLeaf is not quite 1. for some reason

    vec2 currentPool = uStartEndIndexPool_0;
	float isPool0 = areNumbersEqual(vPoolId, 1.);
	float isPool1 = areNumbersEqual(vPoolId, 2.);
	float isPool2 = areNumbersEqual(vPoolId, 3.);
	float isPool0AndNotLeafOrFloor = isPool0 * (1. - vIsFloorPool) * (1. - vIsLeaf);
	float isPool1AndNotLeafOrFloor = isPool1 * (1. - vIsFloorPool) * (1. - vIsLeaf);
	float isPool2AndNotLeafOrFloor = isPool2 * (1. - vIsFloorPool) * (1. - vIsLeaf);

	currentPool = uStartEndIndexPool_0;
	currentPool = currentPool * (1. - vIsFloorPool) + uStartEndIndexFloor * vIsFloorPool;
	currentPool = currentPool * (1. - vIsLeaf) + uStartEndIndexLeaves * vIsLeaf;
	currentPool = currentPool * (1. - isPool0AndNotLeafOrFloor) + uStartEndIndexPool_0 * isPool0AndNotLeafOrFloor;
	currentPool = currentPool * (1. - isPool1AndNotLeafOrFloor) + uStartEndIndexPool_1 * isPool1AndNotLeafOrFloor;
	currentPool = currentPool * (1. - isPool2AndNotLeafOrFloor) + uStartEndIndexPool_2 * isPool2AndNotLeafOrFloor;

    float currentPoolRowRange = currentPool.y-currentPool.x;
    vec2 spriteSize = uPoolSheetSize / uAmountOfSprites;

    float w = uPoolSheetSize.x;
    float h = uPoolSheetSize.y;
    // Normalize sprite size (0.0-1.0)
    float spriteWidth = spriteSize.x / w;
    float spriteHeight = spriteSize.y / h;
    // float col = mod(vSpriteIndex, uAmountOfSprites.x);

    float indexBasedOnNoise = ceil(vNoiseValue * uAmountOfSprites.x);
	float indexForNotLeaf = indexBasedOnNoise;
	float randomIndex = ceil(vRandomSeed * uAmountOfSprites.x);
	float indexForLeaf = randomIndex;
	float index = indexForNotLeaf * (1. - vIsLeaf) + indexForLeaf * vIsLeaf;
	float col = mod(index, uAmountOfSprites.x);

    // Finally to UV texture coordinates
    float amountOfSpritesOnY= (1.0 / uAmountOfSprites.y);
    // we use vColorCoordinate as a seed so we always have the same index per pixel
    float row = currentPool.x + (vRandomSeed * currentPoolRowRange);
    float currentRow = amountOfSpritesOnY * round(row);



   //////////////////////////////////////////////////////
	// sprite position in the sprite sheet and rotation //
	//////////////////////////////////////////////////////

	vec2 pc = gl_PointCoord;
	vec2 uv;
	vec2 pivotPoint;

	float PI2 = PI * 2.;
	float angle = vRandomSeed * PI2 * 2. - PI2;
	float growAnim = vGrowth * 0.1 + 0.9;
	float animRotation = sin(vRandomSeed + uTime* vRandomSeed) * 0.3;

	uv.x = spriteWidth * pc.x + col * spriteWidth;
	uv.y = currentRow + pc.y * amountOfSpritesOnY;

	pivotPoint.x = col * spriteWidth + spriteWidth * 0.5;
	pivotPoint.y = currentRow + spriteHeight  *0.5;

	uv = rotateUVatPoint(uv, angle * growAnim +animRotation, pivotPoint);

	//////////////////////////////////////////////////////
	//////////////////////////////////////////////////////


    //flip it and reverse it
    uv.y = 1. - uv.y;

	//////////////////////////////////////////////////////
    ///////// Change the texture over time/scroll/////////
    vec4 textureA = texture2D(uSpriteSheetPool, uv);
    vec4 textureB = texture2D(uSpriteSheetPool2, uv);

    // create a bell curve
    float pct = (uSpriteSheetMix - 0.5) * PI;

    // create mix factor using a sigmoidEase function, https://en.wikipedia.org/wiki/Sigmoid_function
    float mixFactor = sigmoidEase(uSigmoidSteepness * (vRandomSeed - cos(pct)));
	vec4 spriteTexture = mix(textureA, textureB, mixFactor);

    ///////// END Change the texture over time/scroll/////////

	// Increase brightness of flowers on touch
	float brightnessIncrease = (1. - vIsLeaf) * uBrightnessOnTouch;
	float strength = vHoverValue*10.;
	spriteTexture.rgb *=1.0 + brightnessIncrease * strength;

	// Fade texture relative to fogAmount
    spriteTexture = mix(spriteTexture, spriteTexture * vec4(0.0,0.0,0.0,1.0-vFogAmount), vFogAmount);

	// Add highlight depending on Y position for leaves
	float highlightAmountForLeaf = clamp(vPositionWorldSpace.y, 0., 2.) * 0.5;
	float highlightAmount = vIsLeaf * highlightAmountForLeaf;

	vec4 white = vec4(1., 1., 1., 1.);
	vec4 turquoise = vec4(0.7, 0.83, 0.8, 1.);
	vec4 color = spriteTexture * mix(white, turquoise * 1.5, highlightAmount);

	// Final texture
    // spriteTexture = isFloorTexture ? vec4(1.0): spriteTexture;
	// color += color * vIsLeaf * uBrightness;
    gl_FragColor = color * uBrightness;
    // gl_FragColor=vec4(vMouseInfo,vMouseInfo,vMouseInfo,1.0);
    // gl_FragColor=vec4(vDebug,vDebug,vDebug,1.0);

	#include <colorspace_fragment>;
}
