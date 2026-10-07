// Extracted verbatim from evidence\source-assets\js\app\page-4c279de0997d388f.js module 5165 (1161 chars)
// Evidence: CONFIRMED-BUNDLE (original site GLSL source, minified bundle string literal)
precision highp float;
varying vec2 vUv;

uniform sampler2D uVignetteTexture;
uniform float uShrinkFactor;
uniform vec2 uScreenResolution;
uniform vec2 uTextureResolution;

vec2 coverMapping( float imgRatio, float targetRatio, vec2 currentUv){
    vec2 newUv = currentUv;

    float yRatio = imgRatio / targetRatio;
    float xRatio = targetRatio / imgRatio;

    newUv.y *= yRatio;
    newUv.y += (1. - yRatio) * 0.5;

    newUv.x *= xRatio;
    newUv.x += (1. - xRatio) * 0.5;

    return imgRatio < targetRatio ? vec2(currentUv.x, newUv.y) : vec2(newUv.x, currentUv.y);
}

void main() {


    float ratio=uTextureResolution.x/uTextureResolution.y;
    // 512.0/360.0;
    float targetRatio=uScreenResolution.x/uScreenResolution.y;

    vec2 uv=vUv;
    uv=coverMapping(ratio,targetRatio,uv);

    float alpha = texture2D(uVignetteTexture, uv).r;
    alpha += uShrinkFactor;

    vec3 baseColor=vec3(0.0);
    // the faster we go, teh closer it is to the base color, otherwise black
    // baseColor = mix(vec3(0.0),baseColor,uShrinkFactor*0.2);
    vec4 color = vec4(baseColor,alpha);

    gl_FragColor =  vec4(color);

    #include <colorspace_fragment>;
}
